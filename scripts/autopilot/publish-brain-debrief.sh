#!/usr/bin/env bash
# Publish a day's debrief into the casey-assistant brain, safely, from any checked-out state.
#
# WHY THIS EXISTS (2026-08-19). The debrief prompt used to tell the agent to run
# `git add -A && git commit && git push` in the brain repo. That repo is Casey's, it is
# routinely sitting on a work-in-progress branch with uncommitted notes, and its local
# `main` is routinely dozens of commits behind the remote. So the instruction was wrong in
# two ways at once: `add -A` would sweep Casey's unpushed work into the commit, and the
# push would land the debrief on his branch and then fail. Three cycles running (08-17,
# 08-18, 08-19) the agent had to notice this and hand-navigate around it, and on the first
# two the reports/ mirror below silently failed as a side effect.
#
# So don't touch the working tree at all. Build the commit straight onto origin/main with
# a temporary index, push it, and leave HEAD, the index and every uncommitted file exactly
# as they were. Nothing here can lose Casey's work, because nothing here writes to his
# checkout.
#
# Usage: publish-brain-debrief.sh <YYYY-MM-DD>
# Exit:  0 published (or already published, byte-identical), 1 nothing to publish / error.
set -uo pipefail

DATE="${1:-}"
[ -n "$DATE" ] || { echo "usage: $(basename "$0") <YYYY-MM-DD>"; exit 1; }

REPO="/home/casey/repos/youtube-outreach-orchestrator-v1"
BRAIN="/home/casey/repos/casey-assistant"
RUNS="brain/lead-gen/runs"
FILES=(
  "brain/lead-gen/INDEX.md"
  "$RUNS/lead-run-$DATE.html"
  "$RUNS/lead-run-$DATE-analysis.md"
)

cd "$BRAIN" || { echo "[publish] cannot cd $BRAIN"; exit 1; }

for f in "${FILES[@]}"; do
  [ -f "$f" ] || { echo "[publish] missing $f — write the debrief first"; exit 1; }
done

git fetch origin --quiet || echo "[publish] WARN: fetch failed; building on the origin/main we have"

GIT_INDEX_FILE="$(mktemp -u /tmp/brain-debrief-idx.XXXXXX)"
export GIT_INDEX_FILE
trap 'rm -f "$GIT_INDEX_FILE"' EXIT

git read-tree origin/main || { echo "[publish] cannot read origin/main"; exit 1; }
for f in "${FILES[@]}"; do
  blob="$(git hash-object -w "$f")" || exit 1
  git update-index --add --cacheinfo "100644,$blob,$f" || exit 1
done
tree="$(git write-tree)" || exit 1

# Already there, byte for byte? Then this is a re-run; say so and mirror anyway.
if [ "$tree" = "$(git rev-parse origin/main^{tree})" ]; then
  echo "[publish] origin/main already carries this debrief unchanged — nothing to push"
else
  commit="$(git commit-tree "$tree" -p origin/main -m "lead-run debrief $DATE")" || exit 1
  changed="$(git diff --name-only origin/main "$tree" | tr '\n' ' ')"
  echo "[publish] committing to main: $changed"
  git push origin "$commit:main" || { echo "[publish] PUSH FAILED — debrief is committed locally as $commit but NOT on the remote"; exit 1; }
  echo "[publish] pushed $commit to origin/main"
  # Fast-forward the local ref too, but ONLY when it holds nothing of its own. Casey's
  # local main sat 84 commits behind for weeks, which is most of why this got confusing.
  if [ -z "$(git rev-list "$commit..refs/heads/main" 2>/dev/null)" ]; then
    git update-ref refs/heads/main "$commit" && echo "[publish] local main fast-forwarded"
  else
    echo "[publish] local main has commits of its own; left alone"
  fi
fi

# Mirror into the orchestrator's reports/ folder (Casey wants every report gathered there
# too, 2026-07-13). Sourced from the brain worktree, with origin/main as the fallback, and
# LOUD on failure: the old `cp ... || true` in debrief.sh silently skipped 08-17 and 08-18.
mkdir -p "$REPO/reports"
for ext in ".html" "-analysis.md"; do
  src="$RUNS/lead-run-$DATE$ext"
  dst="$REPO/reports/lead-run-$DATE$ext"
  if cp "$src" "$dst" 2>/dev/null; then
    echo "[publish] mirrored $dst"
  elif git show "origin/main:$src" > "$dst" 2>/dev/null; then
    echo "[publish] mirrored $dst (from origin/main)"
  else
    echo "[publish] WARN: could not mirror $src into reports/"
  fi
done

echo "[publish] done for $DATE"
exit 0

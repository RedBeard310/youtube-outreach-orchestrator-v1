#!/usr/bin/env bash
# One-time installer for the autopilot systemd units (needs sudo; mirrors the existing
# system-level auto-sync unit pattern). Idempotent: re-run after editing a unit.
#
#   scripts/autopilot/install.sh            # install + enable + start
#   scripts/autopilot/install.sh --status   # show unit status only
#   scripts/autopilot/install.sh --stop     # stop + disable everything

set -euo pipefail
SRC="/home/casey/repos/youtube-outreach-orchestrator-v1/scripts/autopilot/systemd"
DEST="/etc/systemd/system"
UNITS=(autopilot-campaign.service autopilot-checkin.service autopilot-checkin.timer \
       autopilot-debrief.service autopilot-debrief.timer)

if [ "${1:-}" = "--status" ]; then
  systemctl status autopilot-campaign.service --no-pager -l | head -12 || true
  echo; systemctl list-timers 'autopilot-*' --no-pager || true
  exit 0
fi

if [ "${1:-}" = "--stop" ]; then
  sudo systemctl disable --now autopilot-campaign.service autopilot-checkin.timer autopilot-debrief.timer 2>/dev/null || true
  echo "autopilot stopped + disabled (unit files left in place)."
  exit 0
fi

echo "Installing autopilot units → $DEST (sudo)…"
for u in "${UNITS[@]}"; do sudo cp "$SRC/$u" "$DEST/$u"; done
sudo systemctl daemon-reload

# The campaign driver + the two timers are the enabled entry points; the .service units
# behind the timers are pulled in by them and need no separate enable.
sudo systemctl enable --now autopilot-campaign.service
sudo systemctl enable --now autopilot-checkin.timer
sudo systemctl enable --now autopilot-debrief.timer

echo "Installed. Status:"
systemctl is-active autopilot-campaign.service && echo "  campaign driver: active"
systemctl list-timers 'autopilot-*' --no-pager
echo
echo "Logs:   journalctl -u autopilot-campaign -f"
echo "        journalctl -u autopilot-checkin -f"
echo "        journalctl -u autopilot-debrief -f"
echo "Halt:   touch logs/autopilot-halt.flag   (loop stops after the current session)"
echo "Resume: rm logs/autopilot-halt.flag && sudo systemctl restart autopilot-campaign"

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getLeadsByIds, updateLead, type Lead } from '../airtable.ts';
import { runChild } from '../run.ts';

export interface D100Result {
  attempted: number;
  step_a_invoked: number;
  step_a_exit: number | null;
  step_b_invoked: number;
  step_b_succeeded: number;
  step_b_failed: number;
  bootstrap_attempted: number;
  notes: string[];
}

export interface DriverOpts {
  dryRun?: boolean;
}

// Mirrors the slugify in `youtube-deep-research-v1/src/lib/clients.ts`.
// Must stay byte-for-byte equivalent so clients.json lookups match.
function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function clientSlugExists(deepResearchPath: string, slug: string): boolean {
  const clientsPath = join(deepResearchPath, 'clients.json');
  if (!existsSync(clientsPath)) return false;
  try {
    const raw = readFileSync(clientsPath, 'utf8').trim();
    if (!raw) return false;
    const registry = JSON.parse(raw) as Record<string, unknown>;
    return slug in registry;
  } catch {
    return false;
  }
}

export async function driveD100(leads: Lead[], opts: DriverOpts = {}): Promise<D100Result> {
  const result: D100Result = {
    attempted: leads.length,
    step_a_invoked: 0,
    step_a_exit: null,
    step_b_invoked: 0,
    step_b_succeeded: 0,
    step_b_failed: 0,
    bootstrap_attempted: 0,
    notes: [],
  };

  if (leads.length === 0) {
    result.step_a_exit = 0;
    return result;
  }

  const emailOutreachPath = process.env.EMAIL_OUTREACH_REPO_PATH;
  const deepResearchPath = process.env.DEEP_RESEARCH_REPO_PATH;
  const businessModel = process.env.D100_BUSINESS_MODEL ?? 'high_ticket_service';
  const delaySeconds = Number(process.env.D100_STEP_B_DELAY_SECONDS ?? 60);
  if (!emailOutreachPath) throw new Error('EMAIL_OUTREACH_REPO_PATH is not set');
  if (!deepResearchPath) throw new Error('DEEP_RESEARCH_REPO_PATH is not set');

  // Partition by what each lead needs next. Classify step-B candidates first,
  // then route everything else into step A. This handles `failed` and
  // `deep_research_failed` retries cleanly:
  //   - lead at `deep_research_failed` with verified email → step B (retry)
  //   - lead at `failed` with no/invalid verification → step A (retry)
  const initiallyReadyForStepB = leads.filter(l => {
    const verified = l.email_verification_result === 'valid' || l.email_verification_result === 'risky';
    const s = l.outreach_status;
    return verified && (s === 'email_verified' || s === 'deep_research_failed');
  });
  const stepBIds = new Set(initiallyReadyForStepB.map(l => l.id));
  const needsStepA = leads.filter(l => {
    if (stepBIds.has(l.id)) return false;
    const s = l.outreach_status;
    return !s || s === 'pending' || s === 'email_found' || s === 'failed';
  });
  result.step_a_invoked = needsStepA.length;

  // Step A: find + verify only.
  if (needsStepA.length > 0) {
    const idCsv = needsStepA.map(l => l.id).join(',');
    const args = ['run', 'outreach', '--', '--lead-ids', idCsv, '--stop-after', 'verify'];
    if (opts.dryRun) {
      console.log(`[d100] DRY RUN — step A in ${emailOutreachPath}: npm ${args.join(' ')}`);
      result.step_a_exit = 0;
    } else {
      console.log(`[d100] step A: find+verify for ${needsStepA.length} leads`);
      const a = await runChild('npm', args, emailOutreachPath);
      result.step_a_exit = a.exit_code;
      if (a.error) result.notes.push(`step A error: ${a.error}`);
      if (a.exit_code !== 0) result.notes.push('step A non-zero exit; still attempting step B for pre-verified leads');
    }
  } else {
    result.step_a_exit = 0;
  }

  // Refresh step-A leads to pick up newly-verified ones.
  let stepAVerified: Lead[] = [];
  if (needsStepA.length > 0) {
    if (opts.dryRun) {
      stepAVerified = needsStepA;
      result.notes.push('dry-run: treating all step-A leads as verified for step-B preview');
    } else {
      const refreshed = await getLeadsByIds(needsStepA.map(l => l.id));
      stepAVerified = refreshed.filter(l =>
        l.outreach_status === 'email_verified' &&
        (l.email_verification_result === 'valid' || l.email_verification_result === 'risky')
      );
    }
  }

  const readyForStepB = [...initiallyReadyForStepB, ...stepAVerified];
  result.step_b_invoked = readyForStepB.length;
  if (readyForStepB.length === 0) {
    result.notes.push('no leads ready for step B');
    return result;
  }

  // Step B: per-lead deep research, with auto-bootstrap of clients.json entry + per-prospect base.
  // Sleep between leads to stay under per-minute YouTube rate limits — Google's
  // 10/min/project on the direct backend, RapidAPI's tier limit on the rapidapi backend.
  for (let i = 0; i < readyForStepB.length; i++) {
    const lead = readyForStepB[i]!;
    if (i > 0 && !opts.dryRun && delaySeconds > 0) {
      console.log(`[d100] sleeping ${delaySeconds}s before next lead (YouTube per-minute quota)`);
      await sleep(delaySeconds * 1000);
    }
    if (!lead.channel_name || !lead.channel_url) {
      result.notes.push(`lead ${lead.id}: missing channel_name or channel_url`);
      result.step_b_failed += 1;
      continue;
    }

    const slug = slugify(lead.channel_name);
    if (!slug) {
      result.notes.push(`lead ${lead.id}: slugify produced empty string from "${lead.channel_name}"`);
      result.step_b_failed += 1;
      continue;
    }

    const needsBootstrap = !clientSlugExists(deepResearchPath, slug);

    if (opts.dryRun) {
      console.log(`[d100] DRY RUN — lead ${lead.id} slug="${slug}" bootstrap=${needsBootstrap}`);
      if (needsBootstrap) {
        console.log(`  would run: npx tsx scripts/register-client.ts --client ${slug} --name "${lead.channel_name}"`);
        result.bootstrap_attempted += 1;
      }
      console.log(`  would run: npx tsx scripts/run-channel.ts ${lead.channel_url} --client ${slug} --business-model ${businessModel} --research-purpose research_target`);
      result.step_b_succeeded += 1;
      continue;
    }

    try {
      await updateLead(lead.id, { outreach_status: 'deep_research_in_progress' });
    } catch (e) {
      result.notes.push(`lead ${lead.id}: failed to set in_progress: ${errMsg(e)}`);
      result.step_b_failed += 1;
      continue;
    }

    if (needsBootstrap) {
      result.bootstrap_attempted += 1;
      console.log(`[d100] bootstrapping client "${slug}" for lead ${lead.id}`);
      const bs = await runChild(
        'npx',
        ['tsx', 'scripts/register-client.ts', '--client', slug, '--name', lead.channel_name],
        deepResearchPath
      );
      if (bs.exit_code !== 0) {
        result.notes.push(`lead ${lead.id}: bootstrap failed (exit ${bs.exit_code}${bs.error ? ', ' + bs.error : ''})`);
        await updateLead(lead.id, { outreach_status: 'deep_research_failed' }).catch(() => {});
        result.step_b_failed += 1;
        continue;
      }
    }

    console.log(`[d100] deep research for lead ${lead.id} (slug="${slug}")`);
    const rc = await runChild(
      'npx',
      [
        'tsx',
        'scripts/run-channel.ts',
        lead.channel_url,
        '--client',
        slug,
        '--business-model',
        businessModel,
        '--research-purpose',
        'research_target',
      ],
      deepResearchPath
    );

    if (rc.exit_code === 0) {
      await updateLead(lead.id, { outreach_status: 'deep_research_complete' }).catch(() => {});
      result.step_b_succeeded += 1;
    } else {
      result.notes.push(`lead ${lead.id}: deep research failed (exit ${rc.exit_code}${rc.error ? ', ' + rc.error : ''})`);
      await updateLead(lead.id, { outreach_status: 'deep_research_failed' }).catch(() => {});
      result.step_b_failed += 1;
    }
  }

  return result;
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

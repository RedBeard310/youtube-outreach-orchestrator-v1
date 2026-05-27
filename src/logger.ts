import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

export function writeTickLog(entry: Record<string, unknown>): void {
  mkdirSync('logs', { recursive: true });
  const today = new Date().toISOString().slice(0, 10);
  const file = join('logs', `orchestrator-${today}.jsonl`);
  appendFileSync(file, JSON.stringify(entry) + '\n');
}

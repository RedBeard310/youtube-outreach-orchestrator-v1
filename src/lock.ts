import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const LOCK_PATH = join('logs', '.tick-lock');

export function acquireLock(): boolean {
  mkdirSync('logs', { recursive: true });

  if (existsSync(LOCK_PATH)) {
    const raw = readFileSync(LOCK_PATH, 'utf8').trim();
    const pid = Number(raw);
    if (pid && isProcessAlive(pid)) return false;
    unlinkSync(LOCK_PATH);
  }

  writeFileSync(LOCK_PATH, String(process.pid));
  return true;
}

export function releaseLock(): void {
  if (!existsSync(LOCK_PATH)) return;
  try {
    unlinkSync(LOCK_PATH);
  } catch {
    // best-effort cleanup
  }
}

function isProcessAlive(pid: number): boolean {
  if (!pid || Number.isNaN(pid)) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

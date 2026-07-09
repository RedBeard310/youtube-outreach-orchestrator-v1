import { spawn } from 'node:child_process';

export interface RunResult {
  exit_code: number | null;
  error?: string;
}

export function runChild(cmd: string, args: string[], cwd: string): Promise<RunResult> {
  return new Promise(resolve => {
    const child = spawn(cmd, args, { cwd, stdio: 'inherit' });
    child.on('exit', code => resolve({ exit_code: code }));
    child.on('error', err => resolve({ exit_code: null, error: err.message }));
  });
}

export interface CaptureResult extends RunResult {
  stdout: string;
  stderr: string;
}

/**
 * Like runChild but captures stdout/stderr instead of inheriting the terminal.
 * Used by the campaign driver to read a child's structured verdict (e.g.
 * reservoir-check --json). Still tees to the parent terminal so progress is
 * visible during a long autonomous run.
 */
export function runChildCapture(cmd: string, args: string[], cwd: string): Promise<CaptureResult> {
  return new Promise(resolve => {
    const child = spawn(cmd, args, { cwd });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', d => { const s = String(d); stdout += s; process.stdout.write(s); });
    child.stderr.on('data', d => { const s = String(d); stderr += s; process.stderr.write(s); });
    child.on('exit', code => resolve({ exit_code: code, stdout, stderr }));
    child.on('error', err => resolve({ exit_code: null, error: err.message, stdout, stderr }));
  });
}

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

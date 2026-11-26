import fs from 'node:fs';
import path from 'node:path';
import type { ExecFileFn } from './systemInfo';
import { defaultExecFile } from './systemInfo';
import { isValidVenvName, resolveContainedPath } from './paths';

/**
 * Virtual environment management.
 *
 * - Environments are created ONLY under <userData>/venvs/<name>.
 * - Python is invoked via execFile with a fixed argument vector; never a shell.
 * - Creating a venv requires explicit user confirmation (confirmed === true).
 * - The shell never activates the venv and never executes repo or model code.
 */

export class VenvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VenvError';
  }
}

/** Pinned huggingface_hub version installed only on explicit request. */
export const PINNED_HUGGINGFACE_HUB = 'huggingface_hub==0.26.2';

const PYTHON_CANDIDATES = ['python3', 'python'] as const;

export interface DetectedPython {
  executable: string;
  version: string; // e.g. "3.12.12"
}

export function parsePythonVersion(output: string): string | null {
  const m = /Python\s+(\d+\.\d+\.\d+)/.exec(output);
  return m ? (m[1] ?? null) : null;
}

/** Use operator-configured Python exactly, or discover Python 3 on PATH. */
export async function detectPython(execFileFn: ExecFileFn, pythonPath?: string): Promise<DetectedPython | null> {
  if (pythonPath !== undefined && (typeof pythonPath !== 'string' || !path.isAbsolute(pythonPath)
    || Buffer.byteLength(pythonPath) > 4096 || /[\x00-\x1f\x7f]/.test(pythonPath))) {
    throw new VenvError('The configured Python executable must be an absolute host path.');
  }
  for (const exe of pythonPath === undefined ? PYTHON_CANDIDATES : [pythonPath]) {
    try {
      const { stdout, stderr } = await execFileFn(exe, ['--version'], { timeout: 5000 });
      const version = parsePythonVersion(`${stdout}\n${stderr}`);
      if (version && version.startsWith('3.')) {
        return { executable: exe, version };
      }
    } catch {
      // A configured interpreter never silently falls back to a different one.
      if (pythonPath !== undefined) throw new VenvError('The configured Python executable is unavailable.');
    }
  }
  if (pythonPath !== undefined) throw new VenvError('The configured executable did not report Python 3.');
  return null;
}

export interface CreateVenvOptions {
  name: string;
  confirmed: boolean;
  installHuggingFaceHub?: boolean;
}

export interface VenvDeps {
  /** Injectable executor; defaults to execFile with fixed args, no shell. */
  execFileFn?: ExecFileFn;
  userDataPath: string;
  /** Trusted daemon/extension-host setting, never supplied by a workbench request. */
  pythonPath?: string;
  onProgress?: (detail: string) => void;
}

export function venvRoot(userDataPath: string): string {
  return path.join(userDataPath, 'venvs');
}

export function resolveVenvPath(userDataPath: string, name: string): string {
  if (!isValidVenvName(name)) {
    throw new VenvError(
      `Invalid venv name "${name}": use 1-64 characters of [A-Za-z0-9._-], no separators or "..".`,
    );
  }
  return resolveContainedPath(venvRoot(userDataPath), name);
}

export function venvPythonPath(venvPath: string, platform: NodeJS.Platform = process.platform): string {
  return platform === 'win32'
    ? path.join(venvPath, 'Scripts', 'python.exe')
    : path.join(venvPath, 'bin', 'python');
}

/**
 * Create a virtual environment. Throws unless options.confirmed === true.
 */
export async function createVenv(deps: VenvDeps, options: CreateVenvOptions): Promise<{ path: string; pythonPath: string }> {
  if (options.confirmed !== true) {
    throw new VenvError('Venv creation requires explicit user confirmation.');
  }
  const execFileFn = deps.execFileFn ?? defaultExecFile;
  const dest = resolveVenvPath(deps.userDataPath, options.name);
  if (fs.existsSync(dest)) {
    throw new VenvError(`Venv "${options.name}" already exists at ${dest}; delete it first.`);
  }

  const python = await detectPython(execFileFn, deps.pythonPath);
  if (!python) {
    throw new VenvError('No Python 3 interpreter found on PATH (tried python3, python).');
  }

  deps.onProgress?.(`Creating virtual environment with ${python.executable} ${python.version}…`);
  await execFileFn(python.executable, ['-I', '-m', 'venv', dest], { timeout: 120000 });

  const pythonPath = venvPythonPath(dest);
  if (options.installHuggingFaceHub === true) {
    deps.onProgress?.(`Installing pinned ${PINNED_HUGGINGFACE_HUB}…`);
    await execFileFn(
      pythonPath,
      ['-I', '-m', 'pip', '--isolated', '--require-virtualenv', 'install', '--disable-pip-version-check', '--no-input', PINNED_HUGGINGFACE_HUB],
      { timeout: 300000 },
    );
  }
  deps.onProgress?.('Virtual environment ready.');
  return { path: dest, pythonPath };
}

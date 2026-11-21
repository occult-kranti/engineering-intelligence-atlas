import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { ExecFileFn } from '../src/main/systemInfo';
import { createVenv, detectPython, PINNED_HUGGINGFACE_HUB, VenvError } from '../src/main/venv';

interface Call {
  file: string;
  args: readonly string[];
  options: { timeout: number };
}

function fakeExecutor(recorded: Call[], opts: { pythonVersion?: string } = {}): ExecFileFn {
  return async (file, args, options) => {
    recorded.push({ file, args: [...args], options });
    if (args[0] === '--version') {
      return { stdout: `Python ${opts.pythonVersion ?? '3.12.12'}\n`, stderr: '' };
    }
    return { stdout: '', stderr: '' };
  };
}

function tmpUserData(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'dshell-venv-'));
}

describe('detectPython', () => {
  it('finds python3', async () => {
    const py = await detectPython(fakeExecutor([]));
    expect(py?.executable).toBe('python3');
    expect(py?.version).toBe('3.12.12');
  });

  it('falls back to python when python3 fails', async () => {
    const exec: ExecFileFn = async (file, args) => {
      if (file === 'python3') throw new Error('ENOENT');
      if (args[0] === '--version') return { stdout: 'Python 3.11.9', stderr: '' };
      return { stdout: '', stderr: '' };
    };
    const py = await detectPython(exec);
    expect(py?.executable).toBe('python');
  });

  it('returns null when no Python 3 exists', async () => {
    const exec: ExecFileFn = async (file) => {
      if (file === 'python') return { stdout: 'Python 2.7.18', stderr: '' };
      throw new Error('ENOENT');
    };
    expect(await detectPython(exec)).toBeNull();
  });
});

describe('createVenv', () => {
  it('requires explicit confirmation before doing anything', async () => {
    const calls: Call[] = [];
    await expect(
      createVenv({ userDataPath: tmpUserData(), execFileFn: fakeExecutor(calls) }, { name: 'x', confirmed: false }),
    ).rejects.toThrow(/confirmation/);
    expect(calls).toEqual([]);
  });

  it('creates under userData/venvs with fixed args and no shell', async () => {
    const calls: Call[] = [];
    const userData = tmpUserData();
    const res = await createVenv(
      { userDataPath: userData, execFileFn: fakeExecutor(calls) },
      { name: 'hf-tools', confirmed: true },
    );
    expect(res.path).toBe(path.join(userData, 'venvs', 'hf-tools'));
    const venvCall = calls.find((c) => c.args[0] === '-m' && c.args[1] === 'venv');
    expect(venvCall).toBeDefined();
    expect(venvCall?.file).toBe('python3');
    expect(venvCall?.args).toEqual(['-m', 'venv', path.join(userData, 'venvs', 'hf-tools')]);
    // The ExecFileFn contract has no shell option; assert options carry only timeout.
    expect(Object.keys(venvCall?.options ?? {})).toEqual(['timeout']);
  });

  it('installs the pinned huggingface_hub only when requested', async () => {
    const calls: Call[] = [];
    const userData = tmpUserData();
    await createVenv(
      { userDataPath: userData, execFileFn: fakeExecutor(calls) },
      { name: 'hf-tools', confirmed: true, installHuggingFaceHub: true },
    );
    const pip = calls.find((c) => c.args[1] === 'pip');
    expect(pip?.args).toContain(PINNED_HUGGINGFACE_HUB);
    expect(PINNED_HUGGINGFACE_HUB).toMatch(/huggingface_hub==\d+\.\d+\.\d+/);

    const calls2: Call[] = [];
    await createVenv(
      { userDataPath: tmpUserData(), execFileFn: fakeExecutor(calls2) },
      { name: 'plain', confirmed: true },
    );
    expect(calls2.find((c) => c.args[1] === 'pip')).toBeUndefined();
  });

  it('rejects invalid and traversing names', async () => {
    const calls: Call[] = [];
    const exec = fakeExecutor(calls);
    for (const name of ['../escape', 'a/b', '', 'a..b']) {
      await expect(
        createVenv({ userDataPath: tmpUserData(), execFileFn: exec }, { name, confirmed: true }),
      ).rejects.toThrow(VenvError);
    }
    expect(calls.find((c) => c.args[1] === 'venv')).toBeUndefined();
  });

  it('refuses to overwrite an existing venv', async () => {
    const userData = tmpUserData();
    fs.mkdirSync(path.join(userData, 'venvs', 'taken'), { recursive: true });
    await expect(
      createVenv({ userDataPath: userData, execFileFn: fakeExecutor([]) }, { name: 'taken', confirmed: true }),
    ).rejects.toThrow(/already exists/);
  });
});

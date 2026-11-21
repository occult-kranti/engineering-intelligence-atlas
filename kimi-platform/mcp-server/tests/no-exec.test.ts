import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC_ROOT = resolve(__dirname, '..', 'src');

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (entry.endsWith('.ts')) yield full;
  }
}

const FORBIDDEN = [
  /child_process/,
  /\bexecSync\b/,
  /\bexecFile\b/,
  /\bspawnSync?\b/,
  /\bexec\s*\(/,
  /node:shell/,
  /\bvm\.runIn/,
  /\beval\s*\(/,
  /new\s+Function\s*\(/,
  /\bwriteFileSync?\b/, // the server must never write files
  /\bfs\.rm\b/,
];

describe('no execution primitives in the server', () => {
  it('src contains no child_process/exec/eval/file-write usage', () => {
    const offenders: string[] = [];
    for (const file of walk(SRC_ROOT)) {
      const text = readFileSync(file, 'utf8');
      for (const pattern of FORBIDDEN) {
        if (pattern.test(text)) offenders.push(`${file}: ${pattern}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('package.json has no postinstall/preinstall scripts', () => {
    const pkg = JSON.parse(readFileSync(resolve(SRC_ROOT, '..', 'package.json'), 'utf8')) as { scripts?: Record<string, string> };
    for (const key of Object.keys(pkg.scripts ?? {})) {
      expect(['preinstall', 'install', 'postinstall']).not.toContain(key);
    }
  });
});

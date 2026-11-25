#!/usr/bin/env node
/** Shared local, PR and Pages integrity gate; no provider or engine download. */
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const testFiles = directory => readdirSync(new URL(`../${directory}/`, import.meta.url))
  .filter(name => name.endsWith('.test.mjs')).sort().map(name => `${directory}/${name}`);
const commands = [
  [process.execPath, ['scripts/materialize-heritage-models.mjs']],
  ['python3', ['integrations/opencode-game-studios/sync_resources.py', '--check']],
  ['python3', ['-m', 'unittest', 'discover', '-s', 'integrations/opencode-game-studios', '-p', 'test_*.py', '-v']],
  [process.execPath, ['--test', ...testFiles('projects/architecture-library/site-models/tests'),
    ...testFiles('integrations/heritage-assets/test'), 'integrations/godot-heritage-review/test/audit.test.mjs',
    'scripts/materialize-heritage-models.test.mjs']],
  ['python3', ['-m', 'unittest', 'discover', '-s', 'integrations/heritage-assets', '-p', 'test_*.py', '-v']],
];
for (const [command, args] of commands) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', env: process.env });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log('Game resource, captured-model and geometry integrity gates passed.');

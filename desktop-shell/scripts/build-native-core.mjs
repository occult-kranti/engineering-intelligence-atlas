#!/usr/bin/env node
/** Build the native target for THIS host, then copy it into the packaging input. */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const desktop = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const core = path.resolve(desktop, '..', 'native-core');
const rustupCargo = path.join(os.homedir(), '.cargo', 'bin', process.platform === 'win32' ? 'cargo.exe' : 'cargo');
const cargo = fs.existsSync(rustupCargo) ? rustupCargo : 'cargo';
try {
  execFileSync(cargo, ['build', '--release', '--locked', '--manifest-path', path.join(core, 'Cargo.toml')], { stdio: 'inherit', cwd: desktop, timeout: 300_000 });
} catch (error) {
  console.error('Rust core build failed. Install a supported Rust toolchain (rustup), then rerun npm run build:native.');
  process.exit(1);
}
const name = process.platform === 'win32' ? 'atlas-core.exe' : 'atlas-core';
const destination = path.join(desktop, 'native');
fs.mkdirSync(destination, { recursive: true });
// Remove stale helpers/metadata from other platforms so packaging cannot include them.
for (const stale of fs.readdirSync(destination)) {
  if (stale.startsWith('atlas-core') && stale !== name) fs.rmSync(path.join(destination, stale), { force: true });
}
fs.copyFileSync(path.join(core, 'target', 'release', name), path.join(destination, name));
if (process.platform !== 'win32') fs.chmodSync(path.join(destination, name), 0o755);
fs.writeFileSync(path.join(destination, 'build.json'), JSON.stringify({ platform: process.platform, arch: process.arch, binary: name, builtAt: new Date().toISOString() }, null, 2) + '\n');
console.log(`Native core ready: ${path.join(destination, name)} (${process.platform}/${process.arch})`);

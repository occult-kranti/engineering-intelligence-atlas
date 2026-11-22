#!/usr/bin/env node
/** Build the portable backend from installed, locked dependencies. No downloads. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const extensionRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = path.resolve(extensionRoot, '..');
const require = createRequire(import.meta.url);
const digest = value => crypto.createHash('sha256').update(value).digest('hex');

function nativeTarget(bytes) {
  if (bytes.subarray(0, 4).equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46])) && bytes.length >= 20) {
    const machine = bytes[5] === 1 ? bytes.readUInt16LE(18) : bytes.readUInt16BE(18);
    return { platform: 'linux', arch: machine === 62 ? 'x64' : machine === 183 ? 'arm64' : 'unknown' };
  }
  if (bytes.subarray(0, 2).toString() === 'MZ' && bytes.length > 64) {
    const pe = bytes.readUInt32LE(60);
    if (pe + 6 <= bytes.length && bytes.subarray(pe, pe + 4).toString() === 'PE\0\0') {
      const machine = bytes.readUInt16LE(pe + 4);
      return { platform: 'win32', arch: machine === 0x8664 ? 'x64' : machine === 0xaa64 ? 'arm64' : 'unknown' };
    }
  }
  if (bytes.length >= 8 && bytes.readUInt32LE(0) === 0xfeedfacf) {
    const cpu = bytes.readUInt32LE(4);
    return { platform: 'darwin', arch: cpu === 0x01000007 ? 'x64' : cpu === 0x0100000c ? 'arm64' : 'unknown' };
  }
  throw new Error('The native core must be an existing release binary for this platform.');
}

export async function buildRuntime({ repoRoot = repositoryRoot, outputDir = path.join(extensionRoot, 'resources/runtime'),
  binaryPath = path.join(repoRoot, 'native-core/target/release', process.platform === 'win32' ? 'atlas-core.exe' : 'atlas-core') } = {}) {
  if (Number(process.versions.node.split('.')[0]) < 22) throw new Error('Runtime packaging requires Node.js 22 or later.');
  const binary = fs.readFileSync(binaryPath); const target = nativeTarget(binary);
  if (target.platform !== process.platform || target.arch !== process.arch) throw new Error('Native core platform/architecture differs from this packaging host. Build the matching Rust release first.');
  const build = require('esbuild').build;
  const tsconfig = JSON.parse(fs.readFileSync(path.join(repoRoot, 'headless-runtime/tsconfig.json'), 'utf8'));
  const entries = tsconfig.include.map(file => path.resolve(repoRoot, 'headless-runtime', file));
  if (!entries.length || entries.some(file => !file.startsWith(path.join(repoRoot, 'desktop-shell/src/main/')) || !file.endsWith('.ts'))) throw new Error('Unexpected portable TypeScript entry.');
  const staging = `${outputDir}.building-${crypto.randomUUID()}`;
  fs.mkdirSync(staging, { recursive: true });
  const copy = (relative, source = path.join(repoRoot, relative)) => {
    const info = fs.lstatSync(source); if (!info.isFile() || info.isSymbolicLink()) throw new Error('Packaging input must be a regular file.');
    const destination = path.join(staging, relative); fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.copyFileSync(source, destination);
  };
  try {
    await build({ entryPoints: entries, outdir: path.join(staging, 'desktop-shell/dist/main'), bundle: true,
      platform: 'node', target: 'node22', format: 'cjs', sourcemap: false, legalComments: 'eof', logLevel: 'warning',
      plugins: [{ name: 'no-electron-backend', setup(builder) {
        builder.onResolve({ filter: /^electron(?:\/|$)/ }, () => ({ errors: [{ text: 'Portable runtime must not import Electron.' }] }));
      } }] });
    for (const name of fs.readdirSync(path.join(repoRoot, 'headless-runtime')).sort()) if (name.endsWith('.mjs')) copy(`headless-runtime/${name}`);
    for (const relative of ['tools/atlas-mcp.mjs', 'tools/daftar-runtime-mcp.mjs', 'deploy/host-control.mjs',
      'deploy/tmux-runtime.mjs', 'deploy/runtime-request.mjs', 'deploy/healthcheck.mjs', 'desktop-shell/models.catalog.json']) copy(relative);
    const copySeeds = relative => {
      for (const entry of fs.readdirSync(path.join(repoRoot, relative), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        if (entry.name.startsWith('.') || entry.isSymbolicLink()) throw new Error('Seed packaging refuses hidden files and links.');
        const next = `${relative}/${entry.name}`;
        if (entry.isDirectory()) copySeeds(next);
        // These example source files are referenced by the role-library index;
        // retain them as inert seed resources, without packaging tests or state.
        else if (/\.(?:json|md|js|py|html|css)$/.test(entry.name)) copy(next);
      }
    };
    copySeeds('company');
    const corePath = `native-core/target/release/${process.platform === 'win32' ? 'atlas-core.exe' : 'atlas-core'}`;
    copy(corePath, binaryPath); if (process.platform !== 'win32') fs.chmodSync(path.join(staging, corePath), 0o755);
    // Explicit module type prevents the enclosing extension package from changing
    // the semantics of the bundled CommonJS modules.
    fs.writeFileSync(path.join(staging, 'desktop-shell/package.json'), '{"private":true,"type":"commonjs"}\n');
    const files = {};
    const collect = relative => {
      for (const entry of fs.readdirSync(path.join(staging, relative), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        const next = relative ? `${relative}/${entry.name}` : entry.name;
        if (entry.isDirectory()) collect(next);
        else { const value = fs.readFileSync(path.join(staging, next)); files[next] = { bytes: value.length, sha256: digest(value) }; }
      }
    };
    collect('');
    const manifest = { schemaVersion: 1, platform: target.platform, arch: target.arch, nodeMajorMinimum: 22,
      entrypoint: 'headless-runtime/server.mjs', corePath, files };
    fs.writeFileSync(path.join(staging, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
    fs.mkdirSync(path.dirname(outputDir), { recursive: true });
    // This directory contains generated package inputs only, never user state.
    fs.rmSync(outputDir, { recursive: true, force: true }); fs.renameSync(staging, outputDir);
    return manifest;
  } finally { fs.rmSync(staging, { recursive: true, force: true }); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { const manifest = await buildRuntime(); process.stdout.write(`Portable runtime packaged for ${manifest.platform}/${manifest.arch}: ${Object.keys(manifest.files).length} verified files.\n`); }
  catch (error) { process.stderr.write(`${error instanceof Error ? error.message : 'Runtime packaging failed.'}\n`); process.exitCode = 1; }
}

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { downloadAndUnzipVSCode, resolveCliArgsFromVSCodeExecutablePath, runTests } from '@vscode/test-electron';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
const vsix = path.join(root, `atlas-office-${manifest.version}.vsix`);
const vsixSha256 = crypto.createHash('sha256').update(await fs.readFile(vsix)).digest('hex');
const output = path.join(root, '.work', 'installed-smoke');
const version = process.env.ATLAS_VSCODE_TEST_VERSION || '1.147.0';
assert.match(version, /^\d+\.\d+\.\d+$/, 'Pin an exact VS Code release for installed smoke verification');
await fs.mkdir(output, { recursive: true });
await fs.rm(path.join(output, 'receipt.json'), { force: true });
const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'atlas-vsix-smoke-'));
const userData = path.join(temporary, 'user-data');
const extensions = path.join(temporary, 'extensions');
const workspace = path.join(temporary, 'workspace');
await Promise.all([fs.mkdir(path.join(userData, 'User'), { recursive: true }), fs.mkdir(extensions), fs.mkdir(workspace)]);
await fs.writeFile(path.join(userData, 'User', 'settings.json'), JSON.stringify({
  'telemetry.telemetryLevel': 'off',
  'update.mode': 'none',
  'extensions.autoCheckUpdates': false,
  'extensions.autoUpdate': false,
  'workbench.startupEditor': 'none',
  'workbench.enableExperiments': false,
  'security.workspace.trust.enabled': false,
}));
const receiptPath = path.join(output, 'receipt.json');

try {
  // Download is the only required external setup. All Atlas checks use an empty
  // profile and block fetch before activating the installed package.
  const executable = await downloadAndUnzipVSCode({ version, cachePath: path.join(root, '.vscode-test') });
  // Suppress the helper's default profile arguments; explicit isolated paths
  // below are used for both installation and activation.
  const [cli, ...cliArgs] = resolveCliArgsFromVSCodeExecutablePath(executable, { reuseMachineInstall: true });
  // The upstream runner merges process.env into the extension host, so remove
  // credentials and injected Node/Electron options from this child runner too.
  for (const name of Object.keys(process.env)) {
    if (/(?:TOKEN|SECRET|PASSWORD|API_KEY|ACCESS_KEY|CREDENTIAL)/i.test(name) || ['NODE_OPTIONS', 'ELECTRON_RUN_AS_NODE'].includes(name)) delete process.env[name];
  }
  const profileArgs = [`--user-data-dir=${userData}`, `--extensions-dir=${extensions}`];
  // Windows .cmd launchers require a shell. Use the downloaded executable's
  // own Node CLI entry instead, keeping arguments literal on every platform.
  const installExecutable = process.platform === 'win32' ? executable : cli;
  const installPrefix = process.platform === 'win32' ? [path.join(path.dirname(executable), 'resources/app/out/cli.js')] : cliArgs;
  const install = spawnSync(installExecutable, [...installPrefix, ...profileArgs, '--install-extension', vsix, '--force'], {
    env: process.platform === 'win32' ? { ...process.env, ELECTRON_RUN_AS_NODE: '1' } : process.env,
    encoding: 'utf8', timeout: 90_000, shell: false,
  });
  await fs.writeFile(path.join(output, 'install.log'), `${install.stdout || ''}${install.stderr || ''}`);
  assert.equal(install.error, undefined, 'VS Code install command must finish');
  assert.equal(install.status, 0, `VSIX installation failed; see ${path.join(output, 'install.log')}`);
  const exitCode = await runTests({
    vscodeExecutablePath: executable,
    extensionDevelopmentPath: path.join(root, 'test-host'),
    extensionTestsPath: path.join(root, 'test-host', 'suite.js'),
    launchArgs: [workspace, ...profileArgs, '--disable-telemetry', '--disable-gpu', '--proxy-server=http://127.0.0.1:9'],
    extensionTestsEnv: {
      ATLAS_INSTALLED_SMOKE_RECEIPT: receiptPath,
      ATLAS_INSTALLED_SMOKE_EXTENSIONS: extensions,
      ATLAS_INSTALLED_SMOKE_SOURCE: root,
      ATLAS_INSTALLED_SMOKE_VERSION: manifest.version,
      ATLAS_INSTALLED_SMOKE_VSIX_SHA256: vsixSha256,
    },
  });
  assert.equal(exitCode, 0);
  const receipt = JSON.parse(await fs.readFile(receiptPath, 'utf8'));
  assert.equal(receipt.status, 'passed');
  assert.equal(receipt.vsixSha256, vsixSha256);
  console.log(JSON.stringify({ status: receipt.status, vscodeVersion: receipt.vscodeVersion, extensionVersion: receipt.extensionVersion, checks: receipt.checks.length, networkRequests: receipt.networkRequests, receipt: receiptPath }));
} catch (error) {
  try { await fs.access(receiptPath); }
  catch { await fs.writeFile(receiptPath, JSON.stringify({ status: 'failed-before-test-host', requestedVscodeVersion: version, extensionVersion: manifest.version, vsixSha256, error: error instanceof Error ? error.message : 'Unknown installed smoke failure' }, null, 2) + '\n'); }
  throw error;
} finally {
  try { await fs.cp(path.join(userData, 'logs'), path.join(output, 'logs'), { recursive: true, force: true }); } catch {}
  await fs.rm(temporary, { recursive: true, force: true });
}

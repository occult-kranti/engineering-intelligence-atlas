'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const vscode = require('vscode');

async function filesBelow(root) {
  const files = [];
  for (const entry of await fs.readdir(root, { withFileTypes: true })) {
    const file = path.join(root, entry.name);
    assert.ok(!entry.isSymbolicLink(), 'Installed extension must not contain symlinks');
    if (entry.isDirectory()) files.push(...await filesBelow(file));
    else if (entry.isFile()) files.push(file);
  }
  return files;
}

exports.run = async function run() {
  const receiptPath = process.env.ATLAS_INSTALLED_SMOKE_RECEIPT;
  assert.ok(receiptPath, 'The isolated runner must supply the receipt path');
  const receipt = {
    status: 'failed',
    startedAt: new Date().toISOString(),
    vscodeVersion: vscode.version,
    vsixSha256: process.env.ATLAS_INSTALLED_SMOKE_VSIX_SHA256,
    checks: [],
    networkRequests: 0,
  };
  const originalFetch = globalThis.fetch;
  // The fresh profile has no Atlas connection. Any attempted fetch is a test
  // failure, and it is blocked before it can reach a model or other service.
  globalThis.fetch = async () => {
    receipt.networkRequests += 1;
    throw new Error('Network dispatch is disabled in the installed Atlas smoke test');
  };
  try {
    const id = 'occult-kranti.atlas-office';
    const extension = vscode.extensions.getExtension(id);
    assert.ok(extension, 'The separately installed VSIX must be discoverable');
    const installedRoot = await fs.realpath(extension.extensionPath);
    const extensionsRoot = await fs.realpath(process.env.ATLAS_INSTALLED_SMOKE_EXTENSIONS);
    const sourceRoot = await fs.realpath(process.env.ATLAS_INSTALLED_SMOKE_SOURCE);
    const relativeInstalled = path.relative(extensionsRoot, installedRoot);
    assert.ok(relativeInstalled && !relativeInstalled.startsWith('..') && !path.isAbsolute(relativeInstalled), 'Atlas must be loaded from the isolated installed extensions directory');
    assert.notEqual(installedRoot, sourceRoot, 'Source development activation does not verify the installed VSIX');
    assert.equal(extension.packageJSON.version, process.env.ATLAS_INSTALLED_SMOKE_VERSION);
    receipt.extensionId = id;
    receipt.extensionVersion = extension.packageJSON.version;
    receipt.installedDirectory = relativeInstalled;
    receipt.checks.push('VSIX installed separately from test host and source');

    const installedFiles = await filesBelow(installedRoot);
    const credentialPattern = /(?:sk-ant-|sk-proj-|github_pat_|ghp_)[A-Za-z0-9_-]{24,}/;
    const hashes = {};
    for (const file of installedFiles) {
      const relative = path.relative(installedRoot, file).replaceAll(path.sep, '/');
      assert.ok(!/^(?:test|test-host|scripts|node_modules|\.work|\.vscode-test)\//.test(relative), 'The installed VSIX must omit development artifacts');
      const data = await fs.readFile(file);
      assert.ok(!credentialPattern.test(data.toString('utf8')), `Unexpected credential-shaped material in installed ${relative}`);
      if (relative.startsWith('src/') || relative.startsWith('media/')) hashes[relative] = crypto.createHash('sha256').update(data).digest('hex');
    }
    receipt.installedRuntimeSha256 = hashes;
    receipt.checks.push('Installed archive contains runtime files and no credential-shaped material');

    await extension.activate();
    assert.equal(extension.isActive, true);
    const installedMain = await fs.realpath(path.join(installedRoot, extension.packageJSON.main));
    assert.ok(require.cache[installedMain], 'The active extension entry point must be the installed package');
    assert.equal(require.cache[path.join(sourceRoot, 'src', 'extension.js')], undefined);
    receipt.checks.push('Installed extension activated in real VS Code extension host');

    const commands = await vscode.commands.getCommands(true);
    const expectedCommands = extension.packageJSON.contributes.commands.map(command => command.command);
    for (const command of expectedCommands) assert.ok(commands.includes(command), `Registered command missing: ${command}`);
    receipt.commands = expectedCommands;
    receipt.checks.push('All contributed Atlas commands registered');

    // Exercise the installed extension's actual commands. The separate browser
    // and desktop UI gates cover rendered layout; this gate proves installed
    // activation and command wiring without an account or provider key.
    await vscode.commands.executeCommand('atlas.openOffice');
    await vscode.commands.executeCommand('atlas.refresh');
    await vscode.commands.executeCommand('atlas.refresh');
    await vscode.commands.executeCommand('atlas.disconnect');
    assert.equal(receipt.networkRequests, 0, 'An unpaired fresh profile must not dispatch requests');
    receipt.checks.push('Open Office command completed; disconnected refresh and disconnect stayed offline');

    const syntheticCredential = 'sk-ant-' + 'test-only-not-a-real-credential-1234567890';
    assert.equal(require(installedMain).safeMessage(new Error(syntheticCredential)), '[credential removed]');
    receipt.checks.push('Error display removes credential-shaped text');
    receipt.status = 'passed';
  } catch (error) {
    receipt.error = error instanceof Error ? error.message : 'Unknown installed smoke failure';
    throw error;
  } finally {
    globalThis.fetch = originalFetch;
    receipt.finishedAt = new Date().toISOString();
    await fs.writeFile(receiptPath, JSON.stringify(receipt, null, 2) + '\n');
  }
};

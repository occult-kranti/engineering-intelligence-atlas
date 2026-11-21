import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs, { constants } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const expectedVersion = '0.16.0';
const maxInputBytes = 20 * 1024 * 1024;
const maxOutputBytes = 40 * 1024 * 1024;
const timeoutMs = 45_000;
export const operations = Object.freeze(['inspect', 'import-html', 'convert-fig', 'export-svg']);

function inside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative !== '' && relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
}
function safeName(value, label) {
  assert.ok(typeof value === 'string' && value.length > 0 && value.length <= 1024 && !/[\0\r\n]/.test(value), `${label} must be a bounded local path`);
  assert.ok(!path.isAbsolute(value), `${label} must be relative to its configured workspace`);
  return value;
}
async function localDirectory(parent, name) {
  const directory = path.join(parent, name);
  try {
    const metadata = await fs.lstat(directory);
    assert.ok(metadata.isDirectory() && !metadata.isSymbolicLink(), 'Handoff directories must be ordinary local directories');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    await fs.mkdir(directory);
  }
  assert.equal(await fs.realpath(directory), directory, 'Handoff directories cannot traverse symlinked parents');
  return directory;
}
export function validateHtml(html) {
  assert.ok(!/<\s*(?:script|iframe|object|embed|link|base)\b|\bon[a-z]+\s*=|javascript\s*:|@import\b|\b(?:src|href)\s*=|url\s*\(/i.test(html), 'HTML import accepts static markup and inline CSS only; scripts, linked resources and event handlers are excluded');
}
export async function validateInput(workspace, input, operation) {
  assert.ok(operations.includes(operation), 'Choose inspect, import-html, convert-fig, or export-svg');
  const root = await fs.realpath(workspace);
  const candidate = path.resolve(root, safeName(input, 'Input'));
  assert.ok(inside(root, candidate), 'Input must stay inside the configured workspace');
  const metadata = await fs.lstat(candidate);
  assert.ok(metadata.isFile() && !metadata.isSymbolicLink() && metadata.nlink === 1, 'Input must be an ordinary file without symlinks or hard links');
  const real = await fs.realpath(candidate);
  assert.ok(inside(root, real), 'Input cannot traverse a linked directory outside the workspace');
  assert.ok(metadata.size > 0 && metadata.size <= maxInputBytes, 'Input must be nonempty and at most 20 MiB');
  const allowed = operation === 'import-html' ? ['.html', '.htm'] : ['.fig', '.pen'];
  assert.ok(allowed.includes(path.extname(real).toLowerCase()), 'Input format is not allowed for this operation');
  const bytes = await fs.readFile(real);
  if (operation === 'import-html') validateHtml(bytes.toString('utf8'));
  return { root, path: real, bytes };
}
function commandArguments(operation, input, output) {
  if (operation === 'inspect') return ['info', input, '--json'];
  if (operation === 'import-html') return ['import', input, '--format', 'fig', '--output', output, '--json'];
  if (operation === 'convert-fig') return ['convert', input, '--format', 'fig', '--output', output];
  return ['export', input, '--format', 'svg', '--output', output];
}
function cleanEnvironment(temporary) {
  const environment = {};
  for (const name of ['PATH', 'HOME', 'SystemRoot', 'WINDIR', 'TMPDIR', 'TEMP', 'TMP', 'LANG', 'LC_ALL', 'FONTCONFIG_PATH']) if (process.env[name]) environment[name] = process.env[name];
  return {...environment, NO_COLOR: '1', XDG_CONFIG_HOME: path.join(temporary, 'config'), XDG_CACHE_HOME: path.join(temporary, 'cache'), DAFTAR_DESIGN_NETWORK_RECEIPT: path.join(temporary, 'network.json')};
}
async function runCli(arguments_, temporary) {
  const toolManifest = JSON.parse(await fs.readFile(path.join(packageRoot, 'node_modules/@open-pencil/cli/package.json'), 'utf8'));
  assert.equal(toolManifest.version, expectedVersion, 'Run npm ci to use the verified OpenPencil version');
  const executable = path.join(packageRoot, 'node_modules/@open-pencil/cli/bin/openpencil.js');
  const guard = path.join(packageRoot, 'scripts/network-guard.mjs');
  await Promise.all([fs.mkdir(path.join(temporary, 'config')), fs.mkdir(path.join(temporary, 'cache'))]);
  const result = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--import', guard, executable, ...arguments_], {cwd: temporary, env: cleanEnvironment(temporary), shell: false, stdio: ['ignore', 'pipe', 'pipe']});
    const stdout = [], stderr = []; let bytes = 0, timedOut = false, exceeded = false;
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, timeoutMs);
    function collect(target, chunk) { bytes += chunk.length; if (bytes > 4 * 1024 * 1024) { exceeded = true; child.kill('SIGKILL'); } else target.push(chunk); }
    child.stdout.on('data', chunk => collect(stdout, chunk));
    child.stderr.on('data', chunk => collect(stderr, chunk));
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('close', (code, signal) => { clearTimeout(timer); resolve({code, signal, timedOut, exceeded, stdout: Buffer.concat(stdout).toString('utf8'), stderr: Buffer.concat(stderr).toString('utf8')}); });
  });
  assert.ok(!result.timedOut, 'OpenPencil operation exceeded its 45-second local parsing limit; input was preserved');
  assert.ok(!result.exceeded, 'OpenPencil output exceeded its 4 MiB log limit; input was preserved');
  if (result.code !== 0) throw new Error(`OpenPencil ${arguments_[0]} failed (exit ${result.code ?? result.signal}): ${result.stderr.replaceAll(temporary, '[temporary directory]').slice(0,1500)}`);
  const network = JSON.parse(await fs.readFile(path.join(temporary, 'network.json'), 'utf8'));
  assert.equal(network.attempts, 0, 'The selected file attempted network access; no handoff was published');
  return {...result, network};
}
export async function runDesignOperation({workspace, operation, input, output}) {
  const validated = await validateInput(workspace, input, operation);
  const work = await localDirectory(validated.root, '.work');
  const outputDirectory = await localDirectory(work, 'design-handoffs');
  const ledgerPath = path.join(outputDirectory, 'ledger.jsonl');
  try {
    const metadata = await fs.lstat(ledgerPath);
    assert.ok(metadata.isFile() && !metadata.isSymbolicLink() && metadata.nlink === 1, 'Handoff ledger must be an ordinary file without links');
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const ledger = await fs.open(ledgerPath, constants.O_WRONLY | constants.O_CREAT | constants.O_APPEND | (constants.O_NOFOLLOW ?? 0), 0o600);
  const ledgerMetadata = await ledger.stat();
  if (!ledgerMetadata.isFile() || ledgerMetadata.nlink !== 1) { await ledger.close(); throw new Error('Handoff ledger must be an ordinary file without links'); }
  const temporary = await fs.mkdtemp(path.join(outputDirectory, '.operation-'));
  const startedAt = new Date().toISOString();
  try {
    const extension = operation === 'inspect' ? '.json' : operation === 'export-svg' ? '.svg' : '.fig';
    const name = safeName(output || `${path.basename(input, path.extname(input))}-${operation}${extension}`, 'Output');
    assert.ok(path.basename(name) === name && path.extname(name) === extension, `Output must be a filename ending in ${extension}`);
    const destination = path.join(outputDirectory, name);
    try { await fs.lstat(destination); throw new Error('Output already exists; choose another handoff filename'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const temporaryOutput = path.join(temporary, 'output' + extension);
    // Copy the bounded input into the operation directory. Upstream code never
    // receives a caller-selected live document or a credential file path.
    const temporaryInput = path.join(temporary, 'input' + path.extname(input).toLowerCase());
    await fs.writeFile(temporaryInput, validated.bytes, {flag: 'wx'});
    const result = await runCli(commandArguments(operation, temporaryInput, temporaryOutput), temporary);
    if (operation === 'inspect') {
      const inspection = JSON.parse(result.stdout);
      await fs.writeFile(temporaryOutput, JSON.stringify(inspection, null, 2) + '\n', {flag: 'wx'});
    }
    const metadata = await fs.lstat(temporaryOutput);
    assert.ok(metadata.isFile() && !metadata.isSymbolicLink() && metadata.size > 0 && metadata.size <= maxOutputBytes, 'Handoff must be an ordinary file of at most 40 MiB');
    const data = await fs.readFile(temporaryOutput);
    if (operation === 'export-svg') assert.ok(/<svg[\s>]/.test(data.toString('utf8')), 'OpenPencil did not produce an SVG document');
    await fs.copyFile(temporaryOutput, destination, constants.COPYFILE_EXCL);
    const receipt = {
      schemaVersion: 1, tool: '@open-pencil/cli', toolVersion: expectedVersion, operation,
      input: path.relative(validated.root, validated.path), inputSha256: crypto.createHash('sha256').update(validated.bytes).digest('hex'),
      output: path.relative(validated.root, destination), outputBytes: metadata.size, outputSha256: crypto.createHash('sha256').update(data).digest('hex'),
      networkAttempts: result.network.attempts, providerCalls: 0, startedAt, finishedAt: new Date().toISOString(),
    };
    await ledger.appendFile(JSON.stringify(receipt) + '\n');
    return receipt;
  } finally { await ledger.close(); await fs.rm(temporary, {recursive: true, force: true}); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [operation, input, output, ...extra] = process.argv.slice(2);
  if (!operation || operation === '--help') console.log('Daftar local design handoff\n\nnode scripts/daftar-design.mjs <inspect|import-html|convert-fig|export-svg> <relative-input-file> [output-filename]\n\nRuns inside the current working directory. Outputs: .work/design-handoffs/. No eval, plugins, live-editor RPC or network commands are exposed.');
  else {
    assert.equal(extra.length, 0, 'Only operation, input path and optional output filename are accepted');
    const receipt = await runDesignOperation({workspace: process.cwd(), operation, input, output});
    console.log(JSON.stringify(receipt, null, 2));
  }
}

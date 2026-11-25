import { spawn } from 'node:child_process';
import { constants } from 'node:fs';
import { copyFile, lstat, mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { inspectGlb, sha256 } from './glb.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ensure = (ok, message) => { if (!ok) throw new Error(message); };

/** Compare observed scene geometry against actual input buffer data. */
export function compareReceipt(expected, engine) {
  const checks = [];
  const add = (name, passed, expectedValue, observed) => checks.push({ name, passed: !!passed, expected: expectedValue, observed });
  add('Godot 4', engine.engine?.major === 4, 4, engine.engine?.major);
  for (const key of ['vertices', 'triangles', 'indexCount', 'colourCount', 'meshInstances']) add(key, engine[key] === expected[key], expected[key], engine[key]);
  add('surface count', engine.surfaces?.length === expected.surfaces, expected.surfaces, engine.surfaces?.length);
  add('finite positions, colours and transforms', engine.allFinite === true, true, engine.allFinite);
  add('indices within imported vertices', engine.indicesValid === true, true, engine.indicesValid);
  add('immutable copied input', engine.sourceHashUnchanged === true && engine.inputSha256 === expected.inputSha256, expected.inputSha256, engine.inputSha256);
  const scale = Math.max(1, ...expected.worldBounds.minimum.map(Math.abs), ...expected.worldBounds.maximum.map(Math.abs));
  const tolerance = scale * 1e-5;
  for (const side of ['minimum', 'maximum']) {
    const observed = engine.worldBounds?.[side];
    const passed = observed?.length === 3 && observed.every((value, i) => Number.isFinite(value) && Math.abs(value - expected.worldBounds[side][i]) <= tolerance);
    add(`world bounds ${side}`, passed, { values: expected.worldBounds[side], tolerance }, observed);
  }
  return checks;
}

async function launchGodot(godot, project, timeoutMs) {
  const started = performance.now();
  const child = spawn(godot, ['--headless', '--path', project, '--script', 'res://audit.gd'], { shell: false, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, GODOT_SILENCE_ROOT_WARNING: '1' } });
  let log = '', sampledPeakRssBytes = null, timedOut = false;
  const capture = chunk => { if (log.length < 4 * 1024 ** 2) log += chunk.toString().slice(0, 4 * 1024 ** 2 - log.length); };
  child.stdout.on('data', capture); child.stderr.on('data', capture);
  const sampler = setInterval(() => {
    if (process.platform !== 'linux' || !child.pid) return;
    readFile(`/proc/${child.pid}/status`, 'utf8').then(status => {
      const match = status.match(/^VmRSS:\s+(\d+)\s+kB$/m);
      if (match) sampledPeakRssBytes = Math.max(sampledPeakRssBytes || 0, Number(match[1]) * 1024);
    }).catch(() => {});
  }, 50);
  const deadline = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, timeoutMs);
  try {
    const result = await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('close', (exitCode, signal) => resolve({ exitCode, signal }));
    });
    return { ...result, timedOut, wallMilliseconds: performance.now() - started, sampledPeakRssBytes, memoryMeaning: 'Linux VmRSS sampled every50ms; lower bound on process peak, not GPU or target-device memory', log };
  } finally { clearInterval(sampler); clearTimeout(deadline); }
}

/** Copy a selected local file into a fresh isolated project and run actual Godot. */
export async function runAudit({ input, output, godot = 'godot', expectedSha256, timeoutMs = 180000 }) {
  ensure(path.isAbsolute(input) && path.isAbsolute(output), 'Input and output must be absolute');
  ensure(await realpath(input) === input, 'Input must be canonical and symlink-free');
  const info = await lstat(input);
  ensure(info.isFile() && info.size > 0 && info.size <= 512 * 1024 ** 2, 'Expected bounded regular GLB');
  ensure(await realpath(path.dirname(output)) === path.dirname(output), 'Output parent must be an existing canonical directory');
  try { await lstat(output); throw new Error('Output already exists; no overwrite is permitted'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  ensure(Number.isInteger(timeoutMs) && timeoutMs >= 1000 && timeoutMs <= 600000, 'Timeout must be1000..600000ms');
  const sourceBytes = await readFile(input), expected = inspectGlb(sourceBytes);
  if (expectedSha256 !== undefined) ensure(/^[a-f0-9]{64}$/.test(expectedSha256) && expected.inputSha256 === expectedSha256, 'Input SHA256 does not match expected source');
  await mkdir(output);
  const project = path.join(output, 'project'); await mkdir(project); await mkdir(path.join(project, 'assets'));
  let processResult = null, engine = null, failure = null;
  try {
    await Promise.all(['project.godot', 'audit.gd'].map(name => copyFile(path.join(HERE, name), path.join(project, name), constants.COPYFILE_EXCL)));
    await writeFile(path.join(project, 'assets', 'source.glb'), sourceBytes, { flag: 'wx', mode: 0o444 });
    await writeFile(path.join(project, 'expected.json'), JSON.stringify(expected, null, 2) + '\n', { flag: 'wx' });
    processResult = await launchGodot(godot, project, timeoutMs);
    await writeFile(path.join(output, 'godot.log'), processResult.log, { flag: 'wx' });
    engine = JSON.parse(await readFile(path.join(project, 'engine-receipt.json'), 'utf8'));
    ensure(processResult.exitCode === 0 && !processResult.timedOut, `Godot failed (exit ${processResult.exitCode}, timeout ${processResult.timedOut})`);
  } catch (error) { failure = error.message; }
  const sourceAfter = sha256(await readFile(input));
  const copiedAfter = sha256(await readFile(path.join(project, 'assets', 'source.glb')));
  const checks = engine ? compareReceipt(expected, engine) : [];
  checks.push({ name: 'original input remains unchanged', passed: sourceAfter === expected.inputSha256, expected: expected.inputSha256, observed: sourceAfter });
  checks.push({ name: 'copied input remains unchanged', passed: copiedAfter === expected.inputSha256, expected: expected.inputSha256, observed: copiedAfter });
  const { log: _log, ...measurements } = processResult || {};
  const report = { schemaVersion: 1, ok: !failure && checks.every(c => c.passed), inputName: path.basename(input), inputSha256: expected.inputSha256, inputBytes: expected.inputBytes, expected, engine, process: measurements, checks, error: failure, fpsMeasured: false, targetDeviceProfiled: false, dataTransformAppliedByHarness: false, limitations: ['Runtime GLTFDocument path; editor import cache and automatic LOD generation are not tested.', 'Counts, finite colour values and colour presence are checked; colour-byte equivalence and image appearance are not established.', 'Import timing and sampled memory describe this host, not rendering FPS or a shipping-device budget.'] };
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  return report;
}

async function main() {
  const args = process.argv.slice(2), options = {};
  const allowed = { '--input': 'input', '--output': 'output', '--godot': 'godot', '--expected-sha256': 'expectedSha256', '--timeout-ms': 'timeoutMs' };
  for (let i = 0; i < args.length; i += 2) { ensure(allowed[args[i]] && args[i + 1], 'Usage: node run-audit.mjs --input /file.glb --output /new/dir [--godot /path] [--expected-sha256 hash]'); options[allowed[args[i]]] = args[i + 1]; }
  ensure(options.input && options.output, 'Input and output are required');
  if (options.timeoutMs) options.timeoutMs = Number(options.timeoutMs);
  const result = await runAudit(options);
  console.log(JSON.stringify({ ok: result.ok, inputSha256: result.inputSha256, triangles: result.engine?.triangles, failures: result.checks.filter(c => !c.passed), error: result.error, report: path.join(options.output, 'report.json') }, null, 2));
  if (!result.ok) process.exitCode = 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main().catch(error => { console.error(error.message); process.exitCode = 1; });

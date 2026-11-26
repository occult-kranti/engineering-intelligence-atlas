#!/usr/bin/env node
// Linux SSH launcher. It owns one separate tmux socket, not the user's tmux server.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { parseEnv } from 'node:util';
import { StringDecoder } from 'node:string_decoder';
import { pathToFileURL } from 'node:url';
import { readControlToken } from '../tools/daftar-runtime-mcp.mjs';

const SESSION = 'runtime';
const MAX_LOG_BYTES = 1024 * 1024;
const ENV_KEYS = new Set([
  'DAFTAR_CONTROL_TOKEN_FILE', 'DAFTAR_CORE_BINARY', 'DAFTAR_PYTHON_PATH', 'DAFTAR_PORT', 'DAFTAR_CONCURRENCY', 'DAFTAR_HOST_CONTROL',
  'OPENAI_API_KEY_FILE', 'ANTHROPIC_API_KEY_FILE', 'GITHUB_TOKEN_FILE',
  'DAFTAR_OLLAMA_BASE_URL', 'DAFTAR_OLLAMA_LOCAL_ONLY', 'DAFTAR_CLOUD_SYNC', 'DAFTAR_CLOUD_URL',
  'DAFTAR_CLOUD_PAIRING_FILE', 'DAFTAR_CLOUD_ENCRYPTION_KEY_FILE', 'DAFTAR_CLOUD_SYNC_INTERVAL_SECONDS',
  'DAFTAR_CLOUD_ALLOW_KNOWN_SCHEMA_DEFAULTS',
]);
export const HELP = `Usage: node deploy/tmux-runtime.mjs <action> [options]
  start --repo /absolute/checkout --data /absolute/private/data
        [--env-file /absolute/private/runtime.env] [--python /absolute/python3]
        [--enable-host-control] [--build]
  status --data /absolute/private/data
  stop --data /absolute/private/data
  attach --data /absolute/private/data

start is idempotent and does not change an already running session.
--python overrides the env-file Python setting for a new session; ambient Python settings are not inherited.
--build explicitly runs Cargo and TypeScript; it never installs npm dependencies.
The runtime stays on 127.0.0.1. Host control starts disabled unless explicitly enabled.
For a new data directory, a private control-token file is created automatically.
The tmux daemon does not restart itself or jobs after failure or machine reboot.
`;

class SetupError extends Error {
  constructor(message) { super(message); this.code = 'tmux_runtime_error'; }
}

function absolute(value, label) {
  if (typeof value !== 'string' || !path.isAbsolute(value) || value.includes('\0') || value.length > 4096) throw new SetupError(`${label} must be an absolute path.`);
  return path.resolve(value);
}

function pythonExecutable(value, label = '--python') {
  if (typeof value !== 'string' || /[\x00-\x1f\x7f]/.test(value)) throw new SetupError(`${label} must be an absolute executable path without control characters.`);
  return absolute(value, label);
}

function privateDirectory(directory, create = false) {
  if (create) fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const stat = fs.lstatSync(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink() || (stat.mode & 0o077)) throw new SetupError('Runtime data and supervisor directories must be private (0700), without symlinks.');
  return fs.realpathSync(directory);
}

function readPrivateFile(filename, limit = 32768) {
  let fd;
  try {
    const original = fs.lstatSync(filename);
    if (!original.isFile() || original.isSymbolicLink()) throw new Error();
    fd = fs.openSync(filename, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0) | (fs.constants.O_NONBLOCK || 0));
    const stat = fs.fstatSync(fd);
    if (!stat.isFile() || ![0o400, 0o600].includes(stat.mode & 0o777) || stat.size > limit) throw new Error();
    const buffer = Buffer.alloc(limit + 1);
    let length = 0;
    while (length < buffer.length) {
      const count = fs.readSync(fd, buffer, length, buffer.length - length, null);
      if (!count) break;
      length += count;
    }
    if (length > limit) throw new Error();
    return buffer.subarray(0, length).toString('utf8');
  } catch { throw new SetupError('A configuration file is missing, too large, or not a private regular file (0400/0600).'); }
  finally { if (fd !== undefined) fs.closeSync(fd); }
}

function writePrivateFile(filename, contents) {
  const temporary = `${filename}.${process.pid}.${crypto.randomBytes(5).toString('hex')}.tmp`;
  try {
    fs.writeFileSync(temporary, contents, { flag: 'wx', mode: 0o600 });
    fs.renameSync(temporary, filename);
  } finally { try { fs.unlinkSync(temporary); } catch {} }
}

export function readEnvironment(filename) {
  if (!filename) return {};
  const parsed = parseEnv(readPrivateFile(absolute(filename, '--env-file')));
  for (const [key, value] of Object.entries(parsed)) {
    if (!ENV_KEYS.has(key)) throw new SetupError(`Unsupported environment key ${key}. Use the documented file-based configuration; secret values are not accepted.`);
    if (value.includes('\0') || value.includes('\n') || value.includes('\r')) throw new SetupError('Configuration values must fit on one line.');
    if (key === 'DAFTAR_PYTHON_PATH' && value) pythonExecutable(value, key);
    else if ((key.endsWith('_FILE') || key === 'DAFTAR_CORE_BINARY') && value) absolute(value, key);
  }
  if (parsed.DAFTAR_HOST_CONTROL && !['0', '1'].includes(parsed.DAFTAR_HOST_CONTROL)) throw new SetupError('DAFTAR_HOST_CONTROL must be 0 or 1.');
  const port = Number(parsed.DAFTAR_PORT || 8788);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new SetupError('DAFTAR_PORT must be between 1024 and 65535.');
  return parsed;
}

export function sessionIdentity(data) {
  const canonical = absolute(data, '--data');
  const hash = crypto.createHash('sha256').update(canonical).digest('hex').slice(0, 20);
  return { socket: `daftar-runtime-${process.getuid?.() ?? 'user'}-${hash}`, session: SESSION };
}

function cleanEnvironment() {
  // The launcher can be the VS Code Electron executable in Node mode. Preserve
  // that fixed mode across the dedicated tmux server and daemon child; never
  // inherit NODE_OPTIONS, arbitrary Electron options, or provider credentials.
  const result = { ELECTRON_RUN_AS_NODE: '1' };
  for (const key of ['PATH', 'HOME', 'USER', 'LOGNAME', 'LANG', 'LC_ALL', 'TMPDIR', 'TERM']) {
    if (process.env[key] !== undefined) result[key] = process.env[key];
  }
  return result;
}

function tmux(identity, args, { interactive = false } = {}) {
  const result = spawnSync('tmux', ['-f', '/dev/null', '-L', identity.socket, ...args], {
    shell: false, env: cleanEnvironment(), stdio: interactive ? 'inherit' : 'pipe', encoding: 'utf8',
    ...(interactive ? {} : { timeout: 5000, maxBuffer: 65536 }),
  });
  if (result.error?.code === 'ENOENT') throw new SetupError('tmux is not installed. Install it using your operating system package manager.');
  if (result.error) throw new SetupError('The dedicated tmux operation failed.');
  return result;
}

function sessionExists(identity) { return tmux(identity, ['has-session', '-t', `=${SESSION}`]).status === 0; }
function paths(data) { return { dir: path.join(data, 'supervisor'), config: path.join(data, 'supervisor', 'config.json'), stop: path.join(data, 'supervisor', 'stop-request'), log: path.join(data, 'supervisor', 'runtime.log') }; }

export function shellQuote(value) {
  if (typeof value !== 'string' || value.includes('\0')) throw new SetupError('Invalid process argument.');
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function readConfiguration(data) {
  let value;
  try { value = JSON.parse(readPrivateFile(paths(data).config)); }
  catch { throw new SetupError('No valid private supervisor configuration exists for this data directory.'); }
  if (value.version !== 1 || value.data !== data || !Number.isInteger(value.port) || value.port < 1024 || value.port > 65535 || typeof value.hostControl !== 'boolean') throw new SetupError('Invalid supervisor configuration.');
  absolute(value.repo, 'repo'); absolute(value.tokenFile, 'token file');
  if (value.envFile) absolute(value.envFile, 'env file');
  if (Object.hasOwn(value, 'pythonPath') && value.pythonPath !== null) pythonExecutable(value.pythonPath, 'configured Python');
  return value;
}

function description(data, identity, running, configuration) {
  return { ok: true, running, socket: identity.socket, session: SESSION, dataDir: data,
    ...(configuration ? { repoRoot: configuration.repo, runtimeUrl: `http://127.0.0.1:${configuration.port}`, controlTokenFile: configuration.tokenFile, hostControlEnabled: configuration.hostControl,
      ...(Object.hasOwn(configuration, 'pythonPath') ? { pythonPath: configuration.pythonPath } : {}) } : {}),
    logFile: paths(data).log, notice: running ? 'tmux session exists; use host-control status to verify API readiness.' : 'No managed runtime tmux session is running.' };
}

export function status(dataInput) {
  const requested = absolute(dataInput, '--data');
  const data = fs.existsSync(requested) ? privateDirectory(requested) : requested;
  const identity = sessionIdentity(data);
  let configuration;
  if (fs.existsSync(paths(data).config)) configuration = readConfiguration(data);
  return description(data, identity, sessionExists(identity), configuration);
}

function build(repo) {
  const compiler = path.join(repo, 'desktop-shell/node_modules/typescript/bin/tsc');
  if (!fs.existsSync(compiler)) throw new SetupError('Install the checked-in desktop-shell dependencies explicitly before using --build.');
  for (const [command, args] of [['cargo', ['build', '--release', '--locked', '--manifest-path', path.join(repo, 'native-core/Cargo.toml')]], [process.execPath, [compiler, '-p', path.join(repo, 'headless-runtime/tsconfig.json')]]]) {
    const result = spawnSync(command, args, { cwd: repo, stdio: 'inherit', shell: false, env: cleanEnvironment() });
    if (result.error || result.status !== 0) throw new SetupError('Explicit runtime build failed; no daemon was started.');
  }
}

export function start({ repo: repoInput, data: dataInput, envFile, pythonPath, enableHostControl = false, build: shouldBuild = false }) {
  const repo = fs.realpathSync(absolute(repoInput, '--repo'));
  const requestedData = absolute(dataInput, '--data');
  // Probe tmux before creating credentials or doing a build.
  tmux(sessionIdentity(requestedData), ['-V']);
  const data = privateDirectory(requestedData, true);
  const identity = sessionIdentity(data);
  if (sessionExists(identity)) return status(data);
  const p = paths(data); privateDirectory(p.dir, true);
  const lock = path.join(p.dir, 'start.lock');
  try { fs.mkdirSync(lock, { mode: 0o700 }); }
  catch { throw new SetupError('Another start owns the supervisor lock. Inspect the directory before removing a stale start.lock.'); }
  try {
    if (sessionExists(identity)) return status(data);
    const source = envFile ? absolute(envFile, '--env-file') : null;
    const settings = readEnvironment(source);
    // Capture only explicit operator configuration. In particular, an editor's
    // startup environment is scrubbed across tmux and is never a config source.
    const selectedPython = pythonPath !== undefined ? pythonExecutable(pythonPath)
      : settings.DAFTAR_PYTHON_PATH ? pythonExecutable(settings.DAFTAR_PYTHON_PATH, 'DAFTAR_PYTHON_PATH') : null;
    if (!fs.statSync(path.join(repo, 'headless-runtime/server.mjs')).isFile()) throw new SetupError('The checkout does not contain the headless runtime.');
    if (shouldBuild) build(repo);
    const binary = settings.DAFTAR_CORE_BINARY || path.join(repo, 'native-core/target/release/atlas-core');
    for (const expected of [binary, path.join(repo, 'desktop-shell/dist/main/office.js')]) {
      if (!fs.existsSync(expected)) throw new SetupError('Runtime build artifacts are missing. Install dependencies explicitly, then use --build.');
    }
    const secretDirectory = path.join(data, 'secrets');
    let tokenFile = settings.DAFTAR_CONTROL_TOKEN_FILE;
    if (!tokenFile) {
      privateDirectory(secretDirectory, true);
      tokenFile = path.join(secretDirectory, 'control-token');
      try { fs.writeFileSync(tokenFile, `${crypto.randomBytes(48).toString('base64url')}\n`, { flag: 'wx', mode: 0o600 }); }
      catch (error) { if (error.code !== 'EEXIST') throw error; }
    }
    readControlToken(tokenFile);
    const configuration = { version: 1, repo, data, envFile: source, pythonPath: selectedPython, tokenFile, port: Number(settings.DAFTAR_PORT || 8788), hostControl: enableHostControl || settings.DAFTAR_HOST_CONTROL === '1' };
    writePrivateFile(p.config, `${JSON.stringify(configuration, null, 2)}\n`);
    try { fs.unlinkSync(p.stop); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const runner = path.join(repo, 'deploy/tmux-runtime.mjs');
    const command = [process.execPath, runner, '_run', '--data', data].map(shellQuote).join(' ');
    const launched = tmux(identity, ['new-session', '-d', '-s', SESSION, '-c', repo, command]);
    if (launched.status !== 0) throw new SetupError('Could not start the dedicated tmux session. Inspect private runtime logs.');
    tmux(identity, ['set-option', '-t', SESSION, 'history-limit', '1000']);
    return description(data, identity, sessionExists(identity), configuration);
  } finally { fs.rmdirSync(lock); }
}

// At most four 1-MiB log segments, regardless of runtime output volume.
export function rotatingLog(filename, maxBytes = MAX_LOG_BYTES) {
  let fd; let size = 0;
  const open = () => {
    fd = fs.openSync(filename, fs.constants.O_WRONLY | fs.constants.O_APPEND | fs.constants.O_CREAT | (fs.constants.O_NOFOLLOW || 0) | (fs.constants.O_NONBLOCK || 0), 0o600);
    const info = fs.fstatSync(fd);
    if (!info.isFile() || (info.mode & 0o077)) { fs.closeSync(fd); fd = undefined; throw new SetupError('Runtime log must be a private regular file.'); }
    size = info.size;
  };
  const rotate = () => {
    if (fd !== undefined) fs.closeSync(fd); fd = undefined;
    try { fs.unlinkSync(`${filename}.3`); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    for (let index = 2; index >= 0; index--) {
      const from = index ? `${filename}.${index}` : filename;
      try { fs.renameSync(from, `${filename}.${index + 1}`); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    open();
  };
  open();
  return { write(chunk) {
    const buffer = Buffer.from(chunk);
    for (let offset = 0; offset < buffer.length;) {
      if (size >= maxBytes) rotate();
      const count = Math.min(maxBytes - size, buffer.length - offset);
      fs.writeSync(fd, buffer, offset, count); size += count; offset += count;
    }
  }, close() { if (fd !== undefined) fs.closeSync(fd); fd = undefined; } };
}

export function redactedStream(token, emit) {
  const decoder = new StringDecoder('utf8');
  let pending = '';
  const drain = final => {
    // Keep a possible token prefix between chunks. Redacting each chunk alone
    // can leak a credential split across stdout/stderr data events.
    for (;;) {
      const index = pending.indexOf(token);
      if (index < 0) break;
      emit(`${pending.slice(0, index)}[control credential omitted]`);
      pending = pending.slice(index + token.length);
    }
    const count = final ? pending.length : Math.max(0, pending.length - token.length + 1);
    if (count) { emit(pending.slice(0, count)); pending = pending.slice(count); }
  };
  return { write(chunk) { pending += decoder.write(chunk); drain(false); }, end() { pending += decoder.end(); drain(true); } };
}

async function run(dataInput) {
  const data = privateDirectory(absolute(dataInput, '--data'));
  privateDirectory(paths(data).dir);
  const configuration = readConfiguration(data);
  const settings = readEnvironment(configuration.envFile);
  // New configurations capture the explicit interpreter override or its absence.
  // Legacy configurations without this field retain their env-file behavior.
  if (Object.hasOwn(configuration, 'pythonPath')) {
    if (configuration.pythonPath === null) delete settings.DAFTAR_PYTHON_PATH;
    else settings.DAFTAR_PYTHON_PATH = configuration.pythonPath;
  }
  const token = readControlToken(configuration.tokenFile);
  const env = { ...cleanEnvironment(), ...settings, DAFTAR_REPO_ROOT: configuration.repo, DAFTAR_DATA_DIR: data,
    DAFTAR_CONTROL_TOKEN_FILE: configuration.tokenFile, DAFTAR_HOST: '127.0.0.1', DAFTAR_PORT: String(configuration.port), DAFTAR_HOST_CONTROL: configuration.hostControl ? '1' : '0' };
  const log = rotatingLog(paths(data).log);
  const child = spawn(process.execPath, [path.join(configuration.repo, 'headless-runtime/server.mjs')], { cwd: configuration.repo, env, shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
  const output = safe => { try { log.write(safe); process.stdout.write(safe); } catch { stop(); } };
  const stdout = redactedStream(token, output); const stderr = redactedStream(token, output);
  child.stdout.on('data', chunk => stdout.write(chunk)); child.stderr.on('data', chunk => stderr.write(chunk));
  let stopping = false; let deadline;
  const stop = () => {
    if (stopping) return;
    stopping = true; child.kill('SIGTERM');
    deadline = setTimeout(() => child.kill('SIGKILL'), 8000);
  };
  const interval = setInterval(() => { if (fs.existsSync(paths(data).stop)) stop(); }, 250);
  process.once('SIGINT', stop); process.once('SIGTERM', stop); process.once('SIGHUP', stop);
  const exitCode = await new Promise(resolve => {
    child.once('error', () => resolve(1));
    child.once('close', code => resolve(code ?? (stopping ? 0 : 1)));
  });
  clearInterval(interval); clearTimeout(deadline); stdout.end(); stderr.end(); log.close();
  process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop); process.removeListener('SIGHUP', stop);
  return exitCode;
}

export async function stop(dataInput) {
  const current = status(dataInput);
  if (!current.running) return current;
  writePrivateFile(paths(current.dataDir).stop, 'stop\n');
  const identity = sessionIdentity(current.dataDir);
  const deadline = Date.now() + 12000;
  while (sessionExists(identity) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 250));
  const running = sessionExists(identity);
  return { ...description(current.dataDir, identity, running, readConfiguration(current.dataDir)), ok: !running,
    notice: running ? 'The managed session has not stopped. Inspect it; no unrelated tmux session was touched.' : 'Runtime stopped. Separately managed host jobs may remain; use host-control stop-all before stopping the API to cancel them.' };
}

function parseArguments(argv) {
  const [action, ...rest] = argv;
  if (!action || ['--help', '-h', 'help'].includes(action)) return { action: 'help' };
  if (!['start', 'status', 'stop', 'attach', '_run'].includes(action)) throw new SetupError('Unknown supervisor action. Run with --help.');
  const parsed = { action };
  for (let index = 0; index < rest.length; index++) {
    const key = rest[index];
    const name = ({ '--repo': 'repo', '--data': 'data', '--env-file': 'envFile', '--python': 'pythonPath', '--build': 'build', '--enable-host-control': 'enableHostControl' })[key];
    if (!name || Object.hasOwn(parsed, name) || (action !== 'start' && name !== 'data')) throw new SetupError('Unknown or repeated supervisor option.');
    if (['build', 'enableHostControl'].includes(name)) parsed[name] = true;
    else {
      const value = rest[++index];
      if (!value || value.startsWith('--')) throw new SetupError('Missing supervisor option value.');
      parsed[name] = value;
    }
  }
  absolute(parsed.data, '--data');
  if (action === 'start') absolute(parsed.repo, '--repo');
  return parsed;
}

export async function main(argv = process.argv.slice(2)) {
  try {
    if (process.platform !== 'linux') throw new SetupError('This launcher supports Linux SSH hosts.');
    const args = parseArguments(argv);
    if (args.action === 'help') { process.stdout.write(HELP); return 0; }
    if (args.action === '_run') return await run(args.data);
    if (args.action === 'attach') {
      const current = status(args.data);
      if (!current.running) throw new SetupError('The managed runtime is not running.');
      return tmux(sessionIdentity(current.dataDir), ['attach-session', '-t', `=${SESSION}`], { interactive: true }).status ?? 1;
    }
    const result = args.action === 'start' ? start(args) : args.action === 'stop' ? await stop(args.data) : status(args.data);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return result.ok ? 0 : 1;
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ ok: false, code: 'tmux_runtime_error', error: error instanceof SetupError ? error.message : 'Runtime supervisor failed. Check paths, private permissions, dependencies, and logs.' })}\n`);
    return 1;
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) process.exitCode = await main();

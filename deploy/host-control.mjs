#!/usr/bin/env node
// Owner CLI. Command bodies and credentials never need shell argument interpolation.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRuntimeClient, loadRuntimeConfig } from '../tools/daftar-runtime-mcp.mjs';
import { validateHostOperation } from '../headless-runtime/host-control-contract.mjs';

export const INPUT_LIMIT = 256 * 1024;
export const HELP = `Usage: node deploy/host-control.mjs <action> [options]
  status
  configure --file policy.json
  run --file job.json
  run --id ID --company ID --employee ID --cwd /absolute/path --command-file PATH|-
      [--timeout-seconds N] [--max-output-bytes N]
  inspect --id ID [--offset N]
  approve --id ID
  cancel --id ID
  stop-all

Read commands/JSON from a file, or '-' for stdin. No literal --command or --token.
Set DAFTAR_CONTROL_TOKEN_FILE to a private absolute token-file path.
DAFTAR_RUNTIME_URL defaults to http://127.0.0.1:8788.
Each request is sent once. Preserve the job ID after an uncertain response.
`;

class InputError extends Error {
  constructor(message) { super(message); this.code = 'invalid_cli_input'; }
}

function options(argv, allowed) {
  const parsed = Object.create(null);
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    if (!allowed.includes(key) || Object.hasOwn(parsed, key) || argv[i + 1] === undefined || argv[i + 1].startsWith('--')) {
      throw new InputError('Unknown, repeated, or incomplete option. Run with --help.');
    }
    parsed[key] = argv[i + 1];
  }
  return parsed;
}

function required(args, key) {
  const value = args[key];
  if (typeof value !== 'string' || !value || value.includes('\0')) throw new InputError(`Provide ${key}.`);
  return value;
}

function integer(value, name, min = 0) {
  if (!/^(0|[1-9][0-9]*)$/.test(value || '') || !Number.isSafeInteger(Number(value)) || Number(value) < min) {
    throw new InputError(`${name} must be a whole number of at least ${min}.`);
  }
  return Number(value);
}

export async function readInput(filename, stdin = process.stdin) {
  if (filename === '-') {
    if (stdin.isTTY) throw new InputError('Pipe command or JSON contents into stdin.');
    const chunks = []; let bytes = 0;
    for await (const value of stdin) {
      const chunk = Buffer.from(value); bytes += chunk.length;
      if (bytes > INPUT_LIMIT) throw new InputError('Input exceeds 256 KiB.');
      chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString('utf8');
  }
  let fd;
  try {
    const original = fs.lstatSync(filename);
    if (!original.isFile() || original.isSymbolicLink()) throw new InputError('Input must be a regular file, without a symlink.');
    fd = fs.openSync(filename, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0) | (fs.constants.O_NONBLOCK || 0));
    const info = fs.fstatSync(fd);
    if (!info.isFile() || info.size > INPUT_LIMIT) throw new InputError('Input must be a regular file no larger than 256 KiB.');
    const buffer = Buffer.alloc(INPUT_LIMIT + 1);
    let length = 0;
    while (length < buffer.length) {
      const read = fs.readSync(fd, buffer, length, buffer.length - length, null);
      if (!read) break;
      length += read;
    }
    if (length > INPUT_LIMIT) throw new InputError('Input exceeds 256 KiB.');
    return buffer.subarray(0, length).toString('utf8');
  } catch (error) {
    if (error instanceof InputError) throw error;
    throw new InputError('Could not read the input file. Use a regular file, without a symlink.');
  } finally { if (fd !== undefined) fs.closeSync(fd); }
}

async function jsonInput(filename, stdin) {
  let value;
  try { value = JSON.parse(await readInput(filename, stdin)); }
  catch (error) {
    if (error instanceof InputError) throw error;
    throw new InputError('Input must contain valid JSON.');
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new InputError('Input must be a JSON object.');
  return value;
}

async function prepareInput(argv, { stdin = process.stdin } = {}) {
  const [action, ...rest] = argv;
  if (!action || ['help', '--help', '-h'].includes(action)) {
    if (rest.length) throw new InputError('Help takes no other arguments.');
    return { help: true };
  }
  if (action === 'status' || action === 'stop-all') {
    options(rest, []);
    return action === 'status' ? { method: 'GET', route: '/v1/host' }
      : { method: 'POST', route: '/v1/host/stop-all', body: {} };
  }
  if (action === 'configure') {
    const args = options(rest, ['--file']);
    const body = await jsonInput(required(args, '--file'), stdin);
    if (!Number.isSafeInteger(body.expectedRevision) || body.expectedRevision < 0) {
      throw new InputError('Policy JSON must contain its explicit expectedRevision. Read status before preparing it.');
    }
    if (!['off', 'manual', 'auto'].includes(body.mode) || !Array.isArray(body.grants)) throw new InputError('Policy JSON requires mode off|manual|auto and a grants array.');
    return { method: 'POST', route: '/v1/host/configure', body };
  }
  if (action === 'run') {
    const args = options(rest, ['--file', '--id', '--company', '--employee', '--cwd', '--command-file', '--timeout-seconds', '--max-output-bytes']);
    let body;
    if (Object.hasOwn(args, '--file')) {
      if (Object.keys(args).length !== 1) throw new InputError('--file cannot be combined with other run options.');
      body = await jsonInput(args['--file'], stdin);
    } else {
      body = { id: required(args, '--id'), companyId: required(args, '--company'), employeeId: required(args, '--employee'),
        cwd: required(args, '--cwd'), command: await readInput(required(args, '--command-file'), stdin) };
      if (args['--timeout-seconds'] !== undefined) body.timeoutSeconds = integer(args['--timeout-seconds'], '--timeout-seconds', 1);
      if (args['--max-output-bytes'] !== undefined) body.maxOutputBytes = integer(args['--max-output-bytes'], '--max-output-bytes', 1);
    }
    if (typeof body.id !== 'string' || !body.id || typeof body.command !== 'string' || !body.command.trim()
        || typeof body.cwd !== 'string' || !path.isAbsolute(body.cwd)) throw new InputError('A run requires a stable id, a nonempty command, and an absolute cwd.');
    if (Buffer.byteLength(JSON.stringify(body)) > INPUT_LIMIT) throw new InputError('Job JSON exceeds 256 KiB.');
    return { method: 'POST', route: '/v1/host/submit', body };
  }
  if (['inspect', 'approve', 'cancel'].includes(action)) {
    const args = options(rest, action === 'inspect' ? ['--id', '--offset'] : ['--id']);
    const body = { id: required(args, '--id') };
    if (args['--offset'] !== undefined) body.offset = integer(args['--offset'], '--offset');
    return { method: 'POST', route: `/v1/host/${action}`, body };
  }
  throw new InputError('Unknown action. Run with --help.');
}

export async function prepareRequest(argv, options = {}) {
  const prepared = await prepareInput(argv, options);
  if (prepared.help) return prepared;
  const operation = prepared.route === '/v1/host' ? 'status'
    : prepared.route.endsWith('/stop-all') ? 'stopAll' : prepared.route.split('/').at(-1);
  // Validate with the HTTP/MCP contract before any I/O, retaining the caller's
  // exact body and explicit policy revision for stable retry identity.
  validateHostOperation(operation, prepared.body ?? {});
  return prepared;
}

export async function main(argv = process.argv.slice(2), { env = process.env, stdin = process.stdin, stdout = process.stdout, stderr = process.stderr, request } = {}) {
  try {
    const prepared = await prepareRequest(argv, { stdin });
    if (prepared.help) { stdout.write(HELP); return 0; }
    const send = request || createRuntimeClient(loadRuntimeConfig(env));
    const value = await send(prepared.method, prepared.route, prepared.body);
    stdout.write(`${JSON.stringify(value, null, 2)}\n`);
    return 0;
  } catch (error) {
    const known = typeof error?.code === 'string';
    stderr.write(`${JSON.stringify({ ok: false, code: known ? error.code : 'cli_failed', error: known ? error.message : 'Host-control request failed.' })}\n`);
    return 1;
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  process.exitCode = await main();
}

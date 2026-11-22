import fs from 'node:fs/promises';
import path from 'node:path';

const WRAPPER_LIMIT = 32 * 1024;
const text = value => String(value ?? '').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '?');
const redact = value => text(value).replace(/(?:sk-ant-|sk-proj-|sk-|github_pat_|gh[pousr]_)[A-Za-z0-9_-]+/g, '[credential omitted]');
const inside = (root, candidate) => {
  const relative = path.relative(root, candidate);
  return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
};
async function regularFile(filename) {
  const stat = await fs.lstat(filename);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Expected a regular downloaded VS Code file: ${text(filename).slice(0, 500)}`);
  return stat;
}

/**
 * @vscode/test-electron resolves Windows archives to bin/code[...].cmd.
 * Read that downloaded launcher as data; never execute it through cmd.exe.
 * Its declared CLI entry is authoritative, rather than an assumed .js/.mjs name.
 */
export async function resolveWindowsCliEntry(executable, launcher) {
  if (!path.isAbsolute(executable) || !path.isAbsolute(launcher)) throw new Error('Downloaded VS Code and launcher paths must be absolute.');
  await regularFile(executable);
  const root = await fs.realpath(path.dirname(executable));
  const wrapperStat = await regularFile(launcher);
  const wrapper = await fs.realpath(launcher);
  if (!inside(root, wrapper) || !/^bin\/code(?:-insiders)?\.cmd$/i.test(path.relative(root, wrapper).split(path.sep).join('/'))) throw new Error('The Windows CLI launcher must be the downloaded bundle’s bin/code.cmd or bin/code-insiders.cmd.');
  if (wrapperStat.size > WRAPPER_LIMIT) throw new Error('The downloaded Windows CLI launcher exceeds its bounded size.');
  const source = await fs.readFile(wrapper, 'utf8');
  if (Buffer.byteLength(source) > WRAPPER_LIMIT || source.includes('\0')) throw new Error('Invalid downloaded Windows CLI launcher text.');
  const lines = source.replace(/^\uFEFF/, '').split(/\r?\n/);
  if (!lines.some(line => /^\s*set\s+ELECTRON_RUN_AS_NODE\s*=\s*1\s*$/i.test(line))) throw new Error('The downloaded Windows launcher does not declare Electron Node mode.');
  const calls = lines.map(line => /^\s*@?"(%~dp0[^"\r\n]+)"\s+"(%~dp0[^"\r\n]+)"\s+%\*\s*$/i.exec(line)).filter(Boolean);
  if (calls.length !== 1) throw new Error('Unsupported Windows launcher layout: expected one declared executable and CLI module invocation.');
  const declared = calls[0].slice(1);
  const resolveDeclared = value => {
    const suffix = value.replace(/^%~dp0/i, '');
    // Only literal relative path components are supported. Environment expansion,
    // delayed expansion, shell escapes, drive/UNC paths and extra flags fail closed.
    if (!/^[A-Za-z0-9_. /\\-]+$/.test(suffix) || /^[\\/]/.test(suffix)) throw new Error('Unsafe substitution or path in the downloaded Windows launcher.');
    const parts = suffix.split(/[\\/]/);
    if (parts.some(part => !part)) throw new Error('Invalid relative path in the downloaded Windows launcher.');
    const filename = path.resolve(path.dirname(wrapper), ...parts);
    if (!inside(root, filename)) throw new Error('The declared Windows CLI path escapes the downloaded VS Code bundle.');
    return filename;
  };
  const declaredExecutable = resolveDeclared(declared[0]);
  const entry = resolveDeclared(declared[1]);
  if (await fs.realpath(declaredExecutable) !== await fs.realpath(executable)) throw new Error('The Windows launcher declares a different executable than the pinned download.');
  await regularFile(entry);
  const realEntry = await fs.realpath(entry);
  if (!inside(root, realEntry) || !/^resources\/app\/out\/.+\.(?:js|mjs|cjs)$/i.test(path.relative(root, realEntry).split(path.sep).join('/'))) throw new Error('The declared CLI module must remain in the downloaded resources/app/out tree.');
  return { executable, launcher: wrapper, entry: realEntry };
}

export function installDiagnostics(result, context = {}) {
  const lines = ['VS Code extension installation diagnostics'];
  for (const key of ['executable', 'launcher', 'entry']) if (context[key]) lines.push(`${key}: ${redact(context[key]).slice(0, 600)}`);
  lines.push(`status: ${Number.isInteger(result.status) ? result.status : 'unavailable'}`, `signal: ${redact(result.signal || 'none').slice(0, 80)}`);
  if (result.error) lines.push(`error: ${redact(result.error.message || result.error).slice(0, 2000)}`);
  for (const channel of ['stdout', 'stderr']) {
    const content = redact(result[channel] || '');
    lines.push(`${channel}${content.length > 12000 ? ' (last 12000 characters)' : ''}:\n${content.slice(-12000)}`);
  }
  return lines.join('\n') + '\n';
}

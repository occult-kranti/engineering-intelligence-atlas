import fs from 'node:fs';
import path from 'node:path';
import { RuntimeError, TOKEN_PATTERN } from './contract.mjs';

/** Read an administrator-supplied secret file; never pretend to be an OS keychain. */
export function readSecretFile(filename, { controlToken = false } = {}) {
  if (typeof filename !== 'string' || !path.isAbsolute(filename)) {
    throw new RuntimeError('SECRET_UNAVAILABLE', 'Configure an absolute secret-file path.', 503);
  }
  let fd;
  try {
    const info = fs.lstatSync(filename);
    if (!info.isFile() || info.isSymbolicLink()) throw new Error('not a regular file');
    fd = fs.openSync(filename, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
    const opened = fs.fstatSync(fd);
    if (!opened.isFile() || opened.size > 16384 || opened.size < 1 ||
        (process.platform !== 'win32' && ![0o400, 0o600].includes(opened.mode & 0o777))) {
      throw new Error('insecure secret permissions');
    }
    const raw = fs.readFileSync(fd, 'utf8');
    const value = raw.trim();
    if (!value || /[\s\0]/.test(value) || (controlToken && !TOKEN_PATTERN.test(value))) {
      throw new Error('invalid secret');
    }
    if (controlToken && !/^[A-Za-z0-9_-]{32,256}(?:\r?\n)?$/.test(raw)) throw new Error('invalid control token');
    return value;
  } catch {
    throw new RuntimeError('SECRET_UNAVAILABLE',
      'Secret file is unavailable or invalid. Use a readable regular file with mode 0400 or 0600; control tokens need 32–256 base64url characters.', 503);
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

export function providerSecretFiles(env = process.env) {
  return Object.fromEntries([
    ['openai', env.OPENAI_API_KEY_FILE],
    ['anthropic', env.ANTHROPIC_API_KEY_FILE],
    ['github', env.GITHUB_TOKEN_FILE],
  ].filter(([, filename]) => typeof filename === 'string' && filename.trim()));
}

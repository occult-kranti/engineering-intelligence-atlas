/**
 * Language sync for artifact diff/apply: map a file extension to a VS Code
 * language id so the applied document can be synced to the target language.
 * Pure module.
 */

const EXT_TO_LANGUAGE: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescriptreact',
  js: 'javascript',
  jsx: 'javascriptreact',
  mjs: 'javascript',
  cjs: 'javascript',
  py: 'python',
  json: 'json',
  jsonc: 'jsonc',
  md: 'markdown',
  css: 'css',
  html: 'html',
  yml: 'yaml',
  yaml: 'yaml',
  rs: 'rust',
  go: 'go',
  java: 'java',
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  hpp: 'cpp',
  cs: 'csharp',
  sh: 'shellscript',
  toml: 'toml',
  xml: 'xml',
  sql: 'sql',
};

export function languageIdForPath(relativePath: string): string | null {
  const base = relativePath.split('/').pop() ?? '';
  const dot = base.lastIndexOf('.');
  if (dot <= 0 || dot === base.length - 1) return null;
  const ext = base.slice(dot + 1).toLowerCase();
  return EXT_TO_LANGUAGE[ext] ?? null;
}

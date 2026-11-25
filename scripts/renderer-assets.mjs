// Renderer asset graph helper.
//
// Supported ESM syntax (intentionally bounded; anything else fails closed):
//   import x from './a.js';  import './a.js';  import {a} from './a.js';
//   import * as n from './a.js';  export {a} from './a.js';  export * from './a.js';
// Only relative specifiers (./ or ../) resolve. Bare/absolute/URL specifiers and
// dynamic import() or import.meta are rejected. Strings, template literals and
// comments are skipped by a small scanner so prose is never parsed as imports.
// Nothing is evaluated, fetched or executed.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

export const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
export const hashName = (name, bytes) => name.replace(/(\.[^./]+)$/, `.${digest(bytes).slice(0, 16)}$1`);
const isIdent = (c) => c !== undefined && /[A-Za-z0-9_$]/.test(c);
const posix = (p) => p.split(sep).join('/');

// Returns [{start,end,spec}] for each module specifier literal (inside quotes).
export function scanImports(src, label = 'module') {
  const out = [];
  const n = src.length;
  const fail = (m) => { throw new Error(`${label}: ${m}`); };
  const skipString = (i) => {
    const q = src[i];
    let j = i + 1;
    while (j < n && src[j] !== q) {
      if (src[j] === '\\') j++;
      if (src[j] === '\n' && q !== '`') fail('unterminated string');
      j++;
    }
    if (j >= n) fail('unterminated string');
    return j + 1;
  };
  const skipWs = (i) => {
    for (;;) {
      while (i < n && /\s/.test(src[i])) i++;
      if (src.startsWith('//', i)) { while (i < n && src[i] !== '\n') i++; continue; }
      if (src.startsWith('/*', i)) { const e = src.indexOf('*/', i + 2); if (e < 0) fail('unterminated comment'); i = e + 2; continue; }
      return i;
    }
  };
  const spec = (i) => {
    i = skipWs(i);
    if (src[i] !== '"' && src[i] !== "'") fail('unsupported import form');
    const end = skipString(i);
    out.push({ start: i + 1, end: end - 1, spec: src.slice(i + 1, end - 1) });
    return end;
  };
  // Regex-literal vs division heuristic: a slash after one of these tokens starts a regex.
  let prevSig = '';
  let i = 0;
  while (i < n) {
    const c = src[i];
    if (src.startsWith('//', i)) { while (i < n && src[i] !== '\n') i++; continue; }
    if (src.startsWith('/*', i)) { const e = src.indexOf('*/', i + 2); if (e < 0) fail('unterminated comment'); i = e + 2; continue; }
    if (c === '"' || c === "'" || c === '`') { i = skipString(i); prevSig = 'str'; continue; }
    if (c === '/' && (prevSig === '' || /[(,=:[!&|?{};+\-*%<>~^]/.test(prevSig) || ['return', 'typeof'].includes(prevSig))) {
      let j = i + 1; let cls = false;
      while (j < n && (cls || src[j] !== '/')) {
        if (src[j] === '\\') j++; else if (src[j] === '[') cls = true; else if (src[j] === ']') cls = false;
        if (src[j] === '\n') fail('unterminated regular expression');
        j++;
      }
      i = j + 1; prevSig = 'str'; continue;
    }
    if (/[A-Za-z_$]/.test(c)) {
      let j = i; while (j < n && isIdent(src[j])) j++;
      const word = src.slice(i, j);
      const dotted = prevSig === '.';
      if (!dotted && word === 'import') {
        const k = skipWs(j);
        if (src[k] === '(') fail('dynamic import() is not supported');
        if (src[k] === '.') fail('import.meta is not supported');
        if (src[k] === '"' || src[k] === "'") { i = spec(k); prevSig = 'str'; continue; }
        // import <clause> from '...'
        let m = k;
        while (m < n && !(src.startsWith('from', m) && !isIdent(src[m - 1]) && !isIdent(src[m + 4]))) {
          if (src[m] === '"' || src[m] === "'" || src[m] === '`') fail('unsupported import form');
          if (src[m] === ';') fail('unsupported import form');
          m++;
        }
        if (m >= n) fail('unsupported import form');
        i = spec(m + 4); prevSig = 'str'; continue;
      }
      if (!dotted && word === 'export') {
        // Only re-exports (`export ... from`) carry specifiers. Scan the clause only when braces/star follow.
        const k = skipWs(j);
        if (src[k] === '*' || src[k] === '{') {
          let m = k; let depth = 0;
          while (m < n) {
            if (src[m] === '{') depth++;
            else if (src[m] === '}') { depth--; if (depth <= 0 && src[m] === '}') { m++; break; } }
            else if (src[m] === '"' || src[m] === "'") { m = skipString(m); continue; }
            else if (src[m] === '*' && depth === 0) { m++; if (/\s/.test(src[m])) { const t = skipWs(m); if (src.startsWith('as', t)) { m = t + 2; m = skipWs(m); while (isIdent(src[m])) m++; } } break; }
            m++;
          }
          const t = skipWs(m);
          if (src.startsWith('from', t) && !isIdent(src[t + 4])) { i = spec(t + 4); prevSig = 'str'; continue; }
        }
      }
      i = j; prevSig = word; continue;
    }
    if (!/\s/.test(c)) prevSig = c;
    i++;
  }
  return out;
}

/**
 * Build content-addressed assets.
 * rootDir: renderer directory; entries: explicit relative paths (posix) of JS/CSS/other files.
 * Returns { files: Map<hashedPath, Buffer>, names: Map<originalPath, hashedPath> }.
 * JS files that contain ESM import/export-from are rewritten; classic scripts and other
 * assets keep their bytes (only their names are hashed).
 */
export function buildAssetGraph(rootDir, entries, options = {}) {
  const root = resolve(rootDir);
  const overrides = options.overrides ?? new Map(); // original path -> Buffer replacement bytes
  const names = new Map();
  const files = new Map();
  const state = new Map(); // path -> 'visiting' | 'done'
  const inside = (abs) => abs === root || abs.startsWith(root + sep);
  const normalize = (p) => posix(relative(root, resolve(root, p)));
  const visit = (rel, from) => {
    rel = normalize(rel);
    const abs = resolve(root, rel);
    if (!inside(abs)) throw new Error(`Asset escapes renderer tree: ${rel}`);
    if (state.get(rel) === 'done') return names.get(rel);
    if (state.get(rel) === 'visiting') throw new Error(`Import cycle detected at ${rel}`);
    const bytes = overrides.get(rel) ?? (existsSync(abs) ? readFileSync(abs) : null);
    if (!bytes) throw new Error(`Missing dependency ${rel}${from ? ` imported by ${from}` : ''}`);
    state.set(rel, 'visiting');
    let out = bytes;
    if (/\.m?js$/.test(rel)) {
      const text = bytes.toString('utf8');
      const found = scanImports(text, rel);
      if (found.length) {
        let rewritten = ''; let last = 0;
        for (const f of found) {
          if (!(f.spec.startsWith('./') || f.spec.startsWith('../'))) throw new Error(`${rel}: unsupported non-relative import "${f.spec}"`);
          if (/[?#]/.test(f.spec)) throw new Error(`${rel}: query/hash imports are unsupported ("${f.spec}")`);
          const target = posix(join(dirname(rel), f.spec));
          if (!inside(resolve(root, target))) throw new Error(`${rel}: import "${f.spec}" escapes the renderer tree`);
          const hashed = visit(target, rel);
          const base = hashed.split('/').pop();
          const prefix = f.spec.slice(0, f.spec.lastIndexOf('/') + 1);
          rewritten += text.slice(last, f.start) + prefix + base;
          last = f.end;
        }
        out = Buffer.from(rewritten + text.slice(last));
      }
    }
    const hashed = posix(join(dirname(rel), hashName(rel.split('/').pop(), out)));
    names.set(rel, hashed); files.set(hashed, out); state.set(rel, 'done');
    return hashed;
  };
  for (const entry of entries) visit(entry, null);
  return { files, names };
}

// Collect local script/link roots from HTML (non-URL, non-absolute, non-query).
export function htmlRoots(html) {
  const roots = [];
  const re = /<(?:script|link)\b[^>]*?\b(?:src|href)=(["'])(\.\/[^"'?#]+)\1[^>]*>/gi;
  for (const m of html.matchAll(re)) {
    if (/<link\b/i.test(m[0]) && !/rel=(["'])stylesheet\1/i.test(m[0])) continue;
    if (!roots.includes(m[2].slice(2))) roots.push(m[2].slice(2));
  }
  return roots;
}

// Replace each local root reference in the HTML exactly once.
export function rewriteHtml(html, names, roots) {
  for (const root of roots) {
    const hashed = names.get(root);
    const re = new RegExp(`(["'])\\./${root.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\1`, 'g');
    if ([...html.matchAll(re)].length !== 1) throw new Error(`Expected one HTML reference to ${root}.`);
    html = html.replace(re, (_, q) => `${q}./${hashed}${q}`);
  }
  return html;
}

// Write assets and prune only owned generated module subtrees + legacy root files.
export function writeAssets(destDir, files, { prune = () => false } = {}) {
  mkdirSync(destDir, { recursive: true });
  const prior = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, e.name);
      const rel = posix(relative(destDir, full));
      if (e.isDirectory()) { if (rel === 'freeflow' || rel === 'resource-library') rmSync(full, { recursive: true, force: true }); continue; }
      if (prune(rel)) prior.push(full);
    }
  };
  walk(destDir);
  for (const p of prior) rmSync(p);
  for (const [path, bytes] of files) {
    const out = join(destDir, path);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, bytes);
  }
}

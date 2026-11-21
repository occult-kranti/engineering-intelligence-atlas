import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildAssetGraph, scanImports, htmlRoots, rewriteHtml } from './renderer-assets.mjs';

function fixture(files) {
  const dir = mkdtempSync(join(tmpdir(), 'renderer-assets-'));
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(join(dir, name, '..'), { recursive: true });
    writeFileSync(join(dir, name), text);
  }
  return dir;
}
const text = (graph, name) => graph.files.get(graph.names.get(name)).toString();

test('rewrites nested dependencies and resolves relative paths', () => {
  const dir = fixture({
    'chrome.js': "import { a } from './freeflow/studio.js';\nconsole.log(a);\n",
    'freeflow/studio.js': "import { b } from './camera.js';\nexport { c } from '../util.js';\nexport const a = b;\n",
    'freeflow/camera.js': 'export const b = 1;\n',
    'util.js': 'export const c = 2;\n',
  });
  const g = buildAssetGraph(dir, ['chrome.js']);
  assert.match(text(g, 'chrome.js'), /from '\.\/studio\.[0-9a-f]{16}\.js'|from '\.\/freeflow\/studio\.[0-9a-f]{16}\.js'/);
  assert.match(text(g, 'freeflow/studio.js'), /\.\/camera\.[0-9a-f]{16}\.js/);
  assert.match(text(g, 'freeflow/studio.js'), /\.\.\/util\.[0-9a-f]{16}\.js/);
  assert.ok(g.names.get('freeflow/camera.js').startsWith('freeflow/camera.'));
});

test('leaf bytes propagate to importer hashes and builds are deterministic', () => {
  const files = { 'a.js': "import './b.js';\n", 'b.js': 'export const x = 1;\n' };
  const one = buildAssetGraph(fixture(files), ['a.js']);
  const two = buildAssetGraph(fixture(files), ['a.js']);
  assert.deepEqual([...one.names], [...two.names]);
  const changed = buildAssetGraph(fixture({ ...files, 'b.js': 'export const x = 2;\n' }), ['a.js']);
  assert.notEqual(one.names.get('a.js'), changed.names.get('a.js'));
});

test('classic scripts and css keep bytes', () => {
  const src = "var s = 'import x from \"./nope.js\"';\n";
  const dir = fixture({ 'classic.js': src, 'freeflow.css': 'body{}\n' });
  const g = buildAssetGraph(dir, ['classic.js', 'freeflow.css']);
  assert.equal(text(g, 'classic.js'), src);
  assert.equal(text(g, 'freeflow.css'), 'body{}\n');
});

test('rejects missing dependency, cycle and traversal', () => {
  assert.throws(() => buildAssetGraph(fixture({ 'a.js': "import './gone.js';" }), ['a.js']), /Missing dependency/);
  assert.throws(() => buildAssetGraph(fixture({ 'a.js': "import './b.js';", 'b.js': "import './a.js';" }), ['a.js']), /cycle/);
  assert.throws(() => buildAssetGraph(fixture({ 'a.js': "import '../outside.js';" }), ['a.js']), /escapes/);
});

test('rejects bare, external, absolute and dynamic imports', () => {
  for (const bad of ["import 'react';", "import x from 'https://e.com/x.js';", "import '/abs.js';", "import('./x.js');"]) {
    assert.throws(() => buildAssetGraph(fixture({ 'a.js': bad }), ['a.js']), /unsupported|dynamic|Missing|not supported/);
  }
});

test('does not parse import-looking prose in strings, comments or templates', () => {
  const src = [
    "// import x from './nope.js'",
    "/* import './nope2.js' */",
    "const a = \"import y from './nope3.js'\";",
    'const b = `export * from "./nope4.js"`;',
    'obj.import(1);',
    '',
  ].join('\n');
  assert.deepEqual(scanImports(src), []);
  const g = buildAssetGraph(fixture({ 'a.js': src }), ['a.js']);
  assert.equal(text(g, 'a.js'), src);
});

test('html roots are discovered and rewritten exactly once', () => {
  const html = '<link rel="stylesheet" href="./a.css"><script type="module" src="./a.js"></script><script src="https://x/y.js"></script>';
  const roots = htmlRoots(html);
  assert.deepEqual(roots, ['a.css', 'a.js']);
  const g = buildAssetGraph(fixture({ 'a.css': 'x{}', 'a.js': 'var a;' }), roots);
  const out = rewriteHtml(html, g.names, roots);
  assert.match(out, /\.\/a\.[0-9a-f]{16}\.css/);
  assert.match(out, /https:\/\/x\/y\.js/);
});

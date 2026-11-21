// Test-only bounded CommonJS module loader for dist/renderer ES modules.
// Transpiles with the repo's TypeScript (transpileModule) and evaluates inside the JSDOM window realm.
// No network, no arbitrary require: only relative specifiers that resolve to existing
// files inside the renderer root. JSDOM does not prove visual layout; this proves behavior only.
import {readFileSync, existsSync, realpathSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';

const nodeRequire = createRequire(import.meta.url);
const ts = nodeRequire('typescript');

export function createModuleLoader(window, rendererRoot) {
  const root = realpathSync(path.resolve(rendererRoot));
  const cache = new Map();
  const inside = (abs) => abs === root || abs.startsWith(root + path.sep);
  function resolveFile(spec, fromFile) {
    if (!(spec.startsWith('./') || spec.startsWith('../'))) throw new Error(`Module loader: non-relative import "${spec}" in ${fromFile} is not allowed`);
    if (/[?#]/.test(spec)) throw new Error(`Module loader: query/hash import "${spec}" is not allowed`);
    const abs = path.resolve(path.dirname(fromFile), spec);
    if (!inside(abs)) throw new Error(`Module loader: "${spec}" escapes the renderer root`);
    if (!/\.js$/.test(abs)) throw new Error(`Module loader: only .js modules may be imported ("${spec}")`);
    if (!existsSync(abs)) throw new Error(`Module loader: missing dependency "${spec}" imported by ${path.relative(root, fromFile)}`);
    const real = realpathSync(abs);
    if (!inside(real)) throw new Error(`Module loader: "${spec}" resolves outside the renderer root`);
    return real;
  }
  function load(file) {
    const cached = cache.get(file);
    if (cached) return cached.exports;
    const source = readFileSync(file, 'utf8');
    const out = ts.transpileModule(source, {
      compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true},
      fileName: file,
    }).outputText;
    const mod = {exports: {}};
    cache.set(file, mod); // set before eval so cyclic imports see partial exports
    const localRequire = (spec) => load(resolveFile(spec, file));
    const fn = window.eval(`(function(exports, require, module, __filename){${out}\n})`);
    fn.call(window, mod.exports, localRequire, mod, file);
    return mod.exports;
  }
  return {
    run(entryRelative) { return load(resolveFile('./' + entryRelative, path.join(root, '__entry__.js'))); },
    loaded() { return [...cache.keys()].map((f) => path.relative(root, f)); },
  };
}

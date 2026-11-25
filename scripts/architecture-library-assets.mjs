import fs from 'node:fs';
import path from 'node:path';

const MAX_FILES = 220;
const MAX_FILE_BYTES = 4 * 1024 * 1024;
const MAX_TOTAL_BYTES = 14 * 1024 * 1024;
const extensions = new Set(['.html', '.css', '.mjs', '.json', '.md', '.py', '.blend', '.glb', '.png', '.geojson']);
export function plainPath(root, candidate) {
  const relative = path.relative(root, candidate);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Architecture asset path escapes its root.');
  let current = root;
  for (const part of ['', ...relative.split(path.sep).filter(Boolean)]) {
    current = path.join(current, part);
    let stat;
    try { stat = fs.lstatSync(current); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (stat?.isSymbolicLink()) throw new Error('Architecture asset paths must not contain symlinks.');
  }
}
export function architectureLibraryInputs(repoRoot) {
  const source = path.join(repoRoot, 'projects/architecture-library');
  const manifestPath = path.join(source, 'static-assets.json');
  plainPath(repoRoot, manifestPath);
  if (fs.statSync(manifestPath).size > 32768) throw new Error('Architecture asset manifest is too large.');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.files) || !manifest.files.length || manifest.files.length > MAX_FILES
    || new Set(manifest.files).size !== manifest.files.length) throw new Error('Invalid architecture asset manifest.');
  let bytes = 0;
  const assets = manifest.files.map(relative => {
    if (typeof relative !== 'string' || !/^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_.-]+)*(?:\.[A-Za-z0-9]+)?$/.test(relative)
      || relative.split('/').some(part => part === '.' || part === '..' || part.startsWith('.'))
      || !extensions.has(path.extname(relative))) throw new Error('Invalid architecture asset path.');
    const from = path.join(source, relative);
    plainPath(repoRoot, from);
    const stat = fs.lstatSync(from);
    if (!stat.isFile() || stat.size > MAX_FILE_BYTES) throw new Error(`Architecture asset is not a bounded regular file: ${relative}`);
    bytes += stat.size;
    if (bytes > MAX_TOTAL_BYTES) throw new Error('Architecture library exceeds its static payload budget.');
    return { relative, from, bytes: stat.size };
  });
  return { manifestPath, assets, bytes };
}
export function copyArchitectureLibrary(repoRoot, destination) {
  const inputs = architectureLibraryInputs(repoRoot);
  // Preflight the complete destination before any copy; generated payloads never follow symlinks.
  plainPath(repoRoot, destination);
  for (const asset of inputs.assets) plainPath(repoRoot, path.join(destination, asset.relative));
  assertArchitectureProjection(destination, inputs.assets, { allowMissing: true });
  for (const { relative, from } of inputs.assets) {
    const to = path.join(destination, relative);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
  }
  return inputs;
}

/** Reject retired/unreviewed leftovers before a build can publish the entire public tree. */
export function assertArchitectureProjection(destination, assets, { allowMissing = false } = {}) {
  const allowed = new Set(assets.map(asset => asset.relative));
  const directories = new Set();
  for (const relative of allowed) {
    const parts = relative.split('/'); parts.pop();
    while (parts.length) { directories.add(parts.join('/')); parts.pop(); }
  }
  const seen = new Set();
  function visit(directory, prefix = '') {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const relative = prefix + entry.name;
      if (entry.isSymbolicLink()) throw new Error(`Symlink in architecture projection: ${relative}`);
      if (entry.isDirectory() && directories.has(relative)) visit(path.join(directory, entry.name), relative + '/');
      else if (entry.isFile() && allowed.has(relative)) seen.add(relative);
      else throw new Error(`Unexpected architecture projection file: ${relative}; review and remove the stale derived copy before rebuilding.`);
    }
  }
  if (fs.existsSync(destination)) visit(destination);
  if (!allowMissing && seen.size !== allowed.size) throw new Error('Architecture projection is missing reviewed files.');
}

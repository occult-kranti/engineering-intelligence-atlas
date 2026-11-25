#!/usr/bin/env node
/** Offline metadata router. Node 24; no dependency installation or provider key. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { registerHooks } from 'node:module';

const root = fileURLToPath(new URL('../', import.meta.url));
const referencesUrl = new URL('../desktop-shell/src/main/resourceReferences.ts', import.meta.url).href;
const routingUrl = new URL('../desktop-shell/src/main/resourceRouting.ts', import.meta.url).href;
// TypeScript's native build uses the extensionless import; Node's source runner
// needs its exact .ts location. This hook resolves this one reviewed edge only.
export async function loadResourceModule() {
  const hook = registerHooks({ resolve(specifier, context, nextResolve) {
    return context.parentURL === referencesUrl && specifier === './resourceRouting'
      ? { url: routingUrl, shortCircuit: true } : nextResolve(specifier, context);
  } });
  try { return await import(referencesUrl); }
  finally { hook.deregister(); }
}

export async function main(args = process.argv.slice(2)) {
  const api = await loadResourceModule();
  const query = { skills: [] };
  let seed = path.join(root, 'company'), mode = 'route';
  const valueFlags = new Set(['--skill', '--role', '--query', '--limit', '--max-bytes', '--seed']);
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (flag === '--help') {
      process.stdout.write('Usage: node scripts/resource-router.mjs [--skill NAME] [--role KEY] [--query TEXT] [--limit 0..6] [--max-bytes 1024..8192]\n       node scripts/resource-router.mjs --check | --check-atlas | --export-atlas\n--seed DIR selects only DIR/role-library/resource-catalog.json. Output is metadata; nothing is fetched, installed, purchased or executed.\n');
      return 0;
    }
    if (['--check', '--check-atlas', '--export-atlas'].includes(flag)) {
      if (mode !== 'route') throw new Error('Choose one check/export mode.');
      mode = flag.slice(2); continue;
    }
    if (!valueFlags.has(flag) || i + 1 >= args.length || args[i + 1].startsWith('--')) throw new Error(`Unsupported or missing argument: ${flag}`);
    const value = args[++i];
    if (flag === '--skill') query.skills.push(value);
    else if (flag === '--role') query.roleKey = value;
    else if (flag === '--query') query.query = value;
    else if (flag === '--limit') query.maxReferences = Number(value);
    else if (flag === '--max-bytes') query.maxBytes = Number(value);
    else seed = path.resolve(value);
  }
  const catalog = api.readResourceCatalog(seed);
  if (!catalog) throw new Error('Public resource catalog is unavailable, oversized or invalid.');
  if (mode === 'export-atlas') {
    process.stdout.write("// Generated from company/role-library/resource-catalog.json by scripts/resource-router.mjs --export-atlas.\nimport type { Resource } from './types';\n\nexport const RESOURCES: Resource[] = " + JSON.stringify(catalog.resources.map(api.legacyResource), null, 2) + ';\n');
    return 0;
  }
  if (mode === 'check-atlas') {
    const source = fs.readFileSync(path.join(root, 'site-source/src/data/resources.ts'), 'utf8');
    const match = /export\s+const\s+RESOURCES\s*:\s*Resource\[\]\s*=\s*([\s\S]*);\s*$/.exec(source);
    if (!match) throw new Error('Static atlas resource projection is not a JSON literal.');
    const rows = JSON.parse(match[1]);
    const expected = catalog.resources.map(api.legacyResource);
    // The original projection can contain 296 rows while the new records await
    // a deliberate rebuild. Once exported, all rows must match the catalog.
    if (![catalog.source.recordCount, expected.length].includes(rows.length)
      || JSON.stringify(rows) !== JSON.stringify(expected.slice(0, rows.length))) {
      throw new Error('Static atlas drift: original fields or generated rows differ from the canonical catalog.');
    }
    process.stdout.write(JSON.stringify({ valid: true, preservedOriginalRecords: catalog.source.recordCount,
      projectionRecords: rows.length, catalogRecords: expected.length, needsRebuild: rows.length !== expected.length }) + '\n');
    return 0;
  }
  if (mode === 'check') {
    process.stdout.write(JSON.stringify({ valid: true, resources: catalog.resources.length,
      preservedOriginalRecords: catalog.source.recordCount, skillRoutes: catalog.routes.length,
      catalogSha256: api.catalogHash(catalog), catalogVersion: catalog.catalogVersion }) + '\n');
    return 0;
  }
  const packet = api.routeResources(catalog, query);
  // Keep the actual JSON payload within the selector's UTF-8 byte allowance.
  process.stdout.write(JSON.stringify(packet) + '\n');
  return packet.status === 'invalid-query' || packet.status === 'catalog-unavailable' ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { process.exitCode = await main(); }
  catch (error) { process.stderr.write((error instanceof Error ? error.message : 'Resource routing failed.') + '\n'); process.exitCode = 1; }
}

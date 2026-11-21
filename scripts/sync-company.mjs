import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) => JSON.parse(fs.readFileSync(path.join(root, 'company', name), 'utf8'));
const data = { company: read('engineering-intelligence-atlas.json'), employees: read('team.json'), ...read('roadmap.json') };
const target = path.join(root, 'site-source/src/data/company.ts');
fs.writeFileSync(target, '// Generated from company/*.json by scripts/sync-company.mjs.\nexport const WORKSPACE = ' + JSON.stringify(data, null, 2) + ' as const;\n');
console.log('Synchronized company, team, and roadmap data.');

/** Offline release gate: SQL, snapshots, journal and current schema agree. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateMySQLDrizzleJson, generateMySQLMigration } from 'drizzle-kit/api';
import * as schema from './schema';

const directory = join(dirname(fileURLToPath(import.meta.url)), 'migrations');
const journal = JSON.parse(readFileSync(join(directory, 'meta/_journal.json'), 'utf8'));
let previous = await generateMySQLDrizzleJson({});
let statements = 0;
for (const entry of journal.entries) {
  const snapshot = JSON.parse(readFileSync(join(directory, 'meta', `${String(entry.idx).padStart(4, '0')}_snapshot.json`), 'utf8'));
  const expected = await generateMySQLMigration(previous, snapshot);
  const actual = readFileSync(join(directory, `${entry.tag}.sql`), 'utf8').trim();
  assert.equal(actual, expected.join('\n--> statement-breakpoint\n').trim(), `SQL does not match snapshot: ${entry.tag}`);
  statements += expected.length;
  previous = snapshot;
}
const current = await generateMySQLDrizzleJson(schema);
const drift = await generateMySQLMigration(previous, current);
assert.deepEqual(drift, [], 'Current schema differs from checked-in migrations; generate and review a new migration');
console.log(`Migration integrity passed: ${journal.entries.length} migrations, ${statements} statements, ${Object.keys(previous.tables).length} tables. No database was contacted.`);

# Database setup and migration provenance

The runtime uses Drizzle ORM with a MySQL-compatible database. Atlas browsing,
static builds, typechecking and migration-integrity checks do not need a database.

## Restored migration files

The repository import retained `meta/0000_snapshot.json`, `meta/0001_snapshot.json`
and `_journal.json`, but its ignore rule excluded both corresponding SQL files.
The SQL files are now reconstructed from those snapshots with the locked
`drizzle-kit` generator. They contain the 19-table schema in two additive stages:
core Director tables, followed by integration records/discoveries. These are
reconstructed migration contents; they are not claimed to have the byte-for-byte
hashes of missing upstream SQL. Unmodified imported metadata is retained in
`legacy-import/` for comparison.

The active baseline includes one portability repair: the original full unique
index on `registry_resources.url VARCHAR(1000)` exceeds MySQL's 3072-byte index
limit with utf8mb4. A stored SHA-256 column now provides the unique index while
preserving the complete URL, including long Unicode paths. Like any digest-based
unique index, this relies on SHA-256 collision resistance; original URLs remain
available for exact comparisons.

`npm run check:migrations` verifies every SQL file against its stored snapshot and
checks that the final snapshot matches `schema.ts`. It is entirely offline.

`0002_handoff_indexes.sql` is a new, additive migration. It adds compound indexes
for accepted upstream artifact lookups, approval gates, and per-node budget sums.
It contains only `CREATE INDEX` statements. Existing single-column indexes remain
in place; no table, column, index, or row is dropped by this migration.

## Fresh database

Configure `DATABASE_URL` for a new, empty database owned by this application.
Review the SQL before applying it, then run:

```bash
npm run check:migrations
npm run db:migrate
npm run db:seed
npm run db:migrate
```

The last migration command should be a no-op on a database that records Drizzle
migration history correctly. Seed imports the reference roles/resources and
curated skills. It never executes skill scripts or makes model calls.

## Existing databases

Do not apply the reconstructed history or overwrite `__drizzle_migrations`
blindly. First back up the database, compare its schema with the snapshots and
inspect its existing migration journal. Existing upstream migration hashes may
differ because the original SQL was not included in the repository import.
`upgrades/2026-11-20-resource-url-hash.sql` provides the reviewed additive URL-hash
change for an existing imported database. It is outside the automatic migration
journal so it cannot accidentally run on a fresh database that already has the
column. The previous URL index can remain until the new index is verified.

After reconciling that baseline, apply `0002_handoff_indexes.sql` once through the
reviewed migration history. If an existing deployment already has any of these
indexes, compare its definitions before changing migration state. Do not blindly
replay the reconstructed baseline to obtain the new indexes.

The legacy `baseline-migrations.mjs` helper was written for an earlier TiDB
workspace. It is not part of fresh setup. Only use a baseline operation after a
schema review confirms that every recorded migration is already present; marking
an unapplied migration as applied can leave the runtime with missing constraints
or tables. No existing database was contacted or changed while reconstructing
this migration history.

Generate future migrations with `npm run db:generate`, review both the SQL and
snapshot changes, and commit them together. `db:generate` works without
credentials; `db:migrate` needs `DATABASE_URL`. Do not use `db:push` as an
unreviewed upgrade path.

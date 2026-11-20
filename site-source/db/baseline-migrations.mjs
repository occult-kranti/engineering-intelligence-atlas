/**
 * db/baseline-migrations.mjs — one-time baseline for databases that were
 * provisioned before checked-in migrations existed.
 *
 * Why this exists (documented platform limitation):
 *   - This workspace's database is TiDB-backed MySQL. `drizzle-kit push`
 *     mis-introspects it: PK metadata is invisible, so every push tries to
 *     re-add existing primary keys and fails with ER_MULTIPLE_PRI_KEY.
 *     db:push is therefore NOT the schema path for this project.
 *   - The reproducible path is: `npm run db:generate` (review the SQL in
 *     db/migrations/) → `npm run db:migrate`. The baseline migration uses
 *     CREATE TABLE IF NOT EXISTS so it is safe on both fresh and existing
 *     databases.
 *   - On TiDB, drizzle-kit migrate does not persist its bookkeeping row
 *     (known quirk), so an already-provisioned database re-applies the
 *     idempotent baseline every run. Run this script once per existing
 *     database to record the baseline in __drizzle_migrations; afterwards
 *     `npm run db:migrate` is a true no-op until the next generated
 *     migration.
 *
 * Usage: node db/baseline-migrations.mjs   (loads .env automatically)
 */
process.loadEnvFile?.();

const { readMigrationFiles } = await import("drizzle-orm/migrator");
const mysql = await import("mysql2/promise");
const path = await import("node:path");
const { fileURLToPath } = await import("node:url");

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const migrations = readMigrationFiles({
  migrationsFolder: path.join(root, "db/migrations"),
});
const conn = await mysql.default.createConnection(process.env.DATABASE_URL);
for (const m of migrations) {
  const [rows] = await conn.query(
    "SELECT id FROM __drizzle_migrations WHERE hash = ?",
    [m.hash],
  );
  if (rows.length === 0) {
    await conn.query(
      "INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)",
      [m.hash, m.folderMillis],
    );
    console.log(`baselined migration ${m.tag ?? m.hash.slice(0, 12)}`);
  }
}
await conn.end();
console.log("baseline complete");

-- Manual, additive upgrade for an EXISTING imported database only.
-- Review the schema and take a backup before applying this file.
-- Fresh databases use the reconstructed baseline; do not run this on them.
-- These statements preserve URL values and do not delete or truncate records.
ALTER TABLE `registry_resources`
  ADD COLUMN `url_sha256` char(64)
  GENERATED ALWAYS AS (sha2(`url`, 256)) STORED;
CREATE UNIQUE INDEX `registry_resources_url_sha256_idx`
  ON `registry_resources` (`url_sha256`);
-- The old index can remain temporarily; it is no longer required by the schema.
-- Remove it only after verifying the new index, if it exists on this database:
-- DROP INDEX `registry_resources_url_idx` ON `registry_resources`;

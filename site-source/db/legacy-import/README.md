# Unmodified imported migration metadata

These are the original snapshots and journal from import commit
`c3a23a945af702ec8c75e823c37a88296a91ba43`. Corresponding SQL files were absent.
They are retained as provenance and are **not** the active migration directory.

The active reconstructed baseline differs in one reviewed portability fix:
`registry_resources` stores the original `VARCHAR(1000)` URL and indexes its
stored SHA-256 digest instead of trying to index all 4000 possible utf8mb4 bytes.
No existing database was modified. See `../README.md` and the manual existing-
database upgrade in `../upgrades/`.

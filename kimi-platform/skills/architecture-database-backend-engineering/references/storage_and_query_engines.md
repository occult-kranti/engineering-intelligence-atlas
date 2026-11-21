# Storage and Query Engines

Distilled from the research library §7–9 (baseline 2026-11-20). Evidence tiers: **[O]** official/observed, **[V]** vendor-reported, **[C]** community/course.

**Contents:** B+tree vs LSM · RUM conjecture · WAL/recovery · buffer pools · query planning/optimization · execution models · joins/pushdown · plan observability · indexing · vector indexes

## 1. Storage engines: B-trees and LSMs

- **B+tree engines** (InnoDB, PostgreSQL nbtree, SQLite): in-place update, page-oriented, excellent reads/ranges; costs are write amplification from random page updates + full-page-write WAL (Postgres) / doublewrite buffer (InnoDB), and buffer-pool management. Read paths in source: PostgreSQL `src/backend/access/nbtree/`; SQLite `src/btree.c`. **[O]**
- **LSM-tree engines** (RocksDB, Cassandra, ScyllaDB, LevelDB, TiKV via RocksDB): buffer writes in memtable → flush immutable sorted runs (SSTables) → background compaction. Wins: write throughput, compression, sequential I/O. Costs: read amplification (mitigated by Bloom filters per run), space amplification (leveled vs tiered compaction choice), and **compaction stalls** — the operational signature of LSM systems under sustained write bursts.
- **RocksDB (corrected record, verified 2026-11-20 [O]):** the repository is **`meta/rocksdb`** — `facebook/rocksdb` returns HTTP 301 → `meta/rocksdb`. Latest release **v11.13.2, released 2026-11-04** (GitHub releases API; release notes dated 2026-10-28). License **dual Apache-2.0 OR GPL-2.0** (`LICENSE.Apache` + `COPYING`; GitHub detects GPL-2.0). Read `db/compaction/`, `db/db_impl_write.cc`, `db/write_stall.cc`, `table/`, and `include/rocksdb/options.h` for the full leveled/universal compaction and write-stall decision surface.
- **The RUM conjecture** (Athanassoulis et al. 2016): optimizing Read, Update, or Memory overheads — pick two. Review question: "which RUM overheads does this design deliberately spend?"
- **WAL & recovery:** ARIES (Mohan et al. 1992) is the reference algorithm — write-ahead logging, repeating history during redo, compensation log records for undo. CMU 15-445 lectures 20–21 walk ARIES concretely ([course notes](https://15445.courses.cs.cmu.edu/fall2025/)). **[O]**
- **Buffer pool:** LRU is cache-unfriendly to scans; real systems use LRU-K, ARC, or clock-sweep approximations (Postgres clock-sweep; InnoDB midpoint insertion guards against sequential-scan pollution).
- **SQLite** (public domain, [sqlite.org/src](https://sqlite.org/src), mirror `sqlite/sqlite` tag version-3.54.1 pinned 2026-11-20 **[O]**) is the most-read production storage-engine codebase in the world: single-file B-tree, rollback-journal **and** WAL modes (WAL = readers don't block writers), and an obsessive testing culture — [sqlite.org/testing.html](https://sqlite.org/testing.html) documents ~590× more test code than code (TH3, fuzzing, anomaly testing). **[O]**

## 2. Query planning, optimization, and execution

- **Architecture:** parser → binder/analyzer → logical plan → cost-based optimizer → physical plan → executor. Two optimizer families: **Volcano/top-down rule engines** vs **Cascades** (memoized group expressions; used in CockroachDB `pkg/sql/opt`, Orca, Calcite). Lineage: Graefe's [Cascades paper (1995)](https://15721.courses.cs.cmu.edu/spring2018/papers/15-optimizer1/graefe-icde1995.pdf). **[O]**
- **Cost model inputs:** statistics (histograms, MCV lists, NDV estimates — Postgres `pg_stats`, `ANALYZE`). Cardinality-estimation errors compound **exponentially through join chains** — the classic cause of "the optimizer chose a nested loop over 10M rows." Mitigations: extended statistics (Postgres `CREATE STATISTICS`), adaptive execution (Spark AQE), plan forcing as a documented escape hatch.
- **Execution models:** Volcano iterator (tuple-at-a-time) vs **vectorized** (batch-at-a-time, cache/SIMD friendly — MonetDB/X100 lineage, DuckDB, ClickHouse) vs compiled (HyPer, Postgres 11+ LLVM JIT for expression evaluation). DuckDB (MIT, v2.0.1 released 2026-11-20 **[O]**) is the cleanest readable vectorized engine; its [execution-format internals doc](https://duckdb.org/docs/stable/internals/vector) is a model internals doc.
- **Joins:** nested-loop (indexed), hash (build/probe, grace hybrid for spills), sort-merge; distributed: broadcast vs shuffle (the Spark/MPP decision), semi-join reduction. Predicate/projection pushdown into storage (Parquet row-group skipping via min/max stats + Bloom filters) is the single biggest OLAP lever.
- **Plan observability:** `EXPLAIN (ANALYZE, BUFFERS)` in Postgres — buffers hit vs read tells you cache reality; estimated vs actual rows divergence localizes statistics problems. Reading real plans is a core lab skill (lab 5 in [labs_and_evaluation.md](labs_and_evaluation.md)).
- **Top three real-world database performance wins:** (1) fix cardinality-estimation disasters visible in `EXPLAIN ANALYZE`, (2) add the right composite/partial index, (3) batch writes into transactions instead of per-statement commits (each commit = an fsync; group commit amortizes it).

## 3. Indexing

- **Types:** B+tree (default, ordered ops), hash (Postgres hash is WAL-logged since PG10 — a famous "don't use" footgun before), **GiST** (generalized search tree: PostGIS geometry, range types), **GIN** (inverted: arrays, JSONB, full-text), **BRIN** (block-range: tiny, for naturally clustered big tables), covering indexes (`INCLUDE`), partial indexes (the highest-leverage underused type), expression indexes.
- **Write cost law:** every index is a write tax + WAL volume + vacuum work. Index audit (`pg_stat_user_indexes.idx_scan = 0`) is a recurring ops task.
- **Secondary indexes on LSM stores:** global (base-table-like, needs distributed transactions to stay consistent — TiKV/CockroachDB) vs local (per-partition, scatter-gather queries — Cassandra SASI, DynamoDB LSI vs GSI).
- **Vector indexes:** HNSW (graph ANN, high recall/latency trade, memory-heavy) vs IVF/PQ (compressed, lower memory); `pgvector` (HNSW + IVFFlat in Postgres) vs purpose-built engines. In 2026, HNSW also shipped in Redis 8 Vector Sets and Valkey module ecosystems **[V/O]** — ANN recall/latency claims are vendor-reported until benchmarked on your data.
- **Learned indexes** (Kraska et al. 2017) — influential research direction; treat as research, not default production practice.

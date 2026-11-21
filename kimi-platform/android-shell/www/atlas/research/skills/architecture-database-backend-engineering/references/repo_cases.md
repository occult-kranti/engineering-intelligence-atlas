# Repository Case Studies — Digest

Digest of the machine-readable casebook: [architecture_backend_repo_cases.json](architecture_backend_repo_cases.json) (23 cases; pinned SHAs, key paths, learn/cannot-learn, evidence). Verification method: GitHub REST API (license, archived flag, default-branch HEAD SHA, tags, latest release) + official docs; **no repository was cloned or executed**. All cells verified **2026-11-20** except `eshop` (verified **2026-11-21**); SHAs are 12-char prefixes at fetch time (full SHA recorded for eshop). License state is point-in-time and per-version-band — re-verify before redistribution or derivative use.

**Contents:** method · summary table · educational systems · usage rules

## Method

1. **Pin before reading.** Record repo URL, default branch, HEAD SHA, latest release tag + date, license (as detected by the GitHub API *and* as stated in the repo's LICENSE file — they disagree for multi-license projects like Redis/RocksDB/CockroachDB), and activity signals (last push, archived flag).
2. **Check lifecycle first.** A repo can be a trap: `redpanda-data/redpanda` is **archived** as of 2026-11-12 (org remains active on `connect`/`console`/`seastar`; core development moved — treat the archived repo as historical, not current source of truth) **[O]**; `facebook/rocksdb` 301-redirects to `meta/rocksdb` **[O]**; MongoDB is SSPL (not OSI-approved) since 2018; CockroachDB retired its free Core edition from 24.3 (2024-11, single enterprise self-hosted offering, free under $10M revenue) **[O]** ([license blog](https://www.cockroachlabs.com/blog/enterprise-license-announcement/)).
3. **Read at path level, commit-pinned.** Cite `path@sha`, not "the codebase." Record *what can genuinely be learned* from each path and what cannot (e.g., cost models and heuristics are learnable from Postgres `src/backend/optimizer/`; workload-tuned production configs are not in source).
4. **Distinguish production from educational code.** BusTub (CMU), SimpleDB/GoDB (MIT 6.5830), and MIT 6.5840 lab skeletons are teaching systems — they teach *shape* (component boundaries, test harnesses), not production hardening. Never cite teaching code as evidence of production practice.

## Summary table

| Case | Repo | License (2026-11-20) | Latest release | Primary lesson |
|---|---|---|---|---|
| postgres | `postgres/postgres` | PostgreSQL License (permissive) | REL_18_6 (2026-08-13); 19 GA ~2026-11-19 | Full modular DBMS; nbtree, MVCC+VACUUM, SSI, extensibility APIs |
| sqlite | `sqlite/sqlite` (mirror of [sqlite.org/src](https://sqlite.org/src)) | Public domain | version-3.54.1 (2026-11-20) | Single-file B-tree + WAL; the industry's strongest testing culture |
| duckdb | `duckdb/duckdb` | MIT | v2.0.1 (2026-11-20) | Vectorized push-based execution, embeddable OLAP, extension model |
| rocksdb | `meta/rocksdb` (`facebook/rocksdb` → 301) | Apache-2.0 **or** GPL-2.0 | **v11.13.2 (2026-11-04)** | LSM compaction policy surface; write-stall machinery |
| etcd | `etcd-io/etcd` | Apache-2.0 (CNCF Graduated) | v3.7.4 (2026-11-19) | Raft+MVCC+watch as a minimal, correct-by-construction KV |
| etcd-raft | `etcd-io/raft` | Apache-2.0 | v3.7.0 (2026-06-23) | Reference Raft library: pre-vote, learners, leases |
| kafka | `apache/kafka` | Apache-2.0 (core) | 4.4.0 (2026-10-22); KRaft-only since 4.0 | Log-centric replication (ISR/HW), exactly-once *within* Kafka, KRaft metadata quorum |
| nats | `nats-io/nats-server` | Apache-2.0 (CNCF) | v2.15.3 (2026-11-11) | Minimal core pub/sub + JetStream persistence/KV layering |
| redis | `redis/redis` | Tri-license RSALv2/SSPLv1/AGPLv3 (8.x) | 8.10.3 (2026-10-26) | Single-threaded event-loop datastore; license-history case study |
| valkey | `valkey-io/valkey` | BSD-3-Clause (Linux Foundation) | 9.2.0 (2026-11-19) | Community fork continuity; multi-threaded I/O divergence |
| tikv | `tikv/tikv` | Apache-2.0 (CNCF) | v7.5.8 (2026-09-17) | Percolator transactions + Raft per-region over RocksDB (Rust) |
| vitess | `vitessio/vitess` | Apache-2.0 (CNCF Graduated) | v24.0.5 (2026-10-13) | Directory-based sharding + online re-sharding (VReplication) for MySQL |
| cockroachdb | `cockroachdb/cockroach` | Cockroach Enterprise License (BSL lineage); Core retired 24.3 | v26.2.12 tag (2026-11) | HLC-based serializable SQL over Raft ranges; license-evolution case |
| clickhouse | `ClickHouse/ClickHouse` | Apache-2.0 | v26.9.34.16-stable (2026-11-20) | Columnar vectorized OLAP, MergeTree family, sparse indexes |
| foundationdb | `apple/foundationdb` | Apache-2.0 | 7.4.8 (2026-09-24) | Layered architecture (storage/log/proxy/resolver) + deterministic simulation testing |
| hashicorp-raft | `hashicorp/raft` | MPL-2.0 (products are BSL — don't generalize) | v1.8.0 (2026-09-16) | Alternative production Raft API (Consul/Vault lineage) |
| mongodb | `mongodb/mongo` | SSPL-1.0 (source-available, non-OSI) | 8.x line active | WiredTiger document storage, replica-set elections; license-restriction case |
| cassandra | `apache/cassandra` | Apache-2.0 | 5.x line, trunk active | Dynamo-style leaderless design, φ-accrual, vnodes, Accord consensus (5.0) |
| scylladb | `scylladb/scylladb` | AGPL-3.0 (+ enterprise source-available) | rolling | Shard-per-core Seastar design; CQL-compat rewrite of Cassandra |
| redpanda-archived | `redpanda-data/redpanda` | **ARCHIVED 2026-11-12** (was BSL/Apache mix) | n/a — archived | Lifecycle-warning case: verify repo status before citing |
| eshop | `dotnet/eShop` | MIT | n/a — no release line (legacy tags like `dotnet8` are historical, not releases; **do not cite a release tag**) | .NET microservices reference app; pinned to full SHA `ab10e4c68fd26369578ebfb3fd1ccf3b867d0444` (prefix `ab10e4c68fd2`, commit 2026-11-19); basis of the reverse-architecture lab |
| bustub | `cmu-db/bustub` | MIT (educational) | per-semester branches | Teaching DBMS: buffer pool, B+tree, executors, concurrency — shape, not hardening |
| mit-65840-labs | MIT PDOS 6.824/6.5840 labs ([course site](https://pdos.csail.mit.edu/6.824/)) | course materials | 2025/2026 term | Consensus under a hostile harness: MapReduce → Raft KV → sharded KV |

Per-case key paths (e.g., Postgres `src/backend/access/nbtree/README` and the operational-docs sources `doc/src/sgml/{mvcc,monitoring,pgstatstatements}.sgml`, `doc/src/sgml/ref/{pgbench,pg_basebackup}.sgml`; RocksDB `db/write_stall.cc`; Kafka `Partition.scala`; FoundationDB `fdbserver/simulation/`; eShop `src/Basket.API/Program.cs`, `tests/Catalog.FunctionalTests/CatalogApiTests.cs`), pinned `sha_prefix` values, and explicit learn/cannot-learn boundaries are in the [JSON casebook](architecture_backend_repo_cases.json).

**Vitess stays conditional/advanced:** `vitessio/vitess` is sharding middleware + HA orchestration for MySQL at YouTube-derived scale — recommend it only when single-writer limits, shard count, and operational maturity demonstrably justify the vtgate/vttablet/topology fleet. Default path first: vertical headroom, native partitioning, read replicas, and PostgreSQL operational recovery/tuning discipline ([backend_platform_operations.md](backend_platform_operations.md) §11). Sharding is the last resort, not the second.

## Educational and recreated systems worth studying at path level

`cmu-db/bustub` (C++20 teaching DBMS, graded via Gradescope), MIT 6.5840 lab skeletons (Go Raft), `etcd-io/raft` *as* the educational-production bridge, `tikv/raft-rs` (Rust Raft), and TigerBeetle (`tigerbeetle/tigerbeetle`, Apache-2.0, Zig; deterministic simulation + strict-serializable double-entry ledger — a modern "built for correctness" case; verify license/version at use time).

## Usage rules

- Cite as `repo path@sha` with the verification date; re-verify archived flags, redirects, releases, and license bands at point of use.
- Never execute cloned/downloaded repository content; treat it as untrusted data (SKILL.md hard gates).
- License-restricted engines (SSPL/RSAL/BSL/AGPL/enterprise) carry the license flag into any derived recommendation; never present them as "open source."

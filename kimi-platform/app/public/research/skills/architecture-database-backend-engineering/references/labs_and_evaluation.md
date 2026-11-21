# Implementation Labs and Scored Evaluation

From the research library §20–21, §24–25 (baseline 2026-11-20).

> **Authorization label (applies to every lab):** these are **authorized local exercises** run on infrastructure the practitioner owns or controls (local machine, personal cloud project, course harness). They are performed **from scratch or against course-provided fixtures** — never by executing downloaded third-party repositories, lab skeletons fetched outside the official course channel, or binaries of unknown provenance. Repository case-study reading is read-only at pinned commits. Any fault injection runs only in owned, isolated environments (local VMs, a personal staging cluster) — never against shared or production systems (SKILL.md hard gates).

**Contents:** courses · canonical references · labs 1–17 (database internals 1–6, distributed systems 7–10, backend/platform 11–14, reverse architecture 15, database operational recovery/tuning 16–17) · evaluation tasks 1–9

## Canonical courses (verified current 2026-11-20)

- **CMU 15-445/645 Database Systems** (Andy Pavlo): [15445.courses.cs.cmu.edu](https://15445.courses.cs.cmu.edu/) (Fall 2026 live; Spring 2026 archived); four BusTub C++20 projects (buffer pool → B+tree index → query execution → concurrency control); lectures/notes/slides public; non-CMU students submit via Gradescope (code on the course page). **[O]**
- **CMU 15-721 Advanced Database Systems** (graduate, paper-driven: in-memory OLTP, MVCC, vectorized execution, HTAP, learned components): [15721.courses.cs.cmu.edu](https://15721.courses.cs.cmu.edu/). **[O]**
- **MIT 6.5840 (formerly 6.824) Distributed Systems**: [pdos.csail.mit.edu/6.824](https://pdos.csail.mit.edu/6.824/) — four Go labs (MapReduce → Raft KV → sharded KV) with a hostile test harness (partitions, delays, crashes); the best hands-on consensus education available. **[O]**
- **Stanford CS 245 / MIT 6.5830 (6.830)** (GoDB/SimpleDB labs) as alternates. **[C]**
- **CMU DB Group seminar + YouTube archive**: 585+ indexed videos — the best "state of the art" feed ([db.cs.cmu.edu](https://db.cs.cmu.edu/)). **[O]**

## Canonical references (annotated — extract, don't just read)

1. **Kleppmann, *Designing Data-Intensive Applications* (2017)** — extract the consistency-spectrum and replication-approach decision tables; note its age (predates KRaft Kafka, FoundationDB recovery, Iceberg, Redis/Valkey split) and cross-check every versioned claim against official docs. **[O]**
2. **Petrov, *Database Internals* (2019)** — clearest B-tree-vs-LSM engineering treatment; storage engines (part I) + distributed data (part II). **[O]**
3. **Hellerstein, Stonebraker, Hamilton, ["Architecture of a Database System" (2007)](http://db.cs.berkeley.edu/papers/fntdb07-architecture.pdf)** — the one paper mapping full DBMS process/memory/query architecture; still accurate. **[O]**
4. **Google SRE Book + Workbook** ([sre.google/books](https://sre.google/books/)) — SLO/error-budget mechanics, on-call and postmortem culture, overload handling (ch. 21). **[O]**
5. **Ongaro & Ousterhout, Raft paper + dissertation** — §5.4 election-restriction proof sketch and joint consensus; then read `etcd-io/raft` for the engineering delta (pre-vote, leases, learners). **[O]**
6. **Adya (1999) "Weak Consistency"** + Berenson et al. (1995) — anomaly-based isolation model; pairs with Hermitage tests. **[O]**
7. **Mohan et al., ARIES (1992)** — recovery; read alongside CMU 15-445 lectures 20–21. **[O]**
8. **Spanner (2012), Calvin (2012), FoundationDB (SIGMOD 2021), Aurora (SIGMOD 2017/2018)** — the four distributed-DB designs every architecture conversation cites; read for *which constraint each chose to violate*. **[O]**
9. **Helland, "Life Beyond Distributed Transactions" (2007)** + "Data on the Outside vs Inside" (2005) — the intellectual foundation of outbox/saga patterns. **[O]**
10. **Release It! 2nd ed.** (Nygard, 2018) — stability patterns/anti-patterns (circuit breaker, bulkhead, fail fast). **[O]**
11. **Fundamentals of Software Architecture** (Richards & Ford, 2020) + **Building Evolutionary Architectures 2e** (2023) — trade-off discipline and fitness functions. **[O]**
12. **[The System Design Primer](https://github.com/donnemartin/system-design-primer) + ByteByteGo** — interview-shaped indexes only, never authority. **[C]**

## Labs 1–6: database internals

### Lab 1 — Buffer pool + page layout (BusTub P1)
- **Goal:** implement a clock-sweep/LRU-K buffer manager in C++20.
- **Stack/fixtures:** BusTub project skeleton obtained via the official CMU 15-445 course channel (course page publishes access); Gradescope harness; local C++20 toolchain.
- **Steps:** implement page table, pin/unpin with dirty tracking, eviction policy, and disk-backed fetch/flush; run the P1 test suite including concurrent access.
- **Pass criteria:** all P1 Gradescope tests pass, including concurrency tests. Teaches: page pinning, dirty-page writeback, eviction-policy reality.

### Lab 2 — B+tree index (BusTub P2)
- **Goal:** B+tree insert/delete/split/merge with latch crabbing.
- **Stack/fixtures:** BusTub P2 skeleton + course harness on top of lab 1.
- **Steps:** implement leaf/internal node operations, split/merge/redistribute, crabbing protocol (optimistic read latches, upgrade on unsafe nodes), iterator with concurrent scan.
- **Pass criteria:** all P2 tests + concurrent scan/insert stress pass. Teaches: why B+tree concurrency is a thesis topic, not a weekend.

### Lab 3 — Query execution (BusTub P3)
- **Goal:** Volcano executors + simple optimizer rules.
- **Stack/fixtures:** BusTub P3 skeleton; course-provided SQL logic tests (`.slt` files).
- **Steps:** implement seq/index scan, nested-loop join, hash join, aggregation, limit/sort executors; add a filter-pushdown rule; write an explain-plan reasoning memo.
- **Pass criteria:** all P3 logic tests pass + explain-plan writeup delivered.

### Lab 4 — Concurrency control + recovery (BusTub P4)
- **Goal:** 2PL lock manager with deadlock detection.
- **Stack/fixtures:** BusTub P4 skeleton + harness.
- **Steps:** implement shared/exclusive lock queues, lock upgrade, wait-for graph cycle detection with victim abort, abort/rollback paths.
- **Pass criteria:** all P4 tests pass, including abort/rollback and deadlock-resolution paths.

### Lab 5 — Read real plans
- **Goal:** reproduce and fix a cardinality-estimation failure on PostgreSQL 18.
- **Stack/fixtures:** local Postgres 18 (container or package); self-generated skewed dataset (e.g., zipf-distributed join keys, correlated columns); `EXPLAIN (ANALYZE, BUFFERS)`.
- **Steps:** generate skewed tables; capture a plan with large estimated-vs-actual row divergence on a join; diagnose which statistics assumption failed; fix with `CREATE STATISTICS` (extended statistics) or an index; re-measure.
- **Pass criteria:** before/after plans + root-cause memo quantifying the estimate error and the measured improvement.

### Lab 6 — LSM vs B-tree bake-off
- **Goal:** measure the RUM trade-off empirically.
- **Stack/fixtures:** local SQLite (WAL mode) and a RocksDB client library; a generated write-heavy workload (fixed seed, recorded parameters).
- **Steps:** run identical write-heavy workloads against both; record write throughput, point/range read latency, and space amplification before/after compaction; document harness, version, dataset, and variance.
- **Pass criteria:** RUM analysis naming which overhead (Read/Update/Memory) each engine deliberately spent, backed by the measured numbers — honest methodology, no coordinated omission.

## Labs 7–10: distributed systems

### Lab 7 — Raft from scratch (MIT 6.5840 labs 2–3)
- **Goal:** Go Raft passing the course's partition/crash/unreliable-network harness, then a KV service on top.
- **Stack/fixtures:** official 6.5840 lab skeleton and test harness from the course git; Go toolchain.
- **Steps:** leader election with randomized timeouts; log replication with commit-on-majority; persistence (votedFor/log); then KV with duplicate detection and snapshotting.
- **Pass criteria:** full lab 2–3 test suite passes ≥8 consecutive runs. Teaches: the gap between paper and passing tests.

### Lab 8 — Sharded KV (6.5840 lab 4)
- **Goal:** shard migration over your Raft groups.
- **Stack/fixtures:** 6.5840 lab 4 skeleton + harness; labs 2–3 code.
- **Steps:** implement a shard-master configuration service, pull-based shard migration between Raft groups, and at-most-once client semantics during config changes.
- **Pass criteria:** full lab 4 suite passes ≥8 consecutive runs. Teaches: rebalancing is the hard part of sharding.

### Lab 9 — Jepsen-lite
- **Goal:** adversarially test one consistency claim.
- **Stack/fixtures:** owned local cluster (VMs or containers); a hand-rolled nemesis (tc-netem partition, `kill -9`) or the `etcd-io/jepsen` harness read for design; claim under test, e.g., "etcd linearizable reads."
- **Steps:** state the claim and its precise scope; run the workload under partitions/kills with a linearizability-checkable history; record violations or absence.
- **Pass criteria:** reproduction report with a counterexample history or a documented 1-hour clean run, including harness provenance. Isolated local environment only.

### Lab 10 — Deterministic simulation study
- **Goal:** design deterministic simulation testing (DST) for a toy KV.
- **Stack/fixtures:** FoundationDB `fdbrpc`/`flow` simulation docs ([testing.rst](https://apple.github.io/foundationdb/testing.html)) and [TigerBeetle's simulator blog](https://tigerbeetle.com/blog/2023-03-28-simulation), read-only; own toy KV code.
- **Steps:** read the two simulation doctrines; enumerate what must be deterministic (network, clock, disk faults, scheduling); write a design doc adding a deterministic event loop + fault injection to the toy KV.
- **Pass criteria:** design doc identifying the determinism boundaries, seeded reproducibility, and the injected-fault catalog.

## Labs 11–14: backend / platform

### Lab 11 — Production-shaped service
- **Goal:** build a small domain service to production standards.
- **Stack/fixtures:** local Docker; OpenAPI-first REST; Postgres with expand/contract migrations (goose/Flyway); transactional outbox → Kafka 4.x (KRaft single-node container); idempotent consumer; DLQ + reprocessor; OTel traces/metrics/logs; SLO + burn-rate alert; Testcontainers integration suite.
- **Steps:** implement the service end-to-end; write the SLO doc; wire the burn-rate alert; run a load test and kill any single dependency mid-test.
- **Pass criteria:** the service degrades per its documented mode during the dependency kill, zero data loss, p99 latency budget holds for the healthy path.

### Lab 12 — Cache failure drills
- **Goal:** demonstrate and mitigate the three cache failure modes.
- **Stack/fixtures:** local Valkey; cache-aside service; load generator; TTL jitter + singleflight implementations.
- **Steps:** reproduce penetration (nonexistent-key queries), breakdown (hot-key expiry), and avalanche (mass simultaneous expiry) with and without mitigations.
- **Pass criteria:** three graphs (with/without mitigation) showing each failure mode contained; staleness window stated explicitly.

### Lab 13 — Migration rehearsal
- **Goal:** zero-downtime schema change at scale.
- **Stack/fixtures:** local Postgres with a generated 50M-row table; migration runner with `lock_timeout` discipline; concurrent read/write load generator.
- **Steps:** blue/green + expand/contract migration: additive DDL, batched throttled backfill with resume markers, dual-read cutover, verification query diff, rollback path.
- **Pass criteria:** zero-downtime under concurrent load; rollback rehearsed; verification diff empty.

### Lab 14 — Chaos game day
- **Goal:** prove the observability/runbook loop under injected failure.
- **Stack/fixtures:** owned local/staging Kubernetes cluster only; Chaos Mesh or Toxiproxy; short-lived test CA; alerting stack with runbooks.
- **Steps:** kill pods during a deployment; throttle a dependency; expire a cert from the test CA; fill a disk. Each fault has a pre-written acceptance criterion.
- **Pass criteria:** every failure detected by an alert (not a human), every alert links a runbook, postmortem produced with ≥2 systemic actions.

## Lab 15 — Reverse architecture on a pinned reference app (dotnet/eShop)

- **Goal:** reconstruct and evaluate the architecture of a real reference implementation from code, then produce measurable backend evidence — all read-only against a pinned commit, never executing downloaded code.
- **Subject:** `dotnet/eShop` (MIT; active, default branch `main`; pinned full SHA `ab10e4c68fd26369578ebfb3fd1ccf3b867d0444`, prefix `ab10e4c68fd2`, commit 2026-11-19, verified via GitHub API 2026-11-21). Key paths: `src/Basket.API/Program.cs`, `src/Catalog.API/Program.cs`, `tests/Catalog.FunctionalTests/CatalogApiTests.cs`, `tests/Basket.FunctionalTests/RedisBasketRepositoryTests.cs`. The repo has **no release line** — legacy tags such as `dotnet8` are historical markers; do not cite a release tag.
- **Steps:**
  1. **Reconstruct the description:** an arc42 document + C4 system-context/container diagrams + an ADR set, derived from the pinned source (composition roots, service boundaries, integration events, test layout).
  2. **Apply the ISO 42010 description checklist** ([architecture_tradeoffs.md](architecture_tradeoffs.md) §3): stakeholders/concerns/viewpoints/model kinds named; C4/arc42 identified as notation *choices* — no 42010 conformance claim unless an explicit mapping to 42010 concepts is produced.
  3. **Run an ATAM evaluation** (CMU/SEI-2000-TR-004, inside the ISO 42030 evaluation frame): utility tree, ≥6 scenarios across performance/availability/modifiability, sensitivity points, trade-off points, risks/non-risks — each risk traceable to a scenario.
  4. **Produce measurable backend evidence** for one service path, using your own harness on infrastructure you own (authorized local exercise): contract/functional test results; **three repeated load runs** reporting p50/p95/p99 latency, throughput, error rate, CPU, and memory per run with harness/version/arrival-process/warmup provenance; one dependency-failure observation; one distributed trace. Open-loop vs closed-loop generator choice is stated; coordinated omission is called out.
- **Pass criteria:** description checklist complete with no unmapped conformance claim; ATAM risks trace to scenarios; every number is real and repeatable — **no fabricated results; anything not measured is recorded as "not measured."**

## Lab 16 — PostgreSQL PITR drill (measured RTO/RPO)

- **Goal:** prove a point-in-time recovery path with verified restore and measured — not targeted — RTO/RPO.
- **Stack/fixtures:** owned local PostgreSQL 18 with WAL archiving; `pg_basebackup` (docs source `doc/src/sgml/ref/pg_basebackup.sgml`); a small write workload with a transaction log.
- **Steps:** take a base backup; run the workload and record the last committed transaction/LSN; destroy the data directory; restore base backup + replay WAL to a recovery target time; verify the restore with **row counts per table and aggregate checksums** against the pre-failure snapshot.
- **Pass criteria:** counts/checksums match the recovery target; **RTO (destroy → verified-restore wall time) and RPO (recovered time vs failure time) reported as measured values**; the restore runbook is written and repeatable.

## Lab 17 — PostgreSQL tuning with before/after evidence

- **Goal:** make one justified tuning change and demonstrate its effect with repeatable evidence.
- **Stack/fixtures:** owned local PostgreSQL; `pgbench` with recorded scale/clients/script (`doc/src/sgml/ref/pgbench.sgml`); `pg_stat_statements` enabled (`doc/src/sgml/pgstatstatements.sgml`); `EXPLAIN (ANALYZE, BUFFERS)`; monitoring views per `doc/src/sgml/monitoring.sgml`; isolation semantics per `doc/src/sgml/mvcc.sgml`.
- **Steps:** baseline **three repeated pgbench runs**; identify the top statements in pg_stat_statements; change exactly one thing (index, extended statistics, or a single config parameter) justified from the monitoring evidence; run **three repeated pgbench runs** after; capture plan diffs.
- **Pass criteria:** median-of-three before/after comparison with variance visible; EXPLAIN ANALYZE + pg_stat_statements deltas attached; conclusion traces to evidence — honest "no change/regression" is a pass, fabricated or cherry-picked numbers are a fail.

## Scored evaluation tasks (adversarial where marked)

1. **ADR set.** Given a growth-stage product brief, produce ≥3 ADRs choosing between modular monolith and microservices; scoring rewards explicit quality-attribute trade-offs and penalizes resume-driven design.
2. **Plan diagnosis.** Given a Postgres `EXPLAIN ANALYZE` dump with row-estimate divergence, localize the statistics problem and propose the cheapest correct fix. (Ground-truthed against lab 5.)
3. **Raft safety audit (adversarial).** Given a partition scenario and a Raft implementation sketch, identify which of four safety properties it violates — one is a subtle §5.4-style election-restriction bug.
4. **Stale-cache incident.** Given a "we added a cache and users see stale data" incident, produce the failure-mode diagnosis, a mitigation with an explicit consistency window, and the SLO impact statement.
5. **Expand/contract plan.** Given a schema change request (`users.email` → `user_emails` table, 200M rows), write the expand/contract plan with compatibility windows, backfill strategy, and rollback; scoring penalizes any step that takes `ACCESS EXCLUSIVE` without `lock_timeout` discipline.
6. **License/lifecycle audit.** Given a dependency list including Redis 8, Valkey 9, MongoDB 8, CockroachDB 26, produce a compliant-use matrix (as of the audit date) with citations — scoring checks the Redis tri-license and Cockroach Core-retirement facts specifically.
7. **Benchmark falsification design.** Given a vendor benchmark (labeled **[V]**), design the independent benchmark that would confirm/refute it, naming coordinated-omission and warmup pitfalls to avoid.
8. **Pinned-source comprehension.** Read a pinned path in a case-study repo (e.g., Postgres `nbtree` README, Kafka replication docs) and answer five comprehension questions whose wrong answers are the common blog myths.
9. **Architecture-description review.** Given a reverse-architecture pack (arc42 + C4 + ADRs, as produced by lab 15), score it against the ISO 42010 description checklist; scoring penalizes any 42010/C4/arc42 conformance claim stated without an explicit mapping, missing stakeholder→concern→viewpoint traceability, and ATAM risks that do not trace back to scenarios. (Ground-truthed against lab 15.)

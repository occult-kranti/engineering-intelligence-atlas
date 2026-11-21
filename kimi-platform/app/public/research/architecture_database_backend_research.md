# Software Architecture, Database Systems & Backend Engineering — Research Library

**Purpose:** canonical knowledge base for three dedicated specialist agents (Software Architecture Principal, Database Systems Engineer, Backend/Platform Staff Engineer) and one proposed composite skill `architecture-database-backend-engineering`.

**Point-in-time baseline:** 2026-11-20 (all version, license, and lifecycle claims verified against official sources or the GitHub REST API on this date; repository state pinned to the commit SHAs recorded in `architecture_backend_repo_cases.json`). The §1.2 standards additions (ISO 42010/42030, ATAM), the §14.1 operational recovery/tuning guidance, and the `dotnet/eShop` case were added and verified **2026-11-21**.

**Method constraints:** no repository was cloned or executed. All code-level claims come from reading official documentation, source-tree layout as exposed via the GitHub API/web UI at pinned commits, authoritative papers, and course materials. Where a claim is vendor-reported rather than independently verified, it is labeled **[V]**; community/course material is labeled **[C]**; official documentation/API observation is labeled **[O]**.

---

## 1. Software architecture styles and their trade-offs

Architecture is the set of decisions that are expensive to reverse. The discipline is: identify the quality attributes that matter (latency, throughput, availability, consistency, evolvability, operability, security, cost), then choose the *least* structure that satisfies them.

### 1.1 Major styles

| Style | Strengths | Costs / failure modes | When it wins |
|---|---|---|---|
| **Layered / n-tier** | Familiar, clear separation of concerns | Tends toward "architecture sinkhole" anti-pattern (pass-through layers); change ripples vertically | Small CRUD systems, teams with mixed seniority |
| **Modular monolith** | Single deployable, strong module boundaries, transactions across modules are cheap | Requires enforced boundaries (package-private APIs, dependency rules) or it decays into a big ball of mud | Default starting point; most systems < ~50 engineers |
| **Microservices** | Independent deployability/scaling, team autonomy, fault isolation | Distributed-systems tax on every interaction: partial failure, eventual consistency, distributed tracing, schema contracts, operational sprawl | Large orgs with stable domain boundaries and platform maturity |
| **Hexagonal / ports & adapters (clean/onion)** | Domain logic isolated from frameworks/DB; testability | Boilerplate; over-abstraction in simple apps | Long-lived domain cores, multiple delivery mechanisms |
| **Event-driven (pub/sub, EDA)** | Temporal decoupling, natural audit trail, scalability | Debugging and ordering are hard; schema evolution of events is load-bearing; "event-carried state transfer" vs "event notification" confusion | Integration of many consumers, streaming/analytics coupling |
| **CQRS / event sourcing** | Read/write models optimized independently; full history | Eventual consistency between models; event schema versioning forever; replay cost | High-audit domains (finance, ledgers); rarely whole-system |
| **Pipes & filters / batch** | Composable, restartable stages | Latency; intermediate state management | ETL, media pipelines |
| **Serverless / FaaS** | Zero idle cost, managed scaling | Cold starts, vendor lock-in, local-dev gap, state moved outward | Spiky/event workloads, glue logic |

Trade-off framings worth institutionalizing:
- **Fallacies of distributed computing** (Deutsch/Gosling): the network is not reliable, latency is not zero, bandwidth is not infinite, the network is not secure, topology changes, there is more than one administrator, transport cost is not zero, the network is not homogeneous. Every microservice boundary decision should be re-checked against this list.
- **Coupling has dimensions**: static (imports), runtime (synchronous calls), deployment (shared release), data (shared schema), semantic (shared business rule). Microservices trade static coupling for runtime+operational coupling — often a bad trade for small teams.
- **Architecture Decision Records (ADRs):** one-page, numbered, immutable-after-accept records (context → decision → consequences). See [Michael Nygard's original post](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions) and the [ADR GitHub org](https://adr.github.io/). **[O]**
- **Fitness functions** (Ford/Parsons/Kua, *Building Evolutionary Architectures*, 2nd ed. 2023): automate architecture governance (dependency rules via ArchUnit/import-linter, latency budgets in CI) instead of relying on review vigilance. **[O]**

Authoritative anchors: [arc42 template](https://arc42.org/), [C4 model](https://c4model.com/) (diagramming at system-context/container/component/code zoom levels), [AWS Well-Architected Framework](https://docs.aws.amazon.com/wellarchitected/latest/framework/welcome.html) (six pillars incl. sustainability), [Google SRE book — ch. on software engineering in SRE](https://sre.google/sre-book/software-engineering-in-sre/). **[O]**

### 1.2 Architecture description and evaluation standards

- **ISO/IEC/IEEE 42010:2022** ([iso.org/standard/74393.html](https://www.iso.org/standard/74393.html)) governs **architecture descriptions** — requirements for the structure and expression of an AD, and for architecture description frameworks (ADF), architecture description languages (ADL), architecture viewpoints, and model kinds. Per its own scope statement, it does **not** specify an architecting process, method, model, notation, technique, or tool, and does **not** specify any format or medium for recording an AD. Practical consequence: **C4 and arc42 can be used to produce an architecture description, but neither may be claimed "42010-conformant" without an explicit mapping** of their constructs to 42010 concepts (viewpoints, model kinds, correspondences). **[O]** (scope verified 2026-11-21)
- **ISO/IEC/IEEE 42030:2019** ([iso.org/standard/73436.html](https://www.iso.org/standard/73436.html)) specifies the means to **organize and record architecture evaluations**: validate that architectures address stakeholder concerns, assess quality/value against purpose, identify risks and opportunities, and support decision-making. It evaluates the *architecture*, distinct from evaluating the *description* (the 42010 side). **[O]** (scope verified 2026-11-21)
- **SEI ATAM** (Kazman, Klein, Clements; [CMU/SEI-2000-TR-004](https://resources.sei.cmu.edu/library/asset-view.cfm?assetid=5177)) is the canonical concrete evaluation method: quality-attribute utility tree → scenario elicitation → architectural approaches → **sensitivity points, trade-off points, risks and non-risks**. Use it as the working method inside a 42030-style evaluation frame. **[O]** (verified 2026-11-21)
- An **ISO 42010 description checklist** for any architecture document: stakeholders and their concerns named; viewpoints selected with rationale; each view's model kinds declared; correspondences between views recorded; decisions traceable to concerns; the ADL/template (arc42, C4, other) identified as a *choice*, not a conformance claim.

## 2. Domain modeling

- **Strategic DDD first, tactical patterns second.** Bounded contexts, context maps (partnership, shared kernel, customer–supplier, conformist, anticorruption layer, open host service, published language), and the ubiquitous language are what survive contact with reality; entities/value-objects/aggregates/repositories are implementation detail. Reference: Evans (2003), Vernon (2013); distilled in [Domain-Driven Design Reference](https://www.domainlanguage.com/wp-content/uploads/2016/05/DDD_Reference_2015-03.pdf). **[O]**
- **Aggregates are consistency boundaries:** an aggregate is the unit loaded/stored transactionally and the unit of concurrency control. Rule of thumb: one transaction, one aggregate; cross-aggregate coordination via domain events or sagas. Oversized aggregates create contention and lock escalation; undersized ones push invariants into application code where they race.
- **Data modeling is a second, independent discipline.** Relational: normalization to 3NF/BCNF as the default, deliberate denormalization documented as a derived-data decision. Dimensional (Kimball/star schema) for analytics; Data Vault for auditable EDW hubs. NoSQL modeling is **query-first**: enumerate access patterns, then design keys/documents; denormalization and duplication are the norm and must carry an ownership/consistency story. See [MongoDB data modeling docs](https://www.mongodb.com/docs/manual/data-modeling/) and [DynamoDB best practices](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/best-practices.html). **[O]**
- **Data on the outside vs. inside** (Pat Helland, 2005, [paper](https://www.ics.uci.edu/~cs223/papers/cidr05.pdf)): data crossing service boundaries is immutable, referential, and versioned ("events/messages"); data inside a service is current and mutable. This single framing explains outbox patterns, event schemas, and API contracts. **[O]**

## 3. APIs and service contracts

- **REST/HTTP:** treat HTTP semantics as the API: safe/idempotent methods (`GET`, `PUT`, `DELETE`, `HEAD`), status codes, `ETag`/`If-Match` for optimistic concurrency, `Prefer: respond-async` for long ops. Use [RFC 9457 problem+json](https://www.rfc-editor.org/rfc/rfc9457) error bodies. Contract via [OpenAPI 3.1](https://spec.openapis.org/oas/v3.1.0). **[O]**
- **Idempotency is a protocol feature, not a hope:** idempotency keys for unsafe retries (pattern canonicalized by [Stripe's API](https://docs.stripe.com/api/idempotent_requests)); server stores key→response for a retention window. **[O]**
- **gRPC/Protobuf:** schema-first, code-generated, HTTP/2 streaming; strong for internal east–west traffic; see [gRPC docs](https://grpc.io/docs/) and [Buf's Protobuf style guide](https://buf.build/docs/best-practices/style-guide). Breaking-change rules: never reuse field numbers, reserve removed fields.
- **GraphQL:** client-driven selection; costs move to the server — require depth/complexity limits, persisted queries, and N+1 protection (dataloader pattern). [GraphQL best practices](https://graphql.org/learn/best-practices/). **[O]**
- **Async contracts:** [AsyncAPI](https://www.asyncapi.com/docs/reference/specification/v3.0.0) for message/channel/schema; define ordering keys, dedup semantics, DLQ policy in the contract, not the wiki.
- **Versioning:** additive-only evolution for events/Protobuf; explicit version negotiation for REST (`/v2/` or media-type). Sunset headers ([RFC 9745 `Deprecation`](https://www.rfc-editor.org/rfc/rfc9745.html)). **[O]**
- **Pagination:** cursor-based (keyset) over offset — offset pagination is O(n²) on live data and duplicates/skips under writes. [Use The Index, Luke on keyset pagination](https://use-the-index-luke.com/no-offset). **[O]**

## 4. Distributed systems foundations

- **Partial failure is the defining property** — a distributed system is one where the failure of a computer you didn't know existed can render your own computer unusable (Lamport). Design for messages lost, delayed, duplicated, reordered; processes paused arbitrarily long (GC, VM stall, container throttle); clocks that drift and jump.
- **Time and clocks:** physical clocks (NTP error bounds are real; leap smear), logical clocks (Lamport, vector clocks for causality), hybrid logical clocks (HLC, used by CockroachDB/YugabyteDB for commit timestamps), TrueTime (Spanner's tight uncertainty interval enabling external consistency). Reference: [Spanner paper (OSDI 2012 / TOCS 2013)](https://research.google/pubs/spanner-googles-globally-distributed-database/). **[O]**
- **Impossibility results that shape design:** FLP (no deterministic consensus in async systems with one faulty process — so consensus uses randomization/partial synchrony), CAP (under partition, choose availability or consistency), **PACELC** (Abadi: if Partition then A/C **Else** Latency/Consistency — the normal-case latency/consistency trade is the more useful everyday lens). [PACELC paper](https://www.cs.umd.edu/~abadi/papers/abadi-pacelc.pdf). **[O]**
- **Delivery semantics:** at-most-once (drop), at-least-once (retry ⇒ duplicates ⇒ dedup/idempotency downstream), *effectively-once* = at-least-once delivery + idempotent processing + transactional state commit. "Exactly-once delivery" over a network does not exist (Two Generals). Kafka "exactly-once semantics" is exactly-once *state updates within Kafka*, not end-to-end — see [KIP-98](https://cwiki.apache.org/confluence/display/KAFKA/KIP-98+-+Exactly+Once+Delivery+and+Transactional+Messaging). **[O]**
- **Failure detection:** φ-accrual detectors (Cassandra) output suspicion probability, not binary up/down — avoids the false-positive cascade of naive timeouts.

## 5. Consensus, replication, and sharding

### Consensus
- **Raft** (Ongaro & Ousterhout, [USENIX ATC 2014](https://raft.github.io/raft.pdf)): leader election with randomized timeouts, log replication with commit-on-majority, safety via election restriction (§5.4), joint-consensus membership changes. Understandable ≠ trivial: the dissertation adds leader leases, pre-vote, and client interaction ([Ongaro PhD thesis](https://github.com/ongardie/dissertation)). Production references: `etcd-io/raft` (library, Apache-2.0, v3.7.0 2026-06-23 **[O]**) and HashiCorp `raft` (MPL-2.0, v1.8.0 **[O]**).
- **Multi-Paxos** remains dominant in industrial systems (Spanner, and historically Chubby); Zab (ZooKeeper) is a primary-backup atomic broadcast — relevant historically now that Kafka removed its ZooKeeper dependency (Kafka 4.0, 2025-03-18 **[O]**, [release notes](https://kafka.apache.org/blog)).
- **etcd** is the canonical small-footprint case: Raft + MVCC + watch, ~few-hundred-K lines of Go, used as Kubernetes' metadata store. Verified 2026-11-20: `etcd-io/etcd` v3.7.4 (2026-11-19), Apache-2.0, CNCF Graduated **[O]** ([cncf.io](https://www.cncf.io/projects/etcd/)).

### Replication
- **Single-leader:** sync (durable but stall-prone), semi-sync (MySQL), async (fast, data-loss window = replication lag on failover). Always define the failover data-loss budget (RPO) before choosing.
- **Multi-leader:** conflict resolution is the price (LWW loses data; CRDTs and merge logic preserve it). Use cases: multi-region writes, offline-first (see [Ink & Switch's local-first essay](https://www.inkandswitch.com/local-first/) and Kleppmann's [Automerge](https://github.com/automerge/automerge) **[O]**).
- **Leaderless (Dynamo-style):** quorum R+W>N gives *probabilistic* freshness, not a guarantee; sloppy quorums trade consistency for availability during partitions; read repair + anti-entropy (Merkle trees) converge replicas. Cassandra (Apache-2.0, trunk active 2026-11-20 **[O]**) and ScyllaDB remain the readable references; Amazon's [Dynamo paper (SOSP 2007)](https://www.allthingsdistributed.com/files/amazon-dynamo-sosp2007.pdf) is still the best motivation. **[O]**
- **Replication lag is a user-visible consistency model:** read-your-writes, monotonic reads, consistent prefix must be engineered (read-from-leader, timestamp tokens, session stickiness).

### Sharding
- **Key → partition mapping:** hash (uniform, no range scans), range (scans, hot-spot risk on monotonic keys — the classic UUIDv4 vs UUIDv7 trade; UUIDv7 (time-ordered) entered PostgreSQL 18 **[O]** [docs](https://www.postgresql.org/docs/18/datatype-uuid.html)), consistent hashing / rendezvous (HRW) for cache-like rebalance minimization, directory/lookup table (Vitess).
- **Rebalancing is the hard part:** virtual buckets (Cassandra vnodes, 256/token-range), dynamic splitting (Bigtable/HBase/CockroachDB range splits at size/load thresholds), and re-sharding tooling (Vitess VReplication). Vitess v24.0.5 (2026-10-13), Apache-2.0, CNCF Graduated **[O]** ([repo](https://github.com/vitessio/vitess)).
- **Vitess stays conditional/advanced:** it is sharding middleware + HA orchestration for MySQL at YouTube-derived scale — adopt only when single-writer limits, shard count, and operational maturity demonstrably justify a stateless-router + per-instance-agent + topology-service fleet. Default path first: vertical headroom, native partitioning, read replicas, and (PostgreSQL-side) operational recovery/tuning discipline (§14.1); sharding is the last resort, not the second.
- **Cross-shard transactions** collapse to 2PC (or Percolator-style commit points in TiKV); cross-shard *queries* become scatter-gather with tail-latency amplification — the shard key is the most consequential schema decision in a distributed database.
- **Rebalancing skew/failure modes:** hot shard (celebrity key), thundering move during traffic peak, orphaned splits after partial failure — see the failure-mode catalog (§23).

## 6. Transactions and consistency

- **Isolation levels are defined by the anomalies they forbid, not by textbook prose.** Adya's formalization (1999) and the Berenson et al. critique of the SQL standard are the correct mental model; [Martin Kleppmann's Hermitage](https://github.com/ept/hermitage) test suite maps each level to concrete anomalies per database — essential reading before claiming "we run serializable." **[O]**
- Reality check (verified in vendor docs 2026-11-20): PostgreSQL `SERIALIZABLE` = SSI (predicate-lock based, [docs](https://www.postgresql.org/docs/current/transaction-iso.html)); MySQL/InnoDB `REPEATABLE READ` blocks phantom via next-key locks; CockroachDB defaults to serializable with uncertainty windows; Oracle "serializable" is snapshot isolation (write skew possible). **[O]**
- **MVCC mechanics:** PostgreSQL keeps old row versions in-heap (VACUUM reclaims; bloat and XID wraparound are operational realities — see §23), InnoDB keeps undo-log versions, CockroachDB/TiKV keep MVCC in the storage engine with GC at a TTL.
- **Concurrency control families:** 2PL (deadlocks need detection/wait-die/wound-wait), MVCC+SSI, OCC (validation at commit — good under low contention, abort storms under high), timestamp ordering (Calvin-style deterministic execution eliminates distributed deadlocks at the cost of pre-declared read/write sets).
- **Distributed transactions:** 2PC blocks on coordinator failure (the classic reason it's avoided in user-facing paths); **sagas** (process manager + compensating actions, [Garcia-Molina & Salem 1987](https://www.cs.cornell.edu/andru/cs711/2002fa/reading/sagas.pdf)) trade atomicity for semantic compensation — compensate ≠ roll back (money already moved). TCC (try-confirm-cancel) is the reservation-shaped variant. **[O]**
- **Consistency spectrum:** linearizability (single-object, real-time order — expensive, needs consensus), sequential consistency, causal, PRAM, eventual. Session guarantees layer on top. Linearizable reads on Raft require leader lease or read-index round trip — the default "read from leader" optimization is *not* linearizable without these; etcd's `Serializable` vs `Linearizable` read flag makes this explicit ([etcd API docs](https://etcd.io/docs/v3.6/learning/api_guarantees/)). **[O]**
- **Independent verification culture:** [Jepsen analyses](https://jepsen.io/analyses) (Aphyr) — two decades of vendor consistency claims tested against adversarial network partitions; required reading before believing any "linearizable" marketing. **[O]**

## 7. Storage engines: B-trees, LSMs, WAL, buffer pools

- **B+tree engines** (InnoDB, PostgreSQL's nbtree, SQLite): in-place update, page-oriented, excellent reads/ranges; costs are write amplification from random page updates + full-page-write WAL (Postgres) / doublewrite buffer (InnoDB), and buffer-pool management. Read paths in source: PostgreSQL `src/backend/access/nbtree/`; SQLite `src/btree.c`. **[O]**
- **LSM-tree engines** (RocksDB, Cassandra, ScyllaDB, LevelDB, TiKV's raft-engine→RocksDB): buffer writes in memtable → flush immutable sorted runs (SSTables) → background compaction. Wins: write throughput, compression, sequential I/O. Costs: read amplification (mitigated by Bloom filters per run), space amplification (mitigated by leveled vs tiered compaction choice), and **compaction stalls** — the operational signature of LSM systems under sustained write bursts. RocksDB (`meta/rocksdb`, dual-licensed Apache-2.0 OR GPL-2.0; repo moved from `facebook/rocksdb` — 301 redirect observed 2026-11-20 **[O]**): read `db/`, `table/`, `include/rocksdb/options.h` for the full leveled/universal compaction option surface.
- **The RUM conjecture** (Athanassoulis et al. 2016): optimizing Read, Update, or Memory overheads — pick two. Useful as a review question: "which RUM overheads does this design deliberately spend?"
- **WAL & recovery:** ARIES (Mohan et al. 1992) is the reference algorithm — write-ahead logging, repeating history during redo, compensation log records for undo. CMU 15-445 lectures 20–21 walk ARIES concretely ([course notes](https://15445.courses.cs.cmu.edu/fall2025/)). **[O]**
- **Buffer pool:** LRU is cache-unfriendly to scans; real systems use LRU-K, ARC, or clock-sweep approximations (Postgres clock-sweep; InnoDB midpoint insertion; MySQL "midpoint + young/old" guards against sequential-scan pollution).
- **SQLite** (public domain, [sqlite.org/src](https://sqlite.org/src), mirror `sqlite/sqlite` tag version-3.54.1 pinned 2026-11-20 **[O]**) is the most-read production storage-engine codebase in the world: single-file B-tree, rollback-journal **and** WAL modes (WAL = readers don't block writers), and an obsessive testing culture — [sqlite.org/testing.html](https://sqlite.org/testing.html) documents ~590× more test code than code (TH3, fuzzing, anomaly testing). **[O]**

## 8. Query planning, optimization, and execution

- **Architecture:** parser → binder/analyzer → logical plan → cost-based optimizer → physical plan → executor. Two optimizer families: **Volcano/top-down rule engines** vs **Cascades** (memoized group expressions; used in CockroachDB `pkg/sql/opt`, Orca, Calcite). Columbia/Cascades lineage: Graefe's [Cascades paper (1995)](https://15721.courses.cs.cmu.edu/spring2018/papers/15-optimizer1/graefe-icde1995.pdf). **[O]**
- **Cost model inputs:** statistics (histograms, MCV lists, NDV estimates — Postgres `pg_stats`, `ANALYZE`), cardinality estimation errors compound **exponentially through join chains** — the classic cause of "the optimizer chose a nested loop over 10M rows." Mitigations: extended statistics (Postgres `CREATE STATISTICS`), adaptive execution (Spark AQE), and plan forcing as a documented escape hatch.
- **Execution models:** Volcano iterator (tuple-at-a-time) vs **vectorized** (batch-at-a-time, cache/SIMD friendly — MonetDB/X100 lineage, DuckDB, ClickHouse) vs compiled (HyPer, Postgres 11+ LLVM JIT for expression evaluation). DuckDB (MIT, v2.0.1 released 2026-11-20 **[O]**) is the cleanest readable vectorized engine; its [documentation of the execution format](https://duckdb.org/docs/stable/internals/vector) is a model internals doc.
- **Joins:** nested-loop (indexed), hash (build/probe, grace hybrid for spills), sort-merge; distributed: broadcast vs shuffle (the Spark/MPP decision), semi-join reduction. Predicate/projection pushdown into storage (Parquet row-group skipping via min/max stats + Bloom filters) is the single biggest OLAP lever.
- **Plan observability:** `EXPLAIN (ANALYZE, BUFFERS)` in Postgres — buffers hit vs read tells you cache reality; `estimated vs actual rows` divergence localizes statistics problems. Reading real plans is a core lab skill (§24).

## 9. Indexing

- B+tree (default, ordered ops), hash (Postgres hash is WAL-logged since PG10 — was a famous "don't use" footgun before), **GiST** (generalized search tree: PostGIS geometry, `tsvector` range types), **GIN** (inverted: arrays, JSONB, full-text), **BRIN** (block-range: tiny, for naturally clustered big tables), covering indexes (`INCLUDE`), partial indexes (the highest-leverage index type most teams underuse), expression indexes.
- **Write cost law:** every index is a write tax + WAL volume + vacuum work. Index audit (`pg_stat_user_indexes.idx_scan = 0`) is a recurring ops task.
- **Secondary indexes on LSM stores:** global (base-table-like, needs distributed transaction to stay consistent — TiKV/CockroachDB) vs local (per-partition, scatter-gather queries — Cassandra SASI, DynamoDB LSI vs GSI).
- **Vector indexes:** HNSW (graph ANN, high recall/latency trade, memory-heavy) vs IVF/PQ (compressed, lower memory); `pgvector` (HNSW + IVFFlat in Postgres) vs purpose-built engines. In 2026, HNSW also shipped in Redis 8 Vector Sets and Valkey module ecosystems **[V/O]** — ANN recall/latency claims are vendor-reported until benchmarked on your data.
- **Learned indexes** (Kraska et al. 2017) — influential research direction; treat as research, not default production practice.

## 10. Caching

- **Patterns:** cache-aside (lazy; most common; stale window + race on miss-storm), read-through/write-through, write-behind (fast, data-loss window), refresh-ahead. **[O]** ([AWS caching patterns](https://docs.aws.amazon.com/whitepapers/latest/database-caching-strategies-using-redis/caching-patterns.html))
- **The three classic failure modes:** **penetration** (queries for nonexistent keys bypass cache → Bloom-filter or cache-null), **breakdown/hot-key** (single hot key expires → mutex/singleflight or logical TTL), **avalanche** (mass simultaneous expiry → TTL jitter). Add stampede protection (request coalescing; Go's `singleflight`, Caffeine's loading cache).
- **Coherence:** TTL is the only honest default; explicit invalidation needs versioning (`key:v3`) or pub/sub invalidation (Redis 6 client-side caching / keyspace notifications; Valkey inherits).
- **Multi-tier:** client/edge (CDN, HTTP cache headers: `Cache-Control`, `ETag`, `stale-while-revalidate`) → application local (Caffeine/ristretto) → shared (Valkey/Redis/memcached). Each tier adds an invalidation surface.
- **Engines, verified 2026-11-20:** Valkey 9.2.0 (2026-11-19, BSD-3-Clause, Linux Foundation) **[O]**; Redis 8.10.3 (2026-10-26) — license history: BSD ≤7.2 → dual RSALv2/SSPLv1 at 7.4 (2024-03-20) → tri-license RSALv2/SSPLv1/AGPLv3 from 8.0 (2025-05-01), per [redis.io/legal/licenses](https://redis.io/legal/licenses/) **[O]**; memcached (BSD, steady). Dragonfly is source-available BSL — flag for license review. **[O]**

## 11. Queues and streaming

- **The log abstraction** (Jay Kreps, ["The Log"](https://engineering.linkedin.com/distributed-systems/log-what-every-software-engineer-should-know-about-real-time-datas-unifying)) unifies replication logs, commit logs, and event streams. Kafka's design docs on [replication](https://kafka.apache.org/documentation/#replication) (ISR, high watermark, `unclean.leader.election`, `min.insync.replicas`) remain the best free replication-semantics documentation. **[O]**
- **Kafka lifecycle (verified 2026-11-20):** current release 4.4 (Oct 2026); KRaft-only since 4.0 (2025-03-18, ZooKeeper removed — [KIP-500](https://cwiki.apache.org/confluence/display/KAFKA/KIP-500)); 3.9 was the bridge release and is archived; Apache supports roughly the latest three minors (4.2–4.4) **[O]** ([kafka.apache.org/downloads](https://kafka.apache.org/downloads)). License Apache-2.0; Confluent add-ons are Confluent Community License (source-available) — do not conflate. Share groups (KIP-932, queue semantics) production-ready in 4.2; DLQs for share groups in 4.4 (KIP-1191) **[O]**.
- **Producer/consumer correctness knobs:** `acks=all` + `min.insync.replicas=2` + idempotent producer (default since 3.0) for no-loss/no-dup within Kafka; consumer rebalances (KIP-848 cooperative protocol GA in 4.0) still cause duplicate processing — design consumers idempotent anyway. **[O]**
- **NATS** (`nats-io/nats-server` v2.15.3, 2026-11-11, Apache-2.0, CNCF) **[O]**: core NATS = at-most-once fire-and-forget; **JetStream** adds persistence, at-least-once, KV and object store on streams — a good minimal case study in "queue semantics layered on subjects."
- **RabbitMQ** (classic work queue: per-message ack/nack, TTL+DLX, quorum queues use Raft) vs Kafka (replayable log): the decision axis is *replay+ordering+throughput* vs *routing+per-message control*. **[O]**
- **Transactional outbox/inbox:** never dual-write DB + broker (partial failure between the two is not rare); write the event in the same DB transaction, publish via CDC (Debezium) or poller; consumers dedup via inbox table. See [microservices.io pattern catalog](https://microservices.io/patterns/data/transactional-outbox.html). **[O]**
- **Backpressure:** credit-based (gRPC flow control, Reactive Streams), bounded queues + load shedding; unbounded queues are latency bombs (Little's law, §15).

## 12. Resilience engineering

- **Retry policy discipline:** bounded retries, exponential backoff + full jitter ([AWS Architecture Blog: jitter](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/)), only retry idempotent operations or with idempotency keys, honor `Retry-After`, and set **deadlines end-to-end** (gRPC deadline propagation) so retries can't multiply. Retry storms = multiplicative load amplification across layers. **[O]**
- **Circuit breaker** (state machine closed/open/half-open; Resilience4j/Polly), **bulkheads** (separate thread pools/connection pools per dependency), **load shedding** (drop cheap-to-reject work early; Netflix's concurrency-limits library, adaptive concurrency in gRPC), **rate limiting** (token bucket; fail-open vs fail-closed is a business decision).
- **Timeouts everywhere:** every network call, every lock acquisition, every queue wait. Absent a deadline, thread pools drain and queues grow (Hystrix-era lesson, [Netflix tech blog archives](https://netflixtechblog.com/fault-tolerance-in-a-high-volume-distributed-system-91ab4faae74a)). **[O]**
- **Graceful degradation:** critical-path inventory; each dependency gets a documented degraded mode (serve stale cache, default response, queue for later). Test degraded modes in staging — untested fallbacks are bugs waiting.
- **Chaos/fault injection:** start with dependency failure drills (kill -STOP a dependency, inject 500ms latency, corrupt DNS) before "chaos monkey" glamour; AWS FIS / Chaos Mesh / Toxiproxy. Jepsen-style nemesis testing for data systems (§17). **[O]**
- **DR:** define RTO/RPO per service tier; backups are worthless without **tested restores** (restore drills as scheduled exercises); multi-AZ is an availability feature, multi-region is a DR/consistency product decision.

## 13. Observability

- **Three signals with distinct jobs:** metrics (aggregates, alerting), logs (events, debugging), traces (causality across services). [OpenTelemetry](https://opentelemetry.io/docs/) (CNCF) is the vendor-neutral instrumentation standard — use OTel SDKs + semantic conventions, export OTLP. **[O]**
- **SLO practice:** SLI (good/total events, measured at the client where possible), SLO target, error budget (1−SLO) as the release-velocity control valve; burn-rate alerting (multiwindow, multi-burn-rate — [Google SRE Workbook ch. 5](https://sre.google/workbook/alerting-on-slos/)). **[O]**
- **RED** (rate, errors, duration) for services, **USE** (utilization, saturation, errors) for resources ([Brendan Gregg](https://www.brendangregg.com/usemethod.html)). **[O]**
- **Cardinality discipline:** high-cardinality label values (user IDs in metric labels) are the classic metrics-ystem outage cause; exemplars link metrics→traces.
- **Tail latency observability:** percentiles must be computed on histograms (HDR/t-digest/DDSketch), never averaged across instances; p99.9 exists and is somebody's every-request experience at scale.
- **Continuous profiling** (pprof, Pyroscope/Grafana, eBPF-based) closes the loop between observability and performance work.

## 14. Performance engineering

- **Laws:** Little's law (L=λW — queue depth = throughput × latency; unbounded queues convert latency problems into memory death), Amdahl (serial fraction caps parallel speedup), Universal Scalability Law (Gunther — adds contention σ and coherency κ; explains why systems *retrograde* under load).
- **Method before tools:** define workload (arrival process!), then measure; USE for bottleneck localization; differentiate load-testing (pre-generated traffic) vs production reality (open-loop vs closed-loop load generators — coordinated omission is the #1 benchmarking lie; see Gil Tene's ["How NOT to Measure Latency"](https://www.infoq.com/presentations/latency-response-time/)). **[O]**
- **Percentile discipline:** p50 is marketing; p99/p99.9 with max, and report measurement interval.
- **Common backend hot spots:** N+1 queries, missing covering index, connection-pool exhaustion (pool sizing ≈ ((core_count × 2) + effective_spindle_count) per [Postgres wiki / HikariCP](https://github.com/brettwooldridge/HikariCP/wiki/About-Pool-Sizing)), lock contention on hot rows (counters — batch or shard them), GC pauses, TLS handshake costs without session resumption, serialization costs (JSON vs Protobuf), per-request allocations. **[O]**
- **Databases:** the top three real-world wins are (1) fixing cardinality-estimation disasters visible in `EXPLAIN ANALYZE`, (2) adding the right composite/partial index, (3) batching writes into transactions instead of per-statement commits (each commit = an fsync; group commit amortizes it).

### 14.1 Database operational recovery and tuning (PostgreSQL)

Operational truth lives in the PostgreSQL documentation itself — read the source of the docs at the pinned commit (`postgres/postgres`, SGML sources) **[O]**:

- `doc/src/sgml/mvcc.sgml` — MVCC chapter: transaction isolation semantics, visibility rules, SSI; the normative reference before claiming any isolation behavior.
- `doc/src/sgml/monitoring.sgml` — the statistics collector and `pg_stat_*` views, progress reporting: the observability surface for tuning.
- `doc/src/sgml/pgstatstatements.sgml` — `pg_stat_statements`: normalized per-query execution statistics (calls, total/mean time, rows, buffer hits) — the evidence source that replaces guessing about "slow queries."
- `doc/src/sgml/ref/pgbench.sgml` — `pgbench`: the built-in, repeatable load generator; use it for before/after tuning comparisons so runs are reproducible by anyone.
- `doc/src/sgml/ref/pg_basebackup.sgml` — `pg_basebackup`: physical base backup; combined with WAL archiving and replay to a recovery target it is the foundation of point-in-time recovery (PITR).

Practice anchors (labs 16–17, §24): a **PITR drill** is not done until the restore is verified — row counts and checksums against the pre-failure database, with **measured RTO (time to verified restore) and RPO (last committed transaction recovered vs failure time)**, not estimates. **Tuning** claims require three repeated `pgbench` runs before and after the change (median, not best), with `EXPLAIN (ANALYZE, BUFFERS)` and `pg_stat_statements` output attached as evidence; no fabricated numbers — unmeasured claims stay labeled estimates. Vitess (§5) remains the conditional/advanced escalation for sharding/HA, after native recovery and tuning discipline is in place.

- **Threat modeling:** STRIDE per data-flow-diagram element; [OWASP Threat Modeling](https://owasp.org/www-community/Threat_Modeling) + [ASVS](https://owasp.org/www-project-application-security-verification-standard/) as verification checklist. **[O]**
- **OWASP Top 10 (2021)** + **API Security Top 10 (2023)** — broken object-level authorization (BOLA/IDOR) is #1 and is *not* solved by frameworks: enforce object ownership checks in the data-access layer, not controllers. **[O]**
- **AuthN/Z:** OIDC on OAuth 2.1 (PKCE everywhere, implicit deprecated — [OAuth 2.1 draft](https://oauth.net/2.1/)); tokens short-lived; authorization modeled explicitly (RBAC/ReBAC; Zanzibar-style relationship tuples — [Google Zanzibar paper](https://research.google/pubs/zanzibar-googles-consistent-global-authorization-system/) — when permissions are graph-shaped). **[O]**
- **Data protection:** TLS 1.3 in transit (mTLS for service-to-service, SPIFFE/SPIRE for workload identity), envelope encryption at rest (KMS-managed KEKs), field-level encryption/tokenization for PII crowns; key rotation drills.
- **Secrets:** never in env/files long-lived; short-lived credentials (Vault dynamic secrets, IAM instance roles); scan history (gitleaks/trufflehog) — leaked-and-rotated beats leaked-and-deleted.
- **Supply chain:** pin dependencies by digest, SBOM (CycloneDX/SPDX), SLSA provenance, Sigstore signing; the 2024–2026 wave of CI/registry attacks makes this non-optional ([SLSA](https://slsa.dev/)). **[O]**
- **Database-specific:** parameterize everything (no exceptions for "internal" tools), least-privilege roles per service (no shared superuser), row-level security where multi-tenant in shared schema, audit logging of DDL and privilege grants, pgcrypto/vault for sensitive columns, and treat backups as attack surface (encrypted, access-logged).

## 16. Testing and verification

- **Test pyramid with backend specifics:** unit (fast, hermetic) → contract (Pact for HTTP; schema-registry compatibility checks for events) → integration (Testcontainers against *real* Postgres/Kafka, not mocks — mocks encode your assumptions, containers test reality) → end-to-end (few, critical paths). **[O]** ([Testcontainers](https://testcontainers.com/))
- **Property-based testing** (Hypothesis, fast-check, jqwik): generate sequences of operations, assert invariants (e.g., "balance conserved across transfers"). Ideal for caches, serializers, storage adapters.
- **Fault-injection and model-based testing for data systems:** Jepsen (Clojure, nemesis partitions + linearizability checker Elle); **deterministic simulation testing** — FoundationDB's simulator ([FoundationDB testing docs](https://apple.github.io/foundationdb/testing.html)) and TigerBeetle's simulator ([tigerbeetle.com](https://tigerbeetle.com/blog/2023-03-28-simulation)) run the whole cluster in a deterministic event loop with injected faults — the current gold standard for distributed correctness confidence. **[O]**
- **Migration testing:** rehearse on production-shaped snapshots; test the *rollback* path; verify expand/contract compatibility windows (old code + new schema and vice versa).
- **Performance regression:** microbenchmarks in CI are noisy; use dedicated runners, or track coarse integration benchmarks with high-variance alarms.
- **SQLite as the exemplar:** [sqlite.org/testing.html](https://sqlite.org/testing.html) — 100% branch test coverage (TH3), fuzzing (SQLfuzz/dbsqlfuzz), anomaly testing (power-loss, OOM, I/O error injection). This is the bar for "storage engine you trust." **[O]**

## 17. Schema and data migrations; system evolution

- **Expand/migrate/contract** (a.k.a. parallel change): (1) add new column/table (old code ignores it), (2) dual-run/readers-writers shifted via backfill, (3) remove old after the compatibility window closes. Never a single atomic rename on a live system. **[O]**
- **Backwards/forwards compatibility windows:** during rolling deploys, version N and N+1 code coexist against the same schema — every migration must be safe for *both*. `NOT NULL` without default, `DROP`, `RENAME`, and type narrowing are contract-breaking; Postgres specifics: `ADD COLUMN ... DEFAULT` is fast since PG11 (metadata-only), but `ACCESS EXCLUSIVE` lock waits can still stall behind long transactions — set `lock_timeout` in migration runners. **[O]** ([Postgres DDL docs](https://www.postgresql.org/docs/current/ddl-alter.html))
- **Data migrations:** batched backfills with throttling and resume markers (checkpoint by primary key range), never `UPDATE` the whole table in one transaction (table bloat + lock + replication lag storm).
- **Tooling:** migration frameworks (Flyway, Liquibase, goose, Atlas, Drizzle/Prisma migrate), CI gate that applies migrations to a prod-shape snapshot; GitOps-managed.
- **Feature flags** decouple deploy from release; flags need owners, expiry dates, and kill-switch semantics — stale flags are latent bugs (the Knight Capital failure was a repurposed flag, [SEC filing](https://www.sec.gov/files/litigation/admin/2013/34-70694.pdf)). **[O]**
- **Zero-downtime deploys:** rolling (K8s default; needs backward compat), blue/green (fast rollback, double cost), canary (traffic-shaped risk); database compatibility window is the constraint that makes all of them possible.

## 18. Cloud and platform operations

- **Kubernetes** as the default substrate: understand controllers/reconciliation, requests/limits (CPU throttling of latency-sensitive services is the classic mis-tune), pod disruption budgets (what actually protects availability during node drains), and that K8s does **not** solve stateful workloads — operators (e.g., CloudNativePG, Strimzi) encode the operational knowledge. **[O]** ([kubernetes.io docs](https://kubernetes.io/docs/home/))
- **IaC:** Terraform/OpenTofu (OpenTofu is the Linux-Foundation fork after HashiCorp's 2023-08 BSL relicensing; IBM closed the HashiCorp acquisition 2025-02-27 **[O]**) or Pulumi/Crossplane; drift detection and plan review in CI are the control points.
- **Service mesh** (Istio ambient / Linkerd): buys mTLS, traffic policy, telemetry at the cost of an extra failure domain and operational skill — justified at scale, overhead for small platforms.
- **Cost/capacity:** capacity planning via queueing-aware headroom (utilization targets depend on arrival variance — 70% average CPU with spiky arrivals *is* an outage schedule); unit economics (cost per request/order) beat raw bill watching; FinOps framing ([finops.org](https://www.finops.org/)).
- **Operational maturity markers:** on-call runbooks per alert, game days, incident reviews that produce systemic actions (blameless postmortems — [Etsy debriefing facilitation guide](https://extfiles.etsy.com/DebriefingFacilitationGuide.pdf) **[O]**, and SRE book ch. 15 [Postmortem Culture](https://sre.google/sre-book/postmortem-culture/)).

## 19. Data architecture

- **OLTP vs OLAP is physical, not philosophical:** row stores serve point lookups + small-range writes; columnar stores (ClickHouse — Apache-2.0, v26.9 stable 2026-11-20 **[O]**; DuckDB) serve scans + aggregations via compression, vectorization, and zone maps. HTAP (TiDB TiFlash, SingleStore) replicates into both layouts.
- **CDC** (Debezium on Postgres logical decoding / MySQL binlog) is the backbone of cache invalidation, search indexing, outbox publishing, and warehouse sync; understand snapshot→stream handoff and schema-evolution handling. **[O]** ([debezium.io](https://debezium.io/documentation/))
- **Lakehouse:** object storage + open table formats ([Apache Iceberg](https://iceberg.apache.org/spec/), Delta Lake, Hudi) give ACID, schema evolution, time travel on Parquet; Iceberg's hidden partitioning and snapshot model are the 2026 default for new builds **[V/O]**.
- **Warehouse/lakehouse query layers:** Trino/Presto, Spark, DuckDB-in-process; the practical 2026 pattern is "DuckDB for the long tail of analytics, ClickHouse/warehouse for served dashboards." **[V]**
- **Data governance:** ownership per domain (data mesh: domain-oriented ownership, data-as-product, self-serve platform, federated computational governance — Zhamak Dehghani), lineage (OpenLineage/Marquez), quality contracts (Great Expectations/Soda), and retention/deletion as compliance features (GDPR erasure vs immutable event logs is a real design conflict — crypto-shredding is the standard answer).
- **Data mesh reality check:** organizational prerequisite is domain teams capable of owning data products; without it, "mesh" becomes "many data swamps." **[C]**

## 20. Canonical courses (verified current 2026-11-20)

- **CMU 15-445/645 Database Systems** (Andy Pavlo): current site [15445.courses.cs.cmu.edu](https://15445.courses.cs.cmu.edu/) (Fall 2026 live; Spring 2026 archived); four BusTub C++20 projects (buffer pool → B+tree index → query execution → concurrency control), lectures+notes+slides all public, non-CMU students can submit via Gradescope (code published on the course page). **[O]**
- **CMU 15-721 Advanced Database Systems** (graduate, paper-driven: in-memory OLTP, MVCC, vectorized execution, HTAP, learned components): [15721.courses.cs.cmu.edu](https://15721.courses.cs.cmu.edu/). **[O]**
- **MIT 6.5840 (formerly 6.824) Distributed Systems**: [pdos.csail.mit.edu/6.824](https://pdos.csail.mit.edu/6.824/) — four Go labs (MapReduce → Raft KV → sharded KV) with a hostile test harness (partitions, delays, crashes); the lab suite is the single best hands-on consensus education available. **[O]**
- **Stanford CS 245 / MIT 6.5830 (6.830)** (GoDB/SimpleDB labs) as alternates. **[C]**
- **CMU DB Group seminar + YouTube archive**: 585+ indexed videos (DB talks from industry + academia) — the best "state of the art" feed ([db.cs.cmu.edu](https://db.cs.cmu.edu/)). **[O]**

## 21. Canonical references (annotated, not a book list)

Each entry states *what to extract*, because reading without an extraction goal produces trivia, not judgment.

1. **Kleppmann, *Designing Data-Intensive Applications* (2017)** — the spine for parts 4–6, 10–11, 19. Extract the *consistency-spectrum* and *replication-approach* decision tables; note its age: it predates KRaft Kafka, FoundationDB's recovery, Iceberg, and the Redis/Valkey split — cross-check every versioned claim. 2nd ed. drafts circulate via O'Reilly; verify claims against the official docs linked here. **[O]**
2. **Petrov, *Database Internals* (2019)** — storage engines (part I) + distributed data (part II); the clearest B-tree-vs-LSM engineering treatment; pairs with §7–8. **[O]**
3. **Hellerstein, Stonebraker, Hamilton, ["Architecture of a Database System"](http://db.cs.berkeley.edu/papers/fntdb07-architecture.pdf) (2007)** — the one paper that maps the full DBMS process/memory/query architecture; still accurate. **[O]**
4. **Google SRE Book + Workbook** ([sre.google/books](https://sre.google/books/)) — extract SLO/error-budget mechanics, on-call and postmortem culture, overload handling (ch. 21). **[O]**
5. **Ongaro & Ousterhout, Raft paper + dissertation** — extract the §5.4 election-restriction proof sketch and the membership-change joint consensus; then read `etcd-io/raft` to see the engineering delta (pre-vote, leases, learners). **[O]**
6. **Adya (1999) "Weak Consistency"** + Berenson et al. (1995) — the anomaly-based isolation model; pairs with Hermitage tests. **[O]**
7. **Mohan et al., ARIES (1992)** — recovery algorithms; read alongside CMU 15-445 lectures 20–21. **[O]**
8. **Spanner (2012), Calvin (2012), FoundationDB (SIGMOD 2021), Aurora (SIGMOD 2017/2018)** — the four distributed-DB designs every architecture conversation cites; read for *which constraint each chose to violate*. **[O]**
9. **Helland, "Life Beyond Distributed Transactions" (2007)** + "Data on the Outside vs Inside" (2005) — the intellectual foundation of outbox/saga patterns. **[O]**
10. **Release It! 2nd ed.** (Nygard, 2018) — stability patterns/anti-patterns (circuit breaker, bulkhead, fail fast); the operational-failure-mode catalog in book form. **[O]**
11. **Fundamentals of Software Architecture** (Richards & Ford, 2020) + **Building Evolutionary Architectures 2e** (2023) — architecture-as-trade-off-analysis discipline and fitness functions. **[O]**
12. **[The System Design Primer](https://github.com/donnemartin/system-design-primer) + [ByteByteGo]** as interview-shaped indexes only — never as authority. **[C]**
13. **ISO/IEC/IEEE 42010:2022** ([74393](https://www.iso.org/standard/74393.html)) + **ISO/IEC/IEEE 42030:2019** ([73436](https://www.iso.org/standard/73436.html)) + **SEI ATAM** ([CMU/SEI-2000-TR-004](https://resources.sei.cmu.edu/library/asset-view.cfm?assetid=5177)) — the description/evaluation triangle. Extract: 42010's stakeholder–concern–viewpoint–model-kind vocabulary (and its explicit non-scope: no process/notation/tool/medium, so no C4/arc42 conformance claims without mapping); 42030's evaluation organization; ATAM's utility tree → sensitivity/trade-off points → risks mechanics. **[O]**

---

*(continued in sections 22–26: repo case-study method, failure-mode catalog, labs, evaluation tasks, skill structure proposal)*

---

## 22. Repository case-study method and summary

Machine-readable detail (pinned commits, licenses, lifecycle, key paths, learnings, caveats, evidence) lives in [`architecture_backend_repo_cases.json`](./architecture_backend_repo_cases.json). Method:

1. **Pin before reading.** Record repo URL, default branch, HEAD SHA, latest release tag + date, license (as detected by the GitHub API *and* as stated in the repo's LICENSE file — they disagree for multi-license projects like Redis/RocksDB/CockroachDB), and activity signals (last push, archived flag).
2. **Check lifecycle first.** A repo can be a trap: `redpanda-data/redpanda` is **archived** as of 2026-11-12 (org remains active on `connect`/`console`/`seastar`; core development moved — treat the archived repo as historical, not current source of truth) **[O]**; `facebook/rocksdb` 301-redirects to `meta/rocksdb` **[O]**; MongoDB is SSPL (not OSI-approved) since 2018; CockroachDB retired its free Core edition from 24.3 (2024-11, single enterprise self-hosted offering, free under $10M revenue) **[O]** ([cockroachlabs.com license blog](https://www.cockroachlabs.com/blog/enterprise-license-announcement/)).
3. **Read at path level, commit-pinned.** Cite `path@sha`, not "the codebase." Record *what can genuinely be learned* from each path and what cannot (e.g., cost models and heuristics are learnable from Postgres `src/backend/optimizer/`; workload-tuned production configs are not in source).
4. **Distinguish production from educational code.** BusTub (CMU), SimpleDB/GoDB (MIT 6.5830), and MIT 6.5840 lab skeletons are teaching systems — they teach *shape* (component boundaries, test harnesses), not production hardening (buffer-pool eviction under memory pressure, on-disk compatibility, operational tooling). Never cite teaching code as evidence of production practice.

Summary table (23 cases; all cells verified 2026-11-20 except `dotnet/eShop`, verified 2026-11-21; details + SHAs in the JSON):

| Repo | License (2026-11-20) | Latest release | Primary lesson |
|---|---|---|---|
| `postgres/postgres` | PostgreSQL License (permissive) | 18.6 (2026-08-13); 19 GA ~2026-11-19 | Full modular DBMS; nbtree, MVCC+VACUUM, SSI, extensibility APIs |
| `sqlite/sqlite` (mirror of [sqlite.org/src](https://sqlite.org/src)) | Public domain | version-3.54.1 tag | Single-file B-tree + WAL; the industry's strongest testing culture |
| `duckdb/duckdb` | MIT | v2.0.1 (2026-11-20) | Vectorized push-based execution, embeddable OLAP, extension model |
| `meta/rocksdb` | Apache-2.0 **or** GPL-2.0 | v11.13.2 (2026-11-04) | LSM compaction policy surface; write-stall machinery |
| `etcd-io/etcd` | Apache-2.0 (CNCF Graduated) | v3.7.4 (2026-11-19) | Raft+MVCC+watch as a minimal, correct-by-construction KV |
| `etcd-io/raft` | Apache-2.0 | v3.7.0 (2026-06-23) | Reference Raft library: pre-vote, learners, leases |
| `apache/kafka` | Apache-2.0 | 4.4 (2026-10); KRaft-only since 4.0 | Log-centric replication (ISR/HW), exactly-once *within* Kafka, KRaft metadata quorum |
| `nats-io/nats-server` | Apache-2.0 (CNCF) | v2.15.3 (2026-11-11) | Minimal core pub/sub + JetStream persistence/KV layering |
| `redis/redis` | Tri-license RSALv2/SSPLv1/AGPLv3 (8.x) | 8.10.3 (2026-10-26) | Single-threaded event-loop datastore; license-history case study |
| `valkey-io/valkey` | BSD-3-Clause (Linux Foundation) | 9.2.0 (2026-11-19) | Community fork continuity; multi-threaded I/O divergence |
| `tikv/tikv` | Apache-2.0 (CNCF) | v7.5.8 (2026-09-17) | Percolator transactions + Raft per-region over RocksDB (Rust) |
| `vitessio/vitess` | Apache-2.0 (CNCF Graduated) | v24.0.5 (2026-10-13) | Directory-based sharding + online re-sharding (VReplication) for MySQL |
| `cockroachdb/cockroach` | Cockroach Enterprise License (BSL lineage); Core retired 24.3 | v26.2.12 tag (2026-11) | HLC-based serializable SQL over Raft ranges; license-evolution case |
| `ClickHouse/ClickHouse` | Apache-2.0 | v26.9.34.16-stable (2026-11-20) | Columnar vectorized OLAP, MergeTree family, sparse indexes |
| `apple/foundationdb` | Apache-2.0 | 7.4.8 (2026-09-24) | Layered architecture (storage/log/proxy/resolver) + deterministic simulation testing |
| `hashicorp/raft` | MPL-2.0 | v1.8.0 (2026-09-16) | Alternative production Raft API (Consul/Vault lineage); note HashiCorp BSL context for *products*, this library stays MPL |
| `mongodb/mongo` | SSPL-1.0 (source-available, non-OSI) | 8.x line active | WiredTiger document storage, replica-set elections; license-restriction case |
| `apache/cassandra` | Apache-2.0 | 5.x line, trunk active | Dynamo-style leaderless design, φ-accrual, vnodes, accord consensus (5.0) |
| `scylladb/scylladb` | AGPL-3.0 (+ enterprise source-available) | rolling | Shard-per-core Seastar design; CQL-compat rewrite of Cassandra |
| `redpanda-data/redpanda` | **ARCHIVED 2026-11** (was BSL/Apache mix) | archived | Lifecycle-warning case: verify repo status before citing |
| `dotnet/eShop` | MIT | none (no release line; pinned to main `ab10e4c68fd2`) | .NET microservices reference app for the reverse-architecture lab (arc42+C4+ADRs, 42010 checklist, ATAM) |

Educational/recreated systems worth studying at path level: `cmu-db/bustub` (C++20 teaching DBMS; buffer pool, B+tree, executors, concurrency — graded via Gradescope), MIT 6.5840 lab skeletons (Go Raft), `etcd-io/raft` *as* the educational-production bridge, `tikv/raft-rs` (Rust Raft), and TigerBeetle (`tigerbeetle/tigerbeetle`, Apache-2.0, Zig; deterministic simulation + strict serializable double-entry ledger — a modern "built for correctness" case; verify license/version at use time).

## 23. Failure-mode catalog (teach these by name)

**Distributed/consensus:** split brain (dual primaries after partition — prevented by fencing tokens/leader leases, *not* by timeouts alone); stale reads on new leader (read-index/lease enforcement); split-vote livelock (randomized election timeouts exist for a reason); quorum loss from correlated failure (rack/AZ-unaware placement); clock-jump invalidating leases; configuration-change overlap (why joint consensus exists).

**Replication/sharding:** replication-lag read-your-writes violations after failover; async-failover data loss outside RPO; hot shard / celebrity key; shard-rebalance during peak causing latency storms; cross-shard scatter-gather tail amplification; secondary-index inconsistency after partial write; ghost/zombie replicas rejoining with stale state.

**Storage/transactions:** write skew under snapshot isolation (the anomaly that "feels serializable"); phantom under plain row locks (gap/next-key locks or SSI); lock escalation → deadlocks; long transactions blocking VACUUM → table bloat → XID-wraparound emergency shutdown (Postgres-specific and real, [docs](https://www.postgresql.org/docs/current/routine-vacuuming.html#VACUUM-FOR-WRAPAROUND)); LSM compaction stall → write unavailability; WAL amplification filling disks; buffer-pool pollution by scans; checkpoint I/O spikes.

**Caching/queues:** cache avalanche/penetration/hot-key breakdown (§10); stale-cache-as-truth after invalidation failure; dual-write divergence (DB says yes, broker says nothing — outbox exists for this); poison messages looping forever without DLQ; consumer lag growth invisible until retention eviction loses data; rebalance storms duplicating side effects; message redelivery without idempotent consumers.

**Resilience/ops:** retry storms (multiplicative across layers); timeout > upstream timeout (retry budget exhaustion); circuit breakers all open during deploy (no jitter); connection-pool exhaustion under slow dependency (bulkheads); untested failover (works on paper); backup-without-restore-drill; DNS/TTL assumptions during failover; certificate expiry as outage (automate renewal); cascading GC/CPU-throttle death spirals on K8s limits.

**API/schema/data:** breaking change shipped inside "compatible" version; offset pagination duplicates/skips; idempotency-key reuse across endpoints; N+1 queries hiding behind ORM; silent type coercion in schemaless stores; PII leaking into logs/traces; event-schema change breaking downstream consumers (registry + compatibility checks exist for this).

## 24. Implementation labs (progressive, tool-anchored)

Each lab has: goal, stack, deliverable, pass criteria. Labs 1–6 = database internals; 7–10 = distributed systems; 11–14 = backend/platform; 15 = reverse architecture; 16–17 = database operational recovery/tuning.

1. **Buffer pool + page layout (BusTub P1).** Implement clock-sweep/LRU-K buffer manager in C++20 against the CMU Gradescope harness. Pass: all P1 tests incl. concurrent access. Teaches: page pinning, dirty-page writeback, eviction policy reality.
2. **B+tree index (BusTub P2).** Insert/delete/split/merge with latch crabbing. Pass: P2 tests + concurrent scan/insert stress. Teaches: why B+tree concurrency is a thesis topic, not a weekend.
3. **Query execution (BusTub P3).** Volcano executors (seq/index scan, nested-loop + hash join, aggregation) + simple optimizer rules. Pass: P3 tests + explain-plan reasoning writeup.
4. **Concurrency control + recovery (BusTub P4).** 2PL with deadlock detection. Pass: P4 tests incl. abort/rollback paths.
5. **Read real plans.** On Postgres 18: reproduce a cardinality-estimation failure (skewed join), diagnose with `EXPLAIN (ANALYZE, BUFFERS)`, fix with extended statistics or index, quantify. Deliverable: before/after plans + root-cause memo.
6. **LSM vs B-tree bake-off.** Same write-heavy workload against SQLite (WAL mode) and RocksDB (via any client); record write throughput, read latency, space amp before/after compaction. Deliverable: RUM analysis naming which overhead each engine spent.
7. **Raft from scratch (MIT 6.5840 labs 2–3).** Go Raft passing the course's partition/crash/unreliable-network harness, then KV service on top. Pass: full test suite ≥8 consecutive runs. Teaches: the gap between paper and passing tests.
8. **Sharded KV (6.5840 lab 4).** Shard migration over your Raft groups. Teaches: rebalancing is the hard part of sharding.
9. **Jepsen-lite.** Pick a claim (e.g., "etcd linearizable reads"), run `etcd-io/jepsen` or a hand-rolled nemesis (tc-netem partition + kill -9), record violations or absence. Deliverable: reproduction report with counterexample history or 1h clean run.
10. **Deterministic simulation study.** Read FoundationDB `fdbrpc`/`flow` simulation docs and TigerBeetle's simulator blog; deliverable: design doc for adding DST to a toy KV.
11. **Production-shaped service.** Small domain service: OpenAPI-first REST, Postgres with expand/contract migrations (goose/Flyway), transactional outbox → Kafka 4.x (KRaft single-node), idempotent consumer, DLQ + reprocessor, OTel traces/metrics/logs, SLO + burn-rate alert, Testcontainers integration suite. Pass: kill any dependency during load test — service degrades per documented mode, zero data loss, p99 latency budget holds for healthy path.
12. **Cache failure drills.** Valkey cache-aside with TTL jitter + singleflight; demonstrate penetration/breakdown/avalanche mitigations under a load generator. Deliverable: three graphs (with/without mitigation).
13. **Migration rehearsal.** Blue/green + expand/contract migration of a 50M-row table (generated), with rollback path, `lock_timeout` discipline, batched backfill, and verification query diff. Pass: zero-downtime under concurrent read/write load.
14. **Chaos game day.** Kubernetes: kill pods during deployment, throttle a dependency (Toxiproxy/Chaos Mesh), expire a cert (short-lived test CA), fill a disk. Pass: every failure detected by an alert (not a human), every alert has a runbook, postmortem with ≥2 systemic actions.
15. **Reverse architecture on a pinned reference app (dotnet/eShop).** Read-only against `dotnet/eShop` at `ab10e4c68fd26369578ebfb3fd1ccf3b867d0444` (MIT; verified 2026-11-21; key paths `src/Basket.API/Program.cs`, `src/Catalog.API/Program.cs`, `tests/Catalog.FunctionalTests/CatalogApiTests.cs`, `tests/Basket.FunctionalTests/RedisBasketRepositoryTests.cs`). Deliverables: (a) an **arc42 document + C4 system-context/container diagrams + an ADR set** reconstructed from code; (b) the **ISO 42010 description checklist** applied to that output — stakeholders/concerns/viewpoints/model kinds named, C4/arc42 identified as notation *choices* with no 42010 conformance claim unless a mapping is produced; (c) an **ATAM evaluation**: utility tree, ≥6 scenarios across performance/availability/modifiability, sensitivity points, trade-off points, risks/non-risks (in the 42030 evaluation frame); (d) **measurable backend evidence** for one service path: contract test results, plus **three repeated load runs** reporting p50/p95/p99 latency, throughput, error rate, CPU and memory per run with harness/config/arrival-process provenance, plus one failure-injection observation (dependency kill) and one distributed trace. Pass: description checklist complete with no unmapped conformance claim; every measured number real (no fabricated results — missing measurements are recorded as "not measured"); ATAM risks trace to scenarios.
16. **PostgreSQL PITR drill (measured RTO/RPO).** Local Postgres with WAL archiving + `pg_basebackup` (`doc/src/sgml/ref/pg_basebackup.sgml`). Run a workload, note the last committed transaction, destroy the data directory, restore base backup + replay WAL to a recovery target time, then verify: row counts per table and checksums (e.g., per-table `COUNT(*)` and an aggregate hash) against the pre-failure snapshot. Deliverable: restore runbook + verification table + **measured RTO (destroy→verified-restore wall time) and RPO (recovered LSN/time vs failure time)**. Pass: counts/checksums match the recovery target; RTO/RPO reported as measured values, not targets.
17. **PostgreSQL tuning with before/after evidence.** Local Postgres, `pgbench` (`doc/src/sgml/ref/pgbench.sgml`) with a recorded scale/client/script, `pg_stat_statements` enabled (`doc/src/sgml/pgstatstatements.sgml`), `EXPLAIN (ANALYZE, BUFFERS)` for the top statements. Baseline: three repeated pgbench runs. Change one thing (index, statistics, or a single config parameter justified from `doc/src/sgml/monitoring.sgml` evidence). After: three repeated runs. Deliverable: median-of-three comparison + the plan diff + pg_stat_statements deltas; methodology (warmup, scale, clients) recorded. Pass: improvement (or honest regression/no-change) demonstrated with variance visible; no fabricated numbers; conclusion traces to evidence, not folklore.

## 25. Evaluation tasks for the agents (scored, adversarial where marked)

1. Given a growth-stage product brief, produce an ADR set (≥3) choosing between modular monolith and microservices; scoring rewards explicit quality-attribute trade-offs and penalizes resume-driven design.
2. Given a Postgres `EXPLAIN ANALYZE` dump with row-estimate divergence, localize the statistics problem and propose the cheapest correct fix. (Ground-truthed against lab 5.)
3. Given a partition scenario and a Raft implementation sketch, identify which of four safety properties it violates (adversarial: one is a subtle §5.4-style election-restriction bug).
4. Given a "we added a cache and users see stale data" incident, produce the failure-mode diagnosis, a mitigation with explicit consistency window, and the SLO impact statement.
5. Given a schema change request (`users.email` → `user_emails` table, 200M rows), write the expand/contract plan with compatibility windows, backfill strategy, and rollback; scoring penalizes any step that takes `ACCESS EXCLUSIVE` without `lock_timeout` discipline.
6. License/lifecycle audit: given a dependency list including Redis 8, Valkey 9, MongoDB 8, CockroachDB 26, produce a compliant-use matrix (as of the audit date) with citations — scoring checks the Redis tri-license and Cockroach Core-retirement facts specifically.
7. Given a vendor benchmark (labeled [V]), design the independent benchmark that would confirm/refute it, naming coordinated-omission and warmup pitfalls to avoid.
8. Read a pinned path in a case-study repo (e.g., Postgres `nbtree` README, Kafka replication docs) and answer five comprehension questions whose wrong answers are the common blog myths.
9. **Architecture-description review.** Given a reverse-architecture pack (arc42 + C4 + ADRs, as produced by lab 15), score it against the ISO 42010 description checklist; scoring penalizes any 42010/C4/arc42 conformance claim stated without an explicit mapping, missing stakeholder→concern→viewpoint traceability, and ATAM risks that do not trace back to scenarios. (Ground-truthed against lab 15.)

## 26. Proposed skill: `architecture-database-backend-engineering`

Single composite skill (not three) because the three roles share one evidence base; role-specific behavior is selected by invocation context, matching the existing skill convention (frontmatter `name`/`description` + `SKILL.md` + `references/` + optional `scripts/`, per the [skill registry audit 2026-11-20](./skill_registry_audit_2026-11-20T153000Z.json)).

```
architecture-database-backend-engineering/
├── SKILL.md                     # router: role context, workflow, hard boundaries, composition protocol
└── references/
    ├── architecture_tradeoffs.md      # §1–3 distilled: styles, ADR method, domain modeling checklists
    ├── distributed_systems.md         # §4–6: consensus/replication/sharding/consistency decision tables
    ├── storage_and_query_engines.md   # §7–9: B-tree/LSM, WAL/recovery, optimizer reading, indexing
    ├── backend_platform_operations.md # §10–19: caching/queues/resilience/observability/perf/security/
    │                                  #      testing/migrations/cloud-ops/data-architecture
    ├── failure_modes.md               # §23 catalog as review checklist
    ├── repo_cases.md                  # generated digest of architecture_backend_repo_cases.json
    └── labs_and_evaluation.md         # §24–25 with pass criteria
```

SKILL.md workflow (mirrors existing skills): (1) classify the task — architecture decision / database-internals / backend-platform — and load only the relevant reference(s); (2) verify point-in-time facts (versions, licenses, lifecycle) against official sources before citing — the repo-cases digest carries its verification date; (3) every design output is an ADR or a trade-off table with named failure modes; (4) every consistency/performance claim carries an evidence tier [O/V/C]; (5) hard boundaries: no execution of third-party code without authorization, no production-credential handling, no presenting vendor benchmarks as verified, license-sensitive recommendations require the recorded license state. Composition: identical delegation-contract/budget/waiting protocol as the other library skills under `agent-research-director`.

**Links to existing role slugs** (from `role_capability_matrix.json`, 109-role catalog): `software-solutions-architect` (architecture-principal overlap), `staff-principal-engineer` (all three), `backend-engineer` (backend-platform core), `database-engineer-dba` (operational complement to database-systems-engineer), `platform-engineer`, `site-reliability-engineer`, `data-engineer`, `api-integration-engineer`, `performance-engineer`, `cloud-infrastructure-engineer`, `devops-ci-cd-engineer`, `security-architect`.

**Links to existing skills** (16-skill registry): composed under `agent-research-director`; style/contract conventions shared with `computational-geometry-engineering` and `defensive-reverse-engineering` (source-grounded reading, evidence tiers); complements `local-model-runtime-engineering` (runtime/perf discipline) and `engineering-organization-architect` (org-side trade-offs); no overlap conflict detected — no existing skill covers database internals, consensus, or backend platform operations.

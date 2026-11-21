# Backend and Platform Operations

Distilled from the research library §10–19 (baseline 2026-11-20). Evidence tiers: **[O]** official/observed, **[V]** vendor-reported, **[C]** community/course.

**Contents:** caching · queues and streaming · resilience · observability · performance · security · testing and verification · migrations and evolution · cloud/platform operations · data architecture · database operational recovery and tuning

## 1. Caching

- **Patterns:** cache-aside (lazy; most common; stale window + race on miss-storm), read-through/write-through, write-behind (fast, data-loss window), refresh-ahead. [AWS caching patterns whitepaper](https://docs.aws.amazon.com/whitepapers/latest/database-caching-strategies-using-redis/caching-patterns.html). **[O]**
- **The three classic failure modes:** **penetration** (queries for nonexistent keys bypass cache → Bloom-filter or cache-null), **breakdown/hot-key** (single hot key expires → mutex/singleflight or logical TTL), **avalanche** (mass simultaneous expiry → TTL jitter). Add stampede protection (request coalescing; Go's `singleflight`, Caffeine's loading cache).
- **Coherence:** TTL is the only honest default; explicit invalidation needs versioning (`key:v3`) or pub/sub invalidation (Redis 6 client-side caching / keyspace notifications; Valkey inherits).
- **Multi-tier:** client/edge (CDN, HTTP cache headers: `Cache-Control`, `ETag`, `stale-while-revalidate`) → application local (Caffeine/ristretto) → shared (Valkey/Redis/memcached). Each tier adds an invalidation surface.
- **Engines, verified 2026-11-20:** Valkey 9.2.0 (2026-11-19, BSD-3-Clause, Linux Foundation) **[O]**; Redis 8.10.3 (2026-10-26) — license history: BSD ≤7.2 → dual RSALv2/SSPLv1 at 7.4 (2024-03-20) → tri-license RSALv2/SSPLv1/AGPLv3 from 8.0 (2025-05-01), per [redis.io/legal/licenses](https://redis.io/legal/licenses/) **[O]**; memcached (BSD, steady). Dragonfly is source-available BSL — flag for license review. **[O]**

## 2. Queues and streaming

- **The log abstraction** (Jay Kreps, ["The Log"](https://engineering.linkedin.com/distributed-systems/log-what-every-software-engineer-should-know-about-real-time-datas-unifying)) unifies replication logs, commit logs, and event streams. Kafka's design docs on [replication](https://kafka.apache.org/documentation/#replication) (ISR, high watermark, `unclean.leader.election`, `min.insync.replicas`) remain the best free replication-semantics documentation. **[O]**
- **Kafka lifecycle (verified 2026-11-20):** current release 4.4 (Oct 2026); KRaft-only since 4.0 (2025-03-18, ZooKeeper removed — [KIP-500](https://cwiki.apache.org/confluence/display/KAFKA/KIP-500)); 3.9 was the bridge release and is archived; Apache supports roughly the latest three minors (4.2–4.4) ([kafka.apache.org/downloads](https://kafka.apache.org/downloads)). License Apache-2.0; Confluent add-ons are Confluent Community License (source-available) — do not conflate. Share groups (KIP-932, queue semantics) production-ready in 4.2; DLQs for share groups in 4.4 (KIP-1191). **[O]**
- **Producer/consumer correctness knobs:** `acks=all` + `min.insync.replicas=2` + idempotent producer (default since 3.0) for no-loss/no-dup within Kafka; consumer rebalances (KIP-848 cooperative protocol GA in 4.0) still cause duplicate processing — design consumers idempotent anyway. **[O]**
- **NATS** (`nats-io/nats-server` v2.15.3, 2026-11-11, Apache-2.0, CNCF) **[O]**: core NATS = at-most-once fire-and-forget; **JetStream** adds persistence, at-least-once, KV and object store on streams — a good minimal case study in "queue semantics layered on subjects."
- **RabbitMQ** (classic work queue: per-message ack/nack, TTL+DLX, quorum queues use Raft) vs Kafka (replayable log): the decision axis is *replay + ordering + throughput* vs *routing + per-message control*. **[O]**
- **Transactional outbox/inbox:** never dual-write DB + broker (partial failure between the two is not rare); write the event in the same DB transaction, publish via CDC (Debezium) or poller; consumers dedup via inbox table. [microservices.io outbox pattern](https://microservices.io/patterns/data/transactional-outbox.html). **[O]**
- **Backpressure:** credit-based (gRPC flow control, Reactive Streams), bounded queues + load shedding; unbounded queues are latency bombs (Little's law, §5 below).

## 3. Resilience engineering

- **Retry discipline:** bounded retries, exponential backoff + full jitter ([AWS Architecture Blog: jitter](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/)), only retry idempotent operations or with idempotency keys, honor `Retry-After`, and set **deadlines end-to-end** (gRPC deadline propagation) so retries can't multiply. Retry storms = multiplicative load amplification across layers. **[O]**
- **Circuit breaker** (closed/open/half-open; Resilience4j/Polly), **bulkheads** (separate thread/connection pools per dependency), **load shedding** (drop cheap-to-reject work early; Netflix concurrency-limits, adaptive concurrency in gRPC), **rate limiting** (token bucket; fail-open vs fail-closed is a business decision).
- **Timeouts everywhere:** every network call, every lock acquisition, every queue wait. Absent a deadline, thread pools drain and queues grow (Hystrix-era lesson, [Netflix tech blog](https://netflixtechblog.com/fault-tolerance-in-a-high-volume-distributed-system-91ab4faae74a)). **[O]**
- **Graceful degradation:** critical-path inventory; each dependency gets a documented degraded mode (serve stale cache, default response, queue for later). Test degraded modes in staging — untested fallbacks are bugs waiting.
- **Chaos/fault injection:** start with dependency failure drills (kill -STOP a dependency, inject 500 ms latency, corrupt DNS) before "chaos monkey" glamour; AWS FIS / Chaos Mesh / Toxiproxy; Jepsen-style nemesis testing for data systems. **Owned, isolated environments only** (see SKILL.md hard gates). **[O]**
- **DR:** define RTO/RPO per service tier; backups are worthless without **tested restores** (restore drills as scheduled exercises); multi-AZ is an availability feature, multi-region is a DR/consistency product decision.

## 4. Observability

- **Three signals with distinct jobs:** metrics (aggregates, alerting), logs (events, debugging), traces (causality across services). [OpenTelemetry](https://opentelemetry.io/docs/) (CNCF) is the vendor-neutral instrumentation standard — OTel SDKs + semantic conventions, export OTLP. **[O]**
- **SLO practice:** SLI (good/total events, measured at the client where possible), SLO target, error budget (1−SLO) as the release-velocity control valve; burn-rate alerting (multiwindow, multi-burn-rate — [Google SRE Workbook ch. 5](https://sre.google/workbook/alerting-on-slos/)). **[O]**
- **RED** (rate, errors, duration) for services, **USE** (utilization, saturation, errors) for resources ([Brendan Gregg](https://www.brendangregg.com/usemethod.html)). **[O]**
- **Cardinality discipline:** high-cardinality label values (user IDs in metric labels) are the classic metrics-system outage cause; exemplars link metrics→traces.
- **Tail latency:** percentiles must be computed on histograms (HDR/t-digest/DDSketch), never averaged across instances; p99.9 exists and is somebody's every-request experience at scale.
- **Continuous profiling** (pprof, Pyroscope/Grafana, eBPF-based) closes the loop between observability and performance work.

## 5. Performance engineering

- **Laws:** Little's law (L=λW — queue depth = throughput × latency; unbounded queues convert latency problems into memory death), Amdahl (serial fraction caps parallel speedup), Universal Scalability Law (Gunther — adds contention σ and coherency κ; explains why systems *retrograde* under load).
- **Method before tools:** define workload (arrival process!), then measure; USE for bottleneck localization; differentiate load-testing (pre-generated traffic) vs production reality — open-loop vs closed-loop load generators; **coordinated omission is the #1 benchmarking lie** (Gil Tene, ["How NOT to Measure Latency"](https://www.infoq.com/presentations/latency-response-time/)). **[O]**
- **Percentile discipline:** p50 is marketing; report p99/p99.9 with max and the measurement interval.
- **Common backend hot spots:** N+1 queries, missing covering index, connection-pool exhaustion (pool sizing ≈ ((core_count × 2) + effective_spindle_count) per [Postgres wiki / HikariCP](https://github.com/brettwooldridge/HikariCP/wiki/About-Pool-Sizing)), lock contention on hot rows (counters — batch or shard them), GC pauses, TLS handshake costs without session resumption, serialization costs (JSON vs Protobuf), per-request allocations. **[O]**

## 6. Security engineering

- **Threat modeling:** STRIDE per data-flow-diagram element; [OWASP Threat Modeling](https://owasp.org/www-community/Threat_Modeling) + [ASVS](https://owasp.org/www-project-application-security-verification-standard/) as verification checklist. **[O]**
- **OWASP Top 10 (2021)** + **API Security Top 10 (2023)** — broken object-level authorization (BOLA/IDOR) is #1 and is *not* solved by frameworks: enforce object ownership checks in the data-access layer, not controllers. **[O]**
- **AuthN/Z:** OIDC on OAuth 2.1 (PKCE everywhere, implicit deprecated — [OAuth 2.1 draft](https://oauth.net/2.1/)); short-lived tokens; authorization modeled explicitly (RBAC/ReBAC; Zanzibar-style relationship tuples — [Google Zanzibar paper](https://research.google/pubs/zanzibar-googles-consistent-global-authorization-system/) — when permissions are graph-shaped). **[O]**
- **Data protection:** TLS 1.3 in transit (mTLS service-to-service, SPIFFE/SPIRE for workload identity), envelope encryption at rest (KMS-managed KEKs), field-level encryption/tokenization for PII crowns; key-rotation drills.
- **Secrets:** never long-lived in env/files; short-lived credentials (Vault dynamic secrets, IAM instance roles); scan history (gitleaks/trufflehog) — leaked-and-rotated beats leaked-and-deleted.
- **Supply chain:** pin dependencies by digest, SBOM (CycloneDX/SPDX), SLSA provenance, Sigstore signing; the 2024–2026 wave of CI/registry attacks makes this non-optional ([SLSA](https://slsa.dev/)). **[O]**
- **Database-specific:** parameterize everything (no exceptions for "internal" tools), least-privilege roles per service (no shared superuser), row-level security for multi-tenant shared schemas, audit logging of DDL and privilege grants, pgcrypto/vault for sensitive columns, and treat backups as attack surface (encrypted, access-logged).
- **Telemetry PII:** logs, traces, and metrics are reviewed for personal-data leakage; high-cardinality PII labels are a defect.

## 7. Testing and verification

- **Pyramid with backend specifics:** unit (fast, hermetic) → contract (Pact for HTTP; schema-registry compatibility checks for events) → integration ([Testcontainers](https://testcontainers.com/) against *real* Postgres/Kafka, not mocks — mocks encode your assumptions, containers test reality) → end-to-end (few, critical paths). **[O]**
- **Property-based testing** (Hypothesis, fast-check, jqwik): generate operation sequences, assert invariants (e.g., "balance conserved across transfers"). Ideal for caches, serializers, storage adapters.
- **Fault injection and model-based testing for data systems:** Jepsen (Clojure, nemesis partitions + linearizability checker Elle); **deterministic simulation testing** — FoundationDB's simulator ([testing docs](https://apple.github.io/foundationdb/testing.html)) and [TigerBeetle's simulator](https://tigerbeetle.com/blog/2023-03-28-simulation) run the whole cluster in a deterministic event loop with injected faults — the current gold standard for distributed correctness confidence. **[O]**
- **Migration testing:** rehearse on production-shaped snapshots; test the *rollback* path; verify expand/contract compatibility windows (old code + new schema and vice versa).
- **Performance regression:** microbenchmarks in CI are noisy; use dedicated runners or track coarse integration benchmarks with high-variance alarms.
- **SQLite as the exemplar:** [sqlite.org/testing.html](https://sqlite.org/testing.html) — 100% branch test coverage (TH3), fuzzing (SQLfuzz/dbsqlfuzz), anomaly testing (power-loss, OOM, I/O error injection). This is the bar for "storage engine you trust." **[O]**

## 8. Schema/data migrations and system evolution

- **Expand/migrate/contract** (a.k.a. parallel change): (1) add new column/table (old code ignores it), (2) dual-run/readers-writers shifted via backfill, (3) remove old after the compatibility window closes. Never a single atomic rename on a live system. **[O]**
- **Compatibility windows:** during rolling deploys, version N and N+1 code coexist against the same schema — every migration must be safe for *both*. `NOT NULL` without default, `DROP`, `RENAME`, and type narrowing are contract-breaking. Postgres specifics: `ADD COLUMN ... DEFAULT` is fast since PG11 (metadata-only), but `ACCESS EXCLUSIVE` lock waits can still stall behind long transactions — set `lock_timeout` in migration runners ([Postgres DDL docs](https://www.postgresql.org/docs/current/ddl-alter.html)). **[O]**
- **Data migrations:** batched backfills with throttling and resume markers (checkpoint by primary-key range); never `UPDATE` the whole table in one transaction (table bloat + lock + replication lag storm).
- **Tooling:** Flyway, Liquibase, goose, Atlas, Drizzle/Prisma migrate; CI gate that applies migrations to a prod-shape snapshot; GitOps-managed.
- **Feature flags** decouple deploy from release; flags need owners, expiry dates, and kill-switch semantics — stale flags are latent bugs (the Knight Capital failure was a repurposed flag, [SEC filing](https://www.sec.gov/files/litigation/admin/2013/34-70694.pdf)). **[O]**
- **Zero-downtime deploys:** rolling (K8s default; needs backward compat), blue/green (fast rollback, double cost), canary (traffic-shaped risk); the database compatibility window is the constraint that makes all of them possible.

## 9. Cloud and platform operations

- **Kubernetes** as the default substrate: controllers/reconciliation, requests/limits (CPU throttling of latency-sensitive services is the classic mis-tune), pod disruption budgets (what actually protects availability during node drains), and K8s does **not** solve stateful workloads — operators (CloudNativePG, Strimzi) encode the operational knowledge. [kubernetes.io docs](https://kubernetes.io/docs/home/). **[O]**
- **IaC:** Terraform/OpenTofu (OpenTofu is the Linux-Foundation fork after HashiCorp's 2023-08 BSL relicensing; IBM closed the HashiCorp acquisition 2025-02-27 **[O]**) or Pulumi/Crossplane; drift detection and plan review in CI are the control points.
- **Service mesh** (Istio ambient / Linkerd): buys mTLS, traffic policy, telemetry at the cost of an extra failure domain and operational skill — justified at scale, overhead for small platforms.
- **Cost/capacity:** capacity planning via queueing-aware headroom (utilization targets depend on arrival variance — 70% average CPU with spiky arrivals *is* an outage schedule); unit economics (cost per request/order) beat raw bill watching; [FinOps framing](https://www.finops.org/).
- **Operational maturity markers:** on-call runbooks per alert, game days, incident reviews that produce systemic actions (blameless postmortems — [Etsy debriefing facilitation guide](https://extfiles.etsy.com/DebriefingFacilitationGuide.pdf) **[O]**, SRE book ch. 15 [Postmortem Culture](https://sre.google/sre-book/postmortem-culture/)).

## 10. Data architecture

- **OLTP vs OLAP is physical, not philosophical:** row stores serve point lookups + small-range writes; columnar stores (ClickHouse — Apache-2.0, v26.9 stable 2026-11-20 **[O]**; DuckDB) serve scans + aggregations via compression, vectorization, and zone maps. HTAP (TiDB TiFlash, SingleStore) replicates into both layouts.
- **CDC** (Debezium on Postgres logical decoding / MySQL binlog) is the backbone of cache invalidation, search indexing, outbox publishing, and warehouse sync; understand snapshot→stream handoff and schema-evolution handling. [debezium.io](https://debezium.io/documentation/). **[O]**
- **Lakehouse:** object storage + open table formats ([Apache Iceberg](https://iceberg.apache.org/spec/), Delta Lake, Hudi) give ACID, schema evolution, time travel on Parquet; Iceberg's hidden partitioning and snapshot model are the 2026 default for new builds **[V/O]**.
- **Warehouse/lakehouse query layers:** Trino/Presto, Spark, DuckDB-in-process; the practical 2026 pattern is "DuckDB for the long tail of analytics, ClickHouse/warehouse for served dashboards." **[V]**
- **Data governance:** ownership per domain (data mesh: domain-oriented ownership, data-as-product, self-serve platform, federated computational governance — Zhamak Dehghani), lineage (OpenLineage/Marquez), quality contracts (Great Expectations/Soda), retention/deletion as compliance features (GDPR erasure vs immutable event logs is a real design conflict — crypto-shredding is the standard answer).
- **Data mesh reality check:** the organizational prerequisite is domain teams capable of owning data products; without it, "mesh" becomes "many data swamps." **[C]**

## 11. Database operational recovery and tuning (PostgreSQL)

Operational truth lives in the PostgreSQL documentation itself — read the doc sources at the pinned commit (`postgres/postgres`) **[O]**:

- `doc/src/sgml/mvcc.sgml` — MVCC chapter: isolation semantics, visibility rules, SSI; the normative reference before claiming any isolation behavior.
- `doc/src/sgml/monitoring.sgml` — statistics collector, `pg_stat_*` views, progress reporting: the observability surface for tuning.
- `doc/src/sgml/pgstatstatements.sgml` — `pg_stat_statements`: normalized per-query statistics (calls, total/mean time, rows, buffers) — the evidence source that replaces guessing about "slow queries."
- `doc/src/sgml/ref/pgbench.sgml` — `pgbench`: built-in repeatable load generator for before/after comparisons.
- `doc/src/sgml/ref/pg_basebackup.sgml` — `pg_basebackup`: physical base backup; with WAL archiving/replay to a recovery target it is the PITR foundation.

Practice rules (labs 16–17 in [labs_and_evaluation.md](labs_and_evaluation.md)):

- **PITR is not done until the restore is verified:** row counts and checksums against the pre-failure database, with **measured RTO and RPO** (wall time to verified restore; recovered-LSN gap), not targets quoted as achievements. Backups without restore drills are a named failure mode (see [failure_modes.md](failure_modes.md)).
- **Tuning claims need three repeated `pgbench` runs before and after** the change (median, variance visible), with `EXPLAIN (ANALYZE, BUFFERS)` plan diffs and `pg_stat_statements` deltas attached. No fabricated numbers; unmeasured claims stay labeled estimates. Change one variable at a time, justified from monitoring evidence.
- **Vitess remains conditional/advanced** for MySQL sharding/HA: adopt only when single-writer limits, shard count, and operational maturity justify the middleware fleet — after native recovery and tuning discipline is in place (see [repo_cases.md](repo_cases.md)).

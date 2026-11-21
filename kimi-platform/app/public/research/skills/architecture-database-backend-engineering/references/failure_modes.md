# Failure-Mode Catalog (Review Checklist)

From the research library §23 (baseline 2026-11-20). Teach these by name. Use as a design-review and incident-review checklist: a design that cannot say how it handles each applicable row is incomplete.

**Contents:** distributed/consensus · replication/sharding · storage/transactions · caching/queues · resilience/ops · API/schema/data

## How to use

1. Per dependency and per data path, enumerate: how does it fail (slow, down, wrong, poisoned)? Which catalog rows apply?
2. For each applicable row, record detection (which alert/metric), mitigation, and the drill that proves it. Untested mitigations are risks, not mitigations.
3. Every ADR and design doc names the failure modes it *accepts*.

## Distributed / consensus

- **Split brain** — dual primaries after partition; prevented by fencing tokens/leader leases, *not* by timeouts alone.
- **Stale reads on new leader** — enforce read-index/leader lease for linearizable reads.
- **Split-vote livelock** — randomized election timeouts exist for a reason.
- **Quorum loss from correlated failure** — rack/AZ-unaware placement.
- **Clock jump invalidating leases** — lease validity depends on clock bounds; monitor clock offset.
- **Configuration-change overlap** — why joint consensus exists; never allow two concurrent membership changes.

## Replication / sharding

- **Replication-lag read-your-writes violations** after failover.
- **Async-failover data loss outside RPO** — quantify the lag window before choosing async.
- **Hot shard / celebrity key.**
- **Shard rebalance during peak** causing latency storms.
- **Cross-shard scatter-gather tail amplification.**
- **Secondary-index inconsistency** after partial write.
- **Ghost/zombie replicas** rejoining with stale state.

## Storage / transactions

- **Write skew under snapshot isolation** — the anomaly that "feels serializable."
- **Phantoms under plain row locks** — gap/next-key locks or SSI.
- **Lock escalation → deadlocks.**
- **Long transactions blocking VACUUM → table bloat → XID-wraparound emergency shutdown** (Postgres-specific and real — [docs](https://www.postgresql.org/docs/current/routine-vacuuming.html#VACUUM-FOR-WRAPAROUND)).
- **LSM compaction stall → write unavailability** (RocksDB write-stall machinery: memtable count, L0 files, pending compaction bytes).
- **WAL amplification filling disks.**
- **Buffer-pool pollution by scans.**
- **Checkpoint I/O spikes.**

## Caching / queues

- **Cache avalanche / penetration / hot-key breakdown** (TTL jitter, cache-null/Bloom filter, singleflight).
- **Stale-cache-as-truth** after invalidation failure.
- **Dual-write divergence** — DB says yes, broker says nothing; the transactional outbox exists for this.
- **Poison messages** looping forever without a DLQ.
- **Consumer lag growth invisible** until retention eviction loses data.
- **Rebalance storms** duplicating side effects.
- **Message redelivery without idempotent consumers.**

## Resilience / ops

- **Retry storms** — multiplicative across layers.
- **Timeout > upstream timeout** — retry-budget exhaustion.
- **Circuit breakers all open during deploy** (no jitter).
- **Connection-pool exhaustion under slow dependency** — bulkheads.
- **Untested failover** — works on paper only.
- **Backup without restore drill.**
- **DNS/TTL assumptions during failover.**
- **Certificate expiry as outage** — automate renewal.
- **Cascading GC / CPU-throttle death spirals** on Kubernetes limits.

## API / schema / data

- **Breaking change shipped inside a "compatible" version.**
- **Offset pagination duplicates/skips** — use keyset.
- **Idempotency-key reuse across endpoints.**
- **N+1 queries hiding behind the ORM.**
- **Silent type coercion in schemaless stores.**
- **PII leaking into logs/traces.**
- **Event-schema change breaking downstream consumers** — registry + compatibility checks exist for this.

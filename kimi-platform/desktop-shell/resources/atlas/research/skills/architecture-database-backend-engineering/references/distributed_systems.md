# Distributed Systems: Foundations, Consensus, Replication, Transactions

Distilled from the research library §4–6 (baseline 2026-11-20). Evidence tiers: **[O]** official/observed, **[V]** vendor-reported, **[C]** community/course.

**Contents:** partial failure and time · impossibility results · delivery semantics · consensus · replication · sharding · transactions and isolation · consistency spectrum · verification culture

## 1. Foundations

- **Partial failure is the defining property** — a distributed system is one where the failure of a computer you didn't know existed can render your own computer unusable (Lamport). Design for messages lost, delayed, duplicated, reordered; processes paused arbitrarily long (GC, VM stall, container throttle); clocks that drift and jump.
- **Time and clocks:** physical clocks (NTP error bounds are real; leap smear), logical clocks (Lamport, vector clocks for causality), hybrid logical clocks (HLC — used by CockroachDB/YugabyteDB for commit timestamps), TrueTime (Spanner's tight uncertainty interval enabling external consistency). [Spanner paper (OSDI 2012 / TOCS 2013)](https://research.google/pubs/spanner-googles-globally-distributed-database/). **[O]**
- **Impossibility results that shape design:** FLP (no deterministic consensus in async systems with one faulty process — so consensus uses randomization/partial synchrony), CAP (under partition, choose availability or consistency), **PACELC** (Abadi: if Partition then A/C **Else** Latency/Consistency — the normal-case latency/consistency trade is the more useful everyday lens). [PACELC paper](https://www.cs.umd.edu/~abadi/papers/abadi-pacelc.pdf). **[O]**
- **Delivery semantics:** at-most-once (drop), at-least-once (retry ⇒ duplicates ⇒ dedup/idempotency downstream), *effectively-once* = at-least-once delivery + idempotent processing + transactional state commit. "Exactly-once delivery" over a network does not exist (Two Generals). Kafka "exactly-once semantics" is exactly-once *state updates within Kafka*, not end-to-end — [KIP-98](https://cwiki.apache.org/confluence/display/KAFKA/KIP-98+-+Exactly+Once+Delivery+and+Transactional+Messaging). **[O]**
- **Failure detection:** φ-accrual detectors (Cassandra) output a suspicion probability, not binary up/down — avoids the false-positive cascade of naive timeouts.

## 2. Consensus

- **Raft** (Ongaro & Ousterhout, [USENIX ATC 2014](https://raft.github.io/raft.pdf)): leader election with randomized timeouts, log replication with commit-on-majority, safety via the election restriction (§5.4), joint-consensus membership changes. Understandable ≠ trivial: the dissertation adds leader leases, pre-vote, and client interaction ([Ongaro PhD thesis](https://github.com/ongardie/dissertation)). Production references: `etcd-io/raft` (library, Apache-2.0, v3.7.0 2026-06-23 **[O]**) and HashiCorp `raft` (MPL-2.0, v1.8.0 **[O]**).
- **Multi-Paxos** remains dominant in industrial systems (Spanner, historically Chubby); Zab (ZooKeeper) is primary-backup atomic broadcast — historically relevant now that Kafka removed its ZooKeeper dependency (Kafka 4.0, 2025-03-18, [release notes](https://kafka.apache.org/blog)). **[O]**
- **etcd** is the canonical small-footprint case: Raft + MVCC + watch, used as Kubernetes' metadata store. Verified 2026-11-20: `etcd-io/etcd` v3.7.4 (2026-11-19), Apache-2.0, CNCF Graduated ([cncf.io](https://www.cncf.io/projects/etcd/)). **[O]**

## 3. Replication

- **Single-leader:** sync (durable but stall-prone), semi-sync (MySQL), async (fast; data-loss window = replication lag on failover). Always define the failover data-loss budget (RPO) before choosing.
- **Multi-leader:** conflict resolution is the price (LWW loses data; CRDTs and merge logic preserve it). Use cases: multi-region writes, offline-first — [Ink & Switch's local-first essay](https://www.inkandswitch.com/local-first/), Kleppmann's [Automerge](https://github.com/automerge/automerge). **[O]**
- **Leaderless (Dynamo-style):** quorum R+W>N gives *probabilistic* freshness, not a guarantee; sloppy quorums trade consistency for availability during partitions; read repair + anti-entropy (Merkle trees) converge replicas. Cassandra (Apache-2.0, trunk active 2026-11-20) and ScyllaDB remain the readable references; Amazon's [Dynamo paper (SOSP 2007)](https://www.allthingsdistributed.com/files/amazon-dynamo-sosp2007.pdf) is still the best motivation. **[O]**
- **Replication lag is a user-visible consistency model:** read-your-writes, monotonic reads, consistent prefix must be engineered (read-from-leader, timestamp tokens, session stickiness).

## 4. Sharding

- **Key → partition mapping:** hash (uniform, no range scans), range (scans, hot-spot risk on monotonic keys — the classic UUIDv4 vs UUIDv7 trade; time-ordered UUIDv7 entered PostgreSQL 18, [docs](https://www.postgresql.org/docs/18/datatype-uuid.html) **[O]**), consistent hashing / rendezvous (HRW) for cache-like rebalance minimization, directory/lookup table (Vitess).
- **Rebalancing is the hard part:** virtual buckets (Cassandra vnodes, 256/token-range), dynamic splitting (Bigtable/HBase/CockroachDB range splits at size/load thresholds), re-sharding tooling (Vitess VReplication). Vitess v24.0.5 (2026-10-13), Apache-2.0, CNCF Graduated ([repo](https://github.com/vitessio/vitess)). **[O]**
- **Cross-shard transactions** collapse to 2PC (or Percolator-style commit points in TiKV); cross-shard *queries* become scatter-gather with tail-latency amplification — the shard key is the most consequential schema decision in a distributed database.
- **Rebalancing failure modes:** hot shard (celebrity key), thundering move during traffic peak, orphaned splits after partial failure — see [failure_modes.md](failure_modes.md).

## 5. Transactions and isolation

- **Isolation levels are defined by the anomalies they forbid, not by textbook prose.** Adya's formalization (1999) and the Berenson et al. critique of the SQL standard are the correct mental model; [Martin Kleppmann's Hermitage](https://github.com/ept/hermitage) maps each level to concrete anomalies per database — essential reading before claiming "we run serializable." **[O]**
- Reality check (verified in vendor docs 2026-11-20): PostgreSQL `SERIALIZABLE` = SSI (predicate-lock based, [docs](https://www.postgresql.org/docs/current/transaction-iso.html)); MySQL/InnoDB `REPEATABLE READ` blocks phantoms via next-key locks; CockroachDB defaults to serializable with uncertainty windows; Oracle "serializable" is snapshot isolation (write skew possible). **[O]**
- **MVCC mechanics:** PostgreSQL keeps old row versions in-heap (VACUUM reclaims; bloat and XID wraparound are operational realities), InnoDB keeps undo-log versions, CockroachDB/TiKV keep MVCC in the storage engine with GC at a TTL.
- **Concurrency-control families:** 2PL (deadlocks need detection/wait-die/wound-wait), MVCC+SSI, OCC (validation at commit — good under low contention, abort storms under high), timestamp ordering (Calvin-style deterministic execution eliminates distributed deadlocks at the cost of pre-declared read/write sets).
- **Distributed transactions:** 2PC blocks on coordinator failure (the classic reason it's avoided in user-facing paths); **sagas** (process manager + compensating actions, [Garcia-Molina & Salem 1987](https://www.cs.cornell.edu/andru/cs711/2002fa/reading/sagas.pdf)) trade atomicity for semantic compensation — compensate ≠ roll back (money already moved). TCC (try-confirm-cancel) is the reservation-shaped variant. **[O]**

## 6. Consistency spectrum and verification culture

- **Spectrum:** linearizability (single-object, real-time order — expensive, needs consensus) → sequential → causal → PRAM → eventual; session guarantees layer on top. Linearizable reads on Raft require a leader lease or read-index round trip — the default "read from leader" optimization is *not* linearizable without these; etcd's `Serializable` vs `Linearizable` read flag makes this explicit ([etcd API docs](https://etcd.io/docs/v3.6/learning/api_guarantees/)). **[O]**
- **Independent verification:** [Jepsen analyses](https://jepsen.io/analyses) (Aphyr) — two decades of vendor consistency claims tested against adversarial network partitions; required reading before believing any "linearizable" marketing. **[O]**
- Quote "linearizable," "serializable," "exactly-once," and "ACID" only with their precise scope (object, operation, boundary) and evidence tier; vendor claims stay **[V]**.

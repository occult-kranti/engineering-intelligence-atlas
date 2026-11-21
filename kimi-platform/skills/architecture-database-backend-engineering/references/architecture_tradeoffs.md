# Architecture Trade-offs, Domain Modeling, and API Contracts

Distilled from the research library §1–3 (baseline 2026-11-20). Evidence tiers: **[O]** official/observed, **[V]** vendor-reported, **[C]** community/course.

Architecture is the set of decisions that are expensive to reverse. The discipline: identify the quality attributes that matter (latency, throughput, availability, consistency, evolvability, operability, security, cost), then choose the *least* structure that satisfies them.

**Contents:** styles · trade-off framings · decision governance (ADR/fitness functions) · description/evaluation standards (ISO 42010/42030, ATAM) · domain modeling · APIs and contracts

## 1. Architecture styles

| Style | Strengths | Costs / failure modes | When it wins |
|---|---|---|---|
| **Layered / n-tier** | Familiar, clear separation of concerns | "Architecture sinkhole" anti-pattern (pass-through layers); change ripples vertically | Small CRUD systems, mixed-seniority teams |
| **Modular monolith** | Single deployable, strong module boundaries, cheap cross-module transactions | Decays into a big ball of mud without enforced boundaries (package-private APIs, dependency rules) | Default starting point; most systems < ~50 engineers |
| **Microservices** | Independent deployability/scaling, team autonomy, fault isolation | Distributed-systems tax on every interaction: partial failure, eventual consistency, tracing, schema contracts, operational sprawl | Large orgs with stable domain boundaries and platform maturity |
| **Hexagonal / ports & adapters** | Domain logic isolated from frameworks/DB; testability | Boilerplate; over-abstraction in simple apps | Long-lived domain cores, multiple delivery mechanisms |
| **Event-driven (pub/sub, EDA)** | Temporal decoupling, natural audit trail, scalability | Hard debugging and ordering; event schema evolution is load-bearing; "event-carried state transfer" vs "event notification" confusion | Many consumers, streaming/analytics coupling |
| **CQRS / event sourcing** | Read/write models optimized independently; full history | Eventual consistency between models; event schema versioning forever; replay cost | High-audit domains (finance, ledgers); rarely whole-system |
| **Pipes & filters / batch** | Composable, restartable stages | Latency; intermediate state management | ETL, media pipelines |
| **Serverless / FaaS** | Zero idle cost, managed scaling | Cold starts, vendor lock-in, local-dev gap, state moved outward | Spiky/event workloads, glue logic |

## 2. Trade-off framings to institutionalize

- **Fallacies of distributed computing** (Deutsch/Gosling): the network is not reliable, latency is not zero, bandwidth is not infinite, the network is not secure, topology changes, there is more than one administrator, transport cost is not zero, the network is not homogeneous. Re-check every service-boundary decision against this list.
- **Coupling has dimensions:** static (imports), runtime (synchronous calls), deployment (shared release), data (shared schema), semantic (shared business rule). Microservices trade static coupling for runtime + operational coupling — often a bad trade for small teams.
- **Monolith-first bias:** service boundaries must be earned by a named force (independent scaling, team autonomy, fault isolation) that the monolith demonstrably cannot satisfy. "Distributed monolith" is the worst of both.
- **Architecture Decision Records (ADRs):** one-page, numbered, immutable-after-accept records (context → decision → consequences). [Michael Nygard's original post](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions), [ADR GitHub org](https://adr.github.io/). **[O]**
- **Fitness functions** (Ford/Parsons/Kua, *Building Evolutionary Architectures*, 2nd ed. 2023): automate architecture governance (dependency rules via ArchUnit/import-linter, latency budgets in CI) instead of relying on review vigilance. **[O]**

Authoritative anchors: [arc42 template](https://arc42.org/), [C4 model](https://c4model.com/) (system-context / container / component / code zoom levels), [AWS Well-Architected Framework](https://docs.aws.amazon.com/wellarchitected/latest/framework/welcome.html) (six pillars incl. sustainability), [Google SRE book — software engineering in SRE](https://sre.google/sre-book/software-engineering-in-sre/). **[O]**

## 3. Architecture description and evaluation standards

- **ISO/IEC/IEEE 42010:2022** ([iso.org/standard/74393.html](https://www.iso.org/standard/74393.html)) governs **architecture descriptions** — requirements for the structure/expression of an AD and for architecture description frameworks (ADF), architecture description languages (ADL), viewpoints, and model kinds. Per its own scope it does **not** specify an architecting process, method, model, notation, technique, or tool, and **not** any recording format or medium. Consequence: C4 and arc42 are legitimate *choices* for producing a description, but **never claim 42010 conformance for C4/arc42 output without an explicit mapping** of constructs to 42010 concepts. **[O]** (scope verified 2026-11-21)
- **ISO/IEC/IEEE 42030:2019** ([iso.org/standard/73436.html](https://www.iso.org/standard/73436.html)) specifies how to **organize and record architecture evaluations**: stakeholder concerns, evaluation framework, risks/opportunities, decision support. It evaluates the *architecture*, not the description. **[O]** (scope verified 2026-11-21)
- **SEI ATAM** (Kazman/Klein/Clements, [CMU/SEI-2000-TR-004](https://resources.sei.cmu.edu/library/asset-view.cfm?assetid=5177)) is the working evaluation method: quality-attribute utility tree → scenarios → architectural approaches → **sensitivity points, trade-off points, risks/non-risks**. Run ATAM inside the 42030 frame. **[O]**
- **ISO 42010 description checklist** (apply to every architecture document, e.g., the output of lab 15 in [labs_and_evaluation.md](labs_and_evaluation.md)): stakeholders and concerns named; viewpoints selected with rationale; each view's model kinds declared; correspondences between views recorded; decisions traceable to concerns; the notation/template (arc42, C4, other) identified as a choice, not a conformance claim.

## 4. Domain modeling

- **Strategic DDD first, tactical patterns second.** Bounded contexts, context maps (partnership, shared kernel, customer–supplier, conformist, anticorruption layer, open host service, published language), and the ubiquitous language survive contact with reality; entities/value-objects/aggregates/repositories are implementation detail. Evans (2003), Vernon (2013); distilled in [Domain-Driven Design Reference](https://www.domainlanguage.com/wp-content/uploads/2016/05/DDD_Reference_2015-03.pdf). **[O]**
- **Aggregates are consistency boundaries:** the unit loaded/stored transactionally and the unit of concurrency control. Rule of thumb: one transaction, one aggregate; cross-aggregate coordination via domain events or sagas. Oversized aggregates create contention and lock escalation; undersized ones push invariants into application code where they race.
- **Data modeling is a second, independent discipline.** Relational: normalize to 3NF/BCNF by default; deliberate denormalization documented as a derived-data decision. Dimensional (Kimball/star) for analytics; Data Vault for auditable EDW hubs. NoSQL modeling is **query-first**: enumerate access patterns, then design keys/documents; denormalization and duplication are the norm and must carry an ownership/consistency story. [MongoDB data modeling docs](https://www.mongodb.com/docs/manual/data-modeling/), [DynamoDB best practices](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/best-practices.html). **[O]**
- **Data on the outside vs. inside** (Pat Helland, 2005, [paper](https://www.ics.uci.edu/~cs223/papers/cidr05.pdf)): data crossing service boundaries is immutable, referential, and versioned ("events/messages"); data inside a service is current and mutable. This single framing explains outbox patterns, event schemas, and API contracts. **[O]**

## 5. APIs and service contracts

- **REST/HTTP:** treat HTTP semantics as the API: safe/idempotent methods (`GET`, `PUT`, `DELETE`, `HEAD`), status codes, `ETag`/`If-Match` for optimistic concurrency, `Prefer: respond-async` for long ops. Error bodies per [RFC 9457 problem+json](https://www.rfc-editor.org/rfc/rfc9457). Contracts via [OpenAPI 3.1](https://spec.openapis.org/oas/v3.1.0). **[O]**
- **Idempotency is a protocol feature, not a hope:** idempotency keys for unsafe retries (canonicalized by [Stripe's API](https://docs.stripe.com/api/idempotent_requests)); server stores key→response for a retention window. **[O]**
- **gRPC/Protobuf:** schema-first, code-generated, HTTP/2 streaming; strong for internal east–west traffic; [gRPC docs](https://grpc.io/docs/), [Buf style guide](https://buf.build/docs/best-practices/style-guide). Breaking-change rules: never reuse field numbers, reserve removed fields.
- **GraphQL:** client-driven selection; costs move to the server — require depth/complexity limits, persisted queries, and N+1 protection (dataloader pattern). [GraphQL best practices](https://graphql.org/learn/best-practices/). **[O]**
- **Async contracts:** [AsyncAPI v3](https://www.asyncapi.com/docs/reference/specification/v3.0.0) for message/channel/schema; define ordering keys, dedup semantics, and DLQ policy in the contract, not the wiki.
- **Versioning:** additive-only evolution for events/Protobuf; explicit version negotiation for REST (`/v2/` or media-type). Sunset/deprecation headers per [RFC 9745](https://www.rfc-editor.org/rfc/rfc9745.html). **[O]**
- **Pagination:** cursor-based (keyset) over offset — offset pagination is O(n²) on live data and duplicates/skips under writes. [Use The Index, Luke on keyset pagination](https://use-the-index-luke.com/no-offset). **[O]**

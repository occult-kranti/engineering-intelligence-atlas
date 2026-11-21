# Organization model

## Contents

- Design principles
- Team types and entry criteria
- Scaling triggers
- Interface contracts
- Game and AI overlays

## Design principles

Use public Team Topologies vocabulary as a design aid, not an automatic org-chart generator. Organize around a flow of customer or business value. Keep ownership of build, release, operation, documentation, security, accessibility, and learning close to the stream-aligned team. Reduce cognitive load with self-service platforms and time-boxed enablement rather than permanent handoffs.

Sources: https://teamtopologies.com/key-concepts and https://dora.dev/guides/dora-metrics/

## Team types and entry criteria

| Type | Mission | Add only when | Interaction and exit rule | Anti-pattern |
|---|---|---|---|---|
| Stream-aligned | Own a product/value stream from discovery through operation | Always; this is the default | Own service/API, SLO, backlog, runbook, docs, and team API | Layer-only teams that must hand every feature to another team |
| Platform | Provide a compelling internal product that reduces stream-team load | Multiple teams repeatedly need the same capability and self-service demand exists | X-as-a-Service with roadmap, docs, support model, adoption and reliability measures | Renamed ticket-driven operations team; mandatory immature platform |
| Enabling | Transfer a missing capability or remove a specific obstacle | A measurable capability gap cannot be solved by normal consultation | Facilitation with named recipient, baseline, target, deadline, and exit | Permanent center of excellence that owns the work forever |
| Complicated-subsystem | Own work requiring deep specialist knowledge | Expertise is genuinely irreducible, such as codecs, inference engines, cryptography, rendering, or consensus | Explicit subsystem contract and performance/correctness evidence | Treating messy but ordinary code as a specialist subsystem |

Use collaboration for discovery, X-as-a-Service for stable consumption, and facilitation for temporary capability transfer. Every service relationship needs an owner, API/versioning policy, expected load, security/privacy behavior, SLO, documentation, deprecation policy, and escalation path.

## Scaling triggers

| Current condition | Recommended change | Trigger evidence |
|---|---|---|
| One small product team | Combine compatible roles; keep senior technical ownership explicit | Low coordination overhead and limited operational load |
| Several stream teams repeat infrastructure work | Create the thinnest viable platform | Repeated duplicated effort, long onboarding, inconsistent reliability/security |
| Specialists become ticket gatekeepers | Create an enabling engagement and embed champions | Wait time and late defects rise while capability remains concentrated |
| On-call and reliability work exceed ordinary team capacity | Establish SRE/production engineering or formal embedded rotation | Sustained toil, incident load, unavailable error-budget governance |
| Model/data products multiply | Separate ML platform/MLOps and AI evaluation/governance capabilities | Repeated deployment/eval/monitoring work and material model risk |
| Game production grows | Add specialist craft teams and production/live-operations interfaces | Content pipeline, multi-discipline dependencies, release cadence, player-safety needs |
| Cross-team programs miss dependencies | Add TPM/program capability | Multi-team dependency risk exceeds EM/tech-lead coordination capacity |

Do not use headcount alone as a trigger. Do not invent fixed QA:developer, designer:developer, PM:engineer, or manager:engineer ratios. Derive capacity from demand, service windows, work in progress, cognitive load, risk, and operational load.

## AI and data overlay

Cover research/model development, data acquisition and governance, application integration, evaluation, inference/serving, observability, security/privacy, incident response, and human override/fallback. Use NIST AI RMF GOVERN across the lifecycle and MAP/MEASURE/MANAGE for each system. Maintain an AI inventory, intended context, evaluation evidence, monitoring, incident owner, deactivation mechanism, and decommissioning plan.

Sources: https://www.nist.gov/itl/ai-risk-management-framework and https://airc.nist.gov/airmf-resources/airmf/5-sec-core

## Game-development overlay

A game value stream normally requires game direction, game/systems/level/narrative design, gameplay/engine/graphics/tools engineering, art and technical art, animation, audio, UI/UX, player research, production, QA/playtesting, build/release, online/backend services, data, accessibility, community/player safety, anti-cheat/security, and live operations. Small projects combine these roles; large productions separate them when craft depth and content throughput require it. Do not infer a live game-design vacancy when the current official board has none.

## Interface contract template

For each team or service record: purpose; customers; owned outcomes; inputs; outputs/APIs; accountable owner; collaborators; SLO/quality bar; data classification; security/privacy/accessibility obligations; documentation/runbook; support hours; escalation; change/deprecation policy; measures; interaction mode; review/expiry date.

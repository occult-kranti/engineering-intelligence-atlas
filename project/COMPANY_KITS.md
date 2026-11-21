# Company kits: organization, context and verification

Reviewed 21 November 2026. This public handoff contains reusable implementation
details. Private company identities, client source registers, artifact links,
account records and synchronization credentials remain outside Git.

## Delivered foundation

The [catalog](../company/company-kits/index.json) supplies two organizations:

| Template | Departments | New domain specialties | Common roadmap milestones |
| --- | ---: | ---: | ---: |
| Fintech & Hackathon Studio | 9 | 4 | 8 |
| Social & Digital Presence | 8 | 4 | 10 |

Each company has one initial office. The native company bootstrap contributes
its existing director, QA, curator, blueprint, code and GitHub specialist records,
plus company/office/department assistants. The kit reuses these identities and
adds only the four domain specialties it needs. Ten scoped service contracts
across the two companies reuse the established shared-service staff. All records
are persistent definitions; setup starts no inference worker, schedule or job.

The [installer](../scripts/apply-company-kits.mjs) validates the complete plan,
then uses existing native commands. It does not edit state JSON, call the global
optimizer, replace existing groups or alter policy/authority grants. It adds
dependent roadmap items, stable source references, rooms, staff placement and a
roadmap whiteboard. The original selected company is restored after import.

## Identity and restart contract

Native office, department, staff and knowledge creation returns generated IDs.
The importer saves a small same-company binding record for each managed entity.
Bindings include a schema version, company/kit identity, entity kind, stable key
and actual native ID. Deterministic roadmap, board and new-room IDs complement
these bindings. No source body, token or external authority is encoded in them.

Repeat application preserves names, accepted work, progress, paused contracts,
existing group membership and owner-edited layout. A source revision uses a new
key, rather than replacing historical evidence. A committed operation followed
by an interrupted response can be recovered through scoped semantic identity.
Ambiguous or contradictory matches fail before continuing.

The sequence is additive rather than transactional. A native write failure can
leave a useful partial setup; retain it and rerun the same validated plan after
resolving the cause. Do not delete state or invent new keys to suppress a
conflict. Preflight counts only actual additions, including native implicit
staff, source/binding records, groups, rooms, desks and whiteboards.

## Review finding and correction

The first independent review found a practical failure: internal room/identity
records were appended after source notes. The native worker selected the most
recent six records, hosted Donna selected eight, and the knowledge view selected
one hundred. Internal bindings could displace all useful content.

The patch filters recognized control metadata **before** those limits. Native
workers additionally resolve the assigned employee's unique same-company,
same-kit binding to `prompt-<employee-key>` and its source knowledge record. That
compact task contract remains inside the six-record allowance. Invalid,
conflicting or cross-company references never select arbitrary records.

The role contract remains data. It cannot assign tools, alter an employee's
assignment key, increase a budget or grant sibling-company knowledge. Shared
employees still need the existing explicit service and knowledge-transfer
contracts. A full source document is not fetched merely because its URL appears
in a note.

The human knowledge and ownership-index views also omit internal binding notes.
The records, events and authority history remain intact for recovery/audit.
Knowledge cards expose bounded, deduplicated HTTPS source actions through the
existing external-link bridge, including URLs recorded in cloud-visible source
summaries. Local/internal paths, script URLs, embedded credentials and obvious
credential parameters do not become source actions.

## Private source and website integration

The owner-private application of these kits can extend the generic plan with
source-register records and source-specific roadmap work. A referenced artifact
is not marked as reopened, approved or published without its own evidence.
Generated work, user-reported submissions, actual receipts and measured results
retain separate descriptions.

The same native records reach the website using the existing explicit
`CloudSyncService` protocol. The setup validates the matching baseline, uses a
temporary paired writer, synchronizes, compares canonical projection hashes,
updates the directory with revision checks, and revokes/releases its temporary
device. It does not overwrite another active writer. API verification does not
substitute for an owner browser login or OS-keychain acceptance on a laptop.

The directory can link an existing strategy application to the marketing
company without republishing that application's contents or changing its
audience. A live strategy dashboard does not establish an active campaign.

## Verification and remaining work

The released 0.6.1 source passed nine real-native installer tests,411 desktop tests,
230 renderer assertions and 29 cloud API/directory tests. These include
interrupted creation, replay, preserved owner edits, near-capacity no-ops,
metadata flooding, exact task-contract selection, source actions, scope limits
and unchanged authority. All final CI jobs, release and Pages passed; the matching private Site is deployed. [Validation](VALIDATION.md) and the [release receipt](release-0.6.1.json) retain exact source, package hashes and recovery evidence.

The specialized operating guides are intentionally broader than the current
native record model. Typed marketing account/campaign/approval/receipt tables,
an eligible first social adapter, durable external publishing schedules, real
analytics imports and a runnable fintech prototype remain roadmap work. The
current build supplies the actual organization, reference library, owned work,
blueprints, whiteboards, bounded task context and signed-in website projection.

See the [fintech company](../company/company-kits/fintech-hackathon/README.md),
[social company](../company/company-kits/social-presence/README.md),
[installer guide](../company/company-kits/README.md), [worker ledger](WORKER_LEDGER.md)
and [editor/cloud protocol](EDITOR_AND_CLOUD.md).

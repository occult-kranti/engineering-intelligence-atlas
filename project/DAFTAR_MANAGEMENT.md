# Daftar management: people, authority and evidence

Daftar uses one set of records across the desktop, private website and VS Code client. The owner is the CEO; Director is the planning layer; Donna is the main coordinator. Company and department assistants route work to permanent employee records or contracted shared specialists. A role title describes responsibilities. A capability grant, job assignment and active service contract determine what a managed employee can actually do.

## Start from the task

1. Select a company, office, department or employee in the hierarchy. The composer shows the current conversation scope.
2. Give Donna the outcome, evidence expected, USD ceiling and stopping condition. A local plan can be saved without a model call. Provider execution requires an admitted goal and a configured provider.
3. Open **Decision room** when the task needs independent specialists. Reuse staff through shared-service contracts, select the lenses that matter, and bound the panel's rounds, time, tokens and dollars. Donna synthesizes the returned artifacts; an accepted recommendation is still distinct from code, test or deployment evidence.
4. Use **Office blueprint** to locate the accountable employees and **Whiteboard** to map goals, jobs and roadmap items to owners. These views reference the same records rather than creating separate task lists.
5. In **CEO mode**, inspect current authority, the management ledger and the derived office index. Search by person, scope or work item before hiring another specialist.

The website saves chat immediately, while management commands enter a durable queue. The paired desktop validates and applies that queue on **Sync now**. A queued command is not presented as native completion. The VS Code extension uses the same local or cloud API and scope identifiers.

## Controls and boundaries

| Control | Who uses it | Result |
| --- | --- | --- |
| Hire / pause / resume / fire | Owner, or an employee with applicable `team.manage` authority | Changes the persistent employee assignment; retains historical work |
| Partial grant | Owner or authorized Donna | Explicit nonempty subset of supported capabilities for one scope and expiry |
| Full grant | Owner or authorized Donna | The finite supported application capability set; no operating-system privileges or provider credentials |
| Temporary promotion | Owner or authorized Donna | An acting title plus a timed grant; the permanent role is preserved |
| Revoke grant | Owner or authorized Donna within the delegation boundary | Invalidates that grant and dependent child grants; records a reason |
| Managed employee policy | Owner | Keeps a managed employee subject to explicit grants, including after expiry |
| Pause a company, office, department or group | Applicable owner controls | Prevents new work under that hierarchy and is rechecked before managed side effects |
| Service contract | Portfolio management | Shares selected employee IDs and tools across named recipients without duplicating staff |
| Knowledge transfer | Portfolio management | Grants a specific knowledge reference to a recipient; a common group name does not expose private knowledge |
| Budget / dispatcher settings | Owner | Controls new admission and worker execution; existing artifacts and accounting survive a cap |

The full preset contains `team.manage`, `work.manage`, `knowledge.manage`, `layout.manage`, `roadmap.manage`, `cache.manage`, `authority.manage`, `provider.run`, `github.read_repository` and `github.publish_changes`. Scope can be a company, office, department, employee or goal. The hierarchy determines whether a requested action falls inside it. Grants need a reason and a future expiry no more than 365 days away.

Donna cannot grant authority to herself. Her delegated capabilities, scopes and expiration cannot exceed her active owner-issued parent grants. Parent expiry or revocation invalidates descendants. Cycles are rejected. A first grant enables persistent managed enforcement for that employee: expiration does not silently restore legacy baseline privileges. Only an explicit owner policy change can do that.

The owner remains able to use trusted management controls. The employee command wrapper applies employee authority; it is not an authentication system for arbitrary operating-system processes. Job admission and managed side effects also check current leases, hierarchy pauses, allowed tools, selected knowledge, service contracts and budgets. Raw worker settlement and global policy operations are not delegated by a title or ordinary employee command.

## Shared departments and specialist routing

Engineering, Design & Architecture, Research & Knowledge, Security, Hackathon, and Music & Arts are reusable services. A company contracts the employee IDs it needs. Optimization may pause idle duplicate specialties while preserving history; it does not merge repository histories or delete source companies.

The role library has 23 compact runtime roles. Newton, Tesla, the research skeptic, resonance advisor and paired-research coordinator provide documented methods and evidence requirements; they are methodological lenses, not simulated access to historical people. The Figma design-systems specialist owns interoperable design handoffs. The directory steward owns source links, associations, dates and verification labels. Existing Security staff own the [Clouds Against Humanity curriculum guide](../company/role-library/references/clouds-against-humanity.md), avoiding a duplicate employee for one course.

Use [the role reference index](ROLE_REFERENCE_INDEX.md) for the exact guide, example task packet, source and handoff expected from each role. Only selected bounded role context enters a job. Reference documents do not grant capabilities or authorize an external action.

## Directory, provenance and integrations

The [private application directory](https://atlas-command-office.whatswrong-inc.chatgpt.site/applications) includes saved companies even when no deployed application has been identified. Each indexed repository or website can carry a description, source URL, related projects, grouping and explicit verification status.

Dates have separate meanings: repository creation, website record creation, first publication, last update and latest reachability check. Missing dates remain unknown. An HTTP success means a URL responded; it does not certify its login, application logic or data. A website without a confirmed repository association remains visibly unconfirmed instead of being guessed from a similar title.

Figma file references are saved against a company. The official remote MCP client must be authorized in the client where it will run. The ChatGPT Figma connection, VS Code OAuth and a desktop integration are separate sessions. The OpenPencil adapter provides bounded offline HTML / `.fig` / SVG handoffs with hashes and receipts; it does not execute design plugins or arbitrary code. See [Figma and open design](FIGMA_AND_DESIGN.md).

## Ledgers and large workspaces

The native management ledger records successful control changes and their issuer, scope and reason. The derived office index connects employee, organization and work records and can be rebuilt. It is bounded retained history, not a tamper-proof or hash-chained audit log. Provider cost records, native command receipts and the private integration ledger remain separately identifiable.

Large MCP responses must not turn a completed mutation into a reported failure. When the wire response cannot safely include a full office snapshot, it returns a successful compact receipt with `snapshotOmitted:true`. Clients should inspect the receipt and use the bounded `office_query` reader; they should not repeat the successful mutation just to get its snapshot. Direct in-process callers retain full snapshots. See the actual MCP schema for collection, scope, search and pagination fields.

## Current operating limits

Permanent employee and schedule records are inexpensive stored definitions. They do not imply continuously running model processes. Closing the desktop stops its scheduler and local browser endpoint. Hosted Donna chat generates saved text; it does not execute a terminal, hire employees or publish code by itself. The relay and native worker perform supported actions through their explicit controls.

Desktop sync currently uses one active writer and explicit synchronization. Company, office, department and employee conversations can be continued across surfaces; group messages remain website-only. The owner-private deployment uses D1 and Sites identity. A general multi-user organization service, signed automatic updates, an operating-system daemon and broader isolated code execution remain roadmap work.

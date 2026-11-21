# Source Review employee

Source Review is a deterministic runtime employee managed by Donna. It reviews the external text already supplied to an authorized job. It does not hire a model, make network requests, start a crawler, or acquire additional permissions. Its descriptor is exported from `desktop-shell/src/shared/source-review.ts` with `id: source-reviewer`, `managerId: donna`, `execution: deterministic`, and `modelCalls: 0`.

## Active integration

- The managed GitHub snapshot reader reviews its commit-pinned README and repository description. The existing fixed GitHub API requests and their authorization remain unchanged.
- The desktop and headless `OfficeWorker` review prepared repository text, dependency excerpts, selected company knowledge, and explicitly granted transfers before provider dispatch.
- Instruction-like material is retained as source data. The provider system prompt explicitly rejects source text as permission to change goals, impersonate trusted roles, reveal credentials, or expand tools. Trusted runtime instructions and the owner's task are not replaced by repository or website content.
- A flagged or partially covered source produces a `needs-review` handoff addressed to Donna. The report is saved as a private JSON artifact before dispatch. The ordinary result artifact and job-completion summary link the report, retaining the existing native job/ledger pathway. If generation fails, the failed job retains the review artifact instead.
- `OfficeWorkerStatus.sourceReviews` exposes the latest report per worker, up to four reports for the worker pool. UI consumers must filter the reports by the displayed company and must not imply that a new native employee was hired or that a model process is continuously running.

This is a review handoff, not automatic remediation. It does not modify owner data, create an invitation, grant authority, or silently retry a provider request. An ordinary authorized task can continue using relevant facts from a flagged source; source text never becomes authority, whether or not the heuristic detects it.

## Evidence and bounds

Reports contain fixed finding codes, source IDs, hashes, byte counts, coverage, a timestamp, and the Donna handoff. They contain no raw source excerpts. Known credential-like strings are rejected as metadata IDs. Coverage distinguishes full supplied text from truncated upstream excerpts and bounded scans; an empty/clear report is not a security certification.

The scanner inspects at most 32 supplied sources, 64 KiB per source, and 256 KiB in total. It hashes the supplied text to identify the exact observed inputs. Worker source preparation already has its own byte admission limit. Hidden direction/format characters and Unicode compatibility-width text are normalized for detection; source evidence is not rewritten. Quoted examples are classified as quoted data and do not by themselves trigger a Donna action handoff.

Review timestamps, job IDs and artifact paths are excluded from the provider prompt's stable review metadata. Exact-content cache reuse therefore remains available. A cache hit retains the new attempt's review reference in its ordinary completion receipt without dispatching a model request.

## robots.txt and public reads

Robot exclusion directives are crawl preferences, separately classified from attempts to issue model instructions. A README containing `Disallow:` does not control the managed GitHub API reader. A source cannot authorize its own robots override.

`evaluatePublicSourceReadPolicy` supplies a pure policy decision for an explicit public-read caller. The owner can provide an override for one exact HTTPS URL, identified by a bounded authorization reference. The decision records `owner-advisory-override`, a source fingerprint, and `advisoryRobotsIgnored: true`. The override applies only to advisory exclusion/unknown robots status for that source. It does not override authentication, unavailable content, HTTP errors, rate limits, changed origins, or a redirect to a different URL. URL credentials, local/private host forms, IP literals, unsupported protocols and excessive redirect trails are rejected.

**There is no general website fetcher in this increment.** This policy function does not fetch robots.txt, resolve DNS, follow redirects or send network traffic. A future transport must supply observed status/robots evidence, validate every destination including DNS-resolved addresses, and enforce its own fixed network/access boundaries before using the result. Do not describe the policy decision as an executed website visit.

## Verification

Focused tests exercise directive attempts, quoted examples, credential-like metadata, Unicode/hidden text, upstream truncation, multibyte/source-count bounds, actual worker report persistence, provider failure, cache reuse, GitHub request invariants, exact-source advisory overrides, rejected HTTP statuses, protocol/private-host cases, redirect scope, and malformed policy inputs. Run:

```bash
cd desktop-shell
npm test -- --run tests/source-review.test.ts tests/github-service.test.ts tests/office-worker.test.ts
npx tsc -p tsconfig.json --noEmit
```

The scanner and report persistence run before provider dispatch and before native job completion. They do not perform post-completion mutations that can turn a successful native mutation into a false failure.

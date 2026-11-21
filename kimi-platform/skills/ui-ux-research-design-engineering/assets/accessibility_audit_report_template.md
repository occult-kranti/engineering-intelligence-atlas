# Accessibility Audit Report

**Scope:** <pages/flows audited; what is OUT of scope>
**Baseline:** WCAG 2.2 Level A + AA (the only certifiable target; WCAG 3.0,
ARIA 1.3, and APCA are drafts/exploratory and appear nowhere in this verdict)
**Date / auditor:** <> · WCAG version pinned; 4.1.1 Parsing retired in 2.2

## Method

| Layer | Detail |
|---|---|
| Automated | engine + version (axe-core <> / pa11y <>), rule set, routes/pages covered; automated checks cover only the mechanically testable subset — this report's verdict rests on the full method, not the scan |
| Manual keyboard | tab order, focus visible, no traps, skip links — result |
| Assistive technology | NVDA <> (Windows) / VoiceOver <> (macOS/iOS) on core flows — result + log excerpts |
| Zoom/reflow | 200% zoom (1.4.4), 320 CSS px reflow (1.4.10) — result |
| Motion | prefers-reduced-motion pass; 2.2.2 pause/stop/hide; no flashing (2.3.1) |

## Findings per success criterion

| SC (number, WCAG 2.2) | Level | Result (supports / fails / not applicable) | Evidence (criterion text quoted, not paraphrased; URL) | Severity / user impact | Owner |
|---|---|---|---|---|---|

## Residual known failures

<criterion, severity, owner, remediation status — never hidden to hit a date>

## Verdict wording (external use requires human approval)

Conformance statements leaving the building (site statement, sales answer,
audit response) are HUMAN-gated: evidence sufficiency and wording reviewed
before release. No "WCAG certified" claims; no bare tool scores.

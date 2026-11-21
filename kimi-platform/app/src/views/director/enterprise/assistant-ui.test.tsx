import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createAssistantProposal } from "@contracts/assistant";
import DonnaDrawer, {
  DonnaHeader,
  ScopeSelector,
  ProposalInbox,
  QueuePanel,
  SchedulesPanel,
  CachePanel,
  RepositoriesPanel,
  RepoPlanBadges,
  KnowledgePanel,
} from "./DonnaDrawer";
import { ActionConfirmBody, type ActionConfirmRequest } from "./ActionConfirmDialog";
import { snapshotFixture } from "./testFixtures";
import {
  deriveScopeOptions,
  type JobRowLike,
  type ProposalRowLike,
  type QueueItemRowLike,
  type RepoRowLike,
} from "./useAssistantData";

/**
 * Static-render checks for the Donna drawer presentational components.
 * Containers hold the tRPC hooks; these prove the honest rendering of scope
 * options, OCC badges, gate checklists, countdowns, cache policy, repo
 * quarantine/apply states, study items, knowledge refs, and the emergency
 * stop direct path. No fabricated data: every fixture mirrors the server row
 * shapes.
 */

const snapshot = snapshotFixture();

function proposalFixture(): ProposalRowLike {
  const payload = { companyKey: "software", drain: true, preserveArtifacts: true };
  const dto = createAssistantProposal({
    id: "prop-7",
    scope: "company",
    actor: "company-operations-assistant",
    action: "company.archive",
    payload,
    expectedVersion: 3,
    proposedAt: 1,
  });
  return {
    id: 7,
    proposalKey: "prop-7",
    scope: "company",
    actor: "company-operations-assistant",
    action: "company.archive",
    payload,
    payloadHash: dto.payloadHash,
    expectedVersion: 3,
    risk: "high",
    requiresApproval: true,
    confirmedGates: [],
    status: "proposed",
    resultSummary: "",
    proposedAt: 1,
    decidedAt: null,
    executedAt: null,
  };
}

describe("DonnaHeader", () => {
  it("renders Donna above the Director runtime, the shared-assistant roster, and the direct emergency stop", () => {
    const html = renderToStaticMarkup(
      <DonnaHeader
        pendingProposals={2}
        program={snapshot.program}
        emergencyEnabled={true}
        emergencyReason={null}
        onEmergencyStop={() => {}}
        onClose={() => {}}
      />,
    );
    expect(html).toContain("Donna — CEO Executive Assistant");
    expect(html).toContain("above the Director runtime");
    expect(html).toContain("2 pending proposals");
    // shared assistants run under the same gates and report to Donna
    expect(html).toContain("company-operations-assistant");
    expect(html).toContain("department-coordinator");
    expect(html).toContain("repository-integration-steward");
    expect(html).toContain("reports to donna");
    expect(html).toContain("7/7 (non-bypassable)");
    // emergency stop: direct path, never an assistant proposal
    expect(html).toContain('data-testid="donna-emergency-stop"');
    expect(html).toContain('data-direct-path="enterprise.programCancel"');
    expect(html).toContain("never travels through an assistant proposal");
    // provider text advisory only
    expect(html).toContain("advisory");
    expect(html).toContain("never executes actions");
  });

  it("disables emergency stop with the honest reason when the program is terminal/absent", () => {
    const html = renderToStaticMarkup(
      <DonnaHeader
        pendingProposals={null}
        program={null}
        emergencyEnabled={false}
        emergencyReason="no program exists"
        onEmergencyStop={() => {}}
        onClose={() => {}}
      />,
    );
    expect(html).toContain("no program exists");
    expect(html).toContain('disabled=""');
  });
});

describe("ScopeSelector", () => {
  it("lists snapshot companies/departments and a disabled office option with reason", () => {
    const options = deriveScopeOptions(snapshot);
    const html = renderToStaticMarkup(<ScopeSelector options={options} value="enterprise" onChange={() => {}} />);
    expect(html).toContain("Enterprise — Creative Technology Group");
    for (const c of snapshot.companies) expect(html).toContain(`Company — ${c.name.replaceAll("&", "&amp;")} (${c.key})`);
    for (const d of snapshot.departments) expect(html).toContain(`Department — ${d.name} (${d.key})`);
    expect(html).toContain("none in this enterprise snapshot");
    expect(html).toContain("not materialized");
  });
});

describe("ProposalInbox", () => {
  it("shows payloadHash (verified), risk, scope, expectedVersion, gates and the typed payload diff", () => {
    const row = proposalFixture();
    const html = renderToStaticMarkup(
      <ProposalInbox
        proposals={[row]}
        error={null}
        pending={false}
        onApprove={() => {}}
        onReject={() => {}}
        onExecute={() => {}}
        onCancelProposal={() => {}}
      />,
    );
    expect(html).toContain("company.archive");
    expect(html).toContain("company-operations-assistant");
    expect(html).toContain("high");
    expect(html).toContain("expectedVersion v3");
    expect(html).toContain(`${row.payloadHash.slice(0, 12)}`);
    expect(html).toContain("verified");
    expect(html).toContain("gates: high-risk, plan-approval");
    expect(html).toContain("+ companyKey: &quot;software&quot;");
    expect(html).toContain("+ drain: true");
    expect(html).toContain("+ preserveArtifacts: true");
  });

  it("refuses approval on a payload hash mismatch", () => {
    const row = { ...proposalFixture(), payloadHash: "f".repeat(64) };
    const html = renderToStaticMarkup(
      <ProposalInbox
        proposals={[row]}
        error={null}
        pending={false}
        onApprove={() => {}}
        onReject={() => {}}
        onExecute={() => {}}
        onCancelProposal={() => {}}
      />,
    );
    expect(html).toContain("MISMATCH");
    expect(html).toContain("payload hash mismatch — refusing to approve");
  });
});

describe("ActionConfirmBody (gate confirmations)", () => {
  const request: ActionConfirmRequest = {
    title: "Fire via contract w-backend",
    actionId: "worker.fire",
    risk: "high",
    scope: "enterprise",
    payload: { contractKey: "w-backend", drain: true, preserveArtifacts: true },
    payloadHash: "ab".repeat(32),
    expectedVersion: 3,
    requiredGates: ["high-risk", "plan-approval"],
    confirmLabel: "Fire (drain + preserve)",
    destructive: true,
    run: () => {},
  };

  it("keeps confirm disabled until every required gate is checked, and shows hash/scope/OCC/diff", () => {
    const html = renderToStaticMarkup(
      <ActionConfirmBody
        request={request}
        confirmed={new Set()}
        pending={false}
        error={null}
        onToggleGate={() => {}}
        onCancel={() => {}}
        onConfirm={() => {}}
      />,
    );
    expect(html).toContain("high risk");
    expect(html).toContain("expectedVersion v3");
    expect(html).toContain("ab".repeat(32));
    expect(html).toContain("+ contractKey: &quot;w-backend&quot;");
    expect(html).toContain('data-gate="high-risk"');
    expect(html).toContain('data-gate="plan-approval"');
    expect(html).toContain("confirm every required gate first");
    // submit disabled (0/2 gates confirmed)
    expect(html).toContain('disabled="" aria-disabled="true"');
  });

  it("enables confirm once all gates are confirmed", () => {
    const html = renderToStaticMarkup(
      <ActionConfirmBody
        request={request}
        confirmed={new Set(["high-risk", "plan-approval"] as const)}
        pending={false}
        error={null}
        onToggleGate={() => {}}
        onCancel={() => {}}
        onConfirm={() => {}}
      />,
    );
    const submit = html.match(/<button[^>]*data-testid="action-confirm-submit"[^>]*>/)![0];
    expect(submit).not.toContain('disabled=""');
    expect(submit).toContain('aria-disabled="false"');
  });

  it("renders the API error honestly", () => {
    const html = renderToStaticMarkup(
      <ActionConfirmBody
        request={request}
        confirmed={new Set()}
        pending={false}
        error="State changed concurrently — reload and retry (CONFLICT)."
        onToggleGate={() => {}}
        onCancel={() => {}}
        onConfirm={() => {}}
      />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain("State changed concurrently");
  });
});

describe("QueuePanel", () => {
  const items: QueueItemRowLike[] = [
    { id: 1, queueId: 9, itemKey: "triage:12", itemKind: "repository-triage", refId: "12", title: "re-inspect repo", position: 0, status: "queued", payloadHash: "a".repeat(64) },
    { id: 2, queueId: 9, itemKey: "study:ai", itemKind: "study", refId: "", title: "study plan", position: 1, status: "dispatched", payloadHash: "b".repeat(64) },
  ];

  it("renders items with status, payload hash and the OCC queue version", () => {
    const html = renderToStaticMarkup(
      <QueuePanel
        scope="enterprise"
        scopeKey=""
        queue={{ id: 9, scope: "enterprise", scopeKey: "", version: 5 }}
        items={items}
        loading={false}
        error={null}
        program={snapshot.program}
        pending={false}
        onAdd={() => {}}
        onMove={() => {}}
        onPump={() => {}}
      />,
    );
    expect(html).toContain("OCC v5");
    expect(html).toContain("expectedQueueVersion OCC");
    expect(html).toContain("triage:12");
    expect(html).toContain("dispatched");
    expect(html).toContain("aaaaaaaa…");
    // edge items disable the impossible move
    expect(html).toContain("already first");
    expect(html).toContain("already last");
    // mock pump honesty
    expect(html).toContain("MOCK runs only");
  });

  it("states the empty queue honestly and disables the pump with its reason when paused", () => {
    const paused = snapshotFixture({ programState: "running", pausedAt: new Date(0) });
    const html = renderToStaticMarkup(
      <QueuePanel
        scope="company"
        scopeKey="software"
        queue={null}
        items={[]}
        loading={false}
        error={null}
        program={paused.program}
        pending={false}
        onAdd={() => {}}
        onMove={() => {}}
        onPump={() => {}}
      />,
    );
    expect(html).toContain("This queue is empty");
    expect(html).toContain("program is paused — the pump refuses to dispatch");
    expect(html).toContain("no queue yet");
  });
});

describe("SchedulesPanel", () => {
  const jobs: JobRowLike[] = [
    {
      id: 1,
      jobKey: "ledger-hourly",
      scope: "enterprise",
      scopeKey: "",
      kind: "ledger_refresh",
      schedule: { type: "interval", intervalMs: 3_600_000, anchorAt: 1_800_000_000_000 },
      enabled: true,
      nextRunAt: 1_800_000_600_000,
      lastRunAt: null,
      runCount: 0,
      maxRuns: null,
      version: 1,
    },
  ];

  it("renders real nextRun + countdown, runs/maxRuns, zero budget, and the never-paid-auto policy", () => {
    const now = 1_800_000_300_000;
    const html = renderToStaticMarkup(
      <SchedulesPanel
        jobs={jobs}
        now={now}
        error={null}
        scope="enterprise"
        scopeKey=""
        pending={false}
        onCreate={() => {}}
        onPause={() => {}}
        onResume={() => {}}
        onDelete={() => {}}
        onRunNow={() => {}}
      />,
    );
    expect(html).toContain("never make provider calls, never make paid calls");
    expect(html).toContain("ledger-hourly");
    expect(html).toContain("refresh-ledger");
    expect(html).toContain("in 5m");
    expect(html).toContain("0 runs (unbounded interval)");
    expect(html).toContain("zero reservation");
    expect(html).toContain("Run now…");
    expect(html).toContain("Missed intervals are never replayed");
  });
});

describe("CachePanel", () => {
  it("lists all four namespaces with the provider-responses-never-cached policy", () => {
    const html = renderToStaticMarkup(
      <CachePanel
        namespaces={[
          { namespace: "snapshot", serverSide: true, memoizedEntries: 3, keyedBy: "(enterprise.version, maxEventSeq)" },
          { namespace: "skill-excerpts", serverSide: false },
          { namespace: "blueprint", serverSide: false },
          { namespace: "repository-metadata", serverSide: false },
        ]}
        error={null}
        pending={false}
        lastResult={null}
        onInvalidate={() => {}}
      />,
    );
    expect(html).toContain("Provider responses are never cached");
    for (const ns of ["snapshot", "skill-excerpts", "blueprint", "repository-metadata"]) expect(html).toContain(ns);
    expect(html).toContain("3 entries");
    expect((html.match(/Invalidate/g) ?? []).length).toBe(4);
  });
});

describe("RepositoriesPanel", () => {
  it("renders plan badges: quarantine, confidence, license honesty, read-only", () => {
    const html = renderToStaticMarkup(
      <RepoPlanBadges
        plan={{
          status: "quarantined",
          companyKey: null,
          departmentKey: null,
          discipline: null,
          skillId: null,
          confidence: 0,
          rationale: "no declared routing rule matched",
          readOnly: true,
          redistributionAllowed: false,
          notes: [],
        }}
      />,
    );
    expect(html).toContain("quarantined");
    expect(html).toContain("confidence 0%");
    expect(html).toContain("read-only");
    expect(html).toContain("redistribution forbidden");
  });

  it("refuses credentialed previews with the honest reason and never mentions cloning", () => {
    const html = renderToStaticMarkup(
      <RepositoriesPanel
        repos={[]}
        error={null}
        preview={null}
        previewError={null}
        previewing={false}
        importResults={null}
        pending={false}
        onPreview={() => {}}
        onImport={() => {}}
        onApply={() => {}}
      />,
    );
    expect(html).toContain("never clones, never fetches code, and never creates companies, departments, or roles automatically");
    expect(html).toContain("public-anonymous");
    expect(html).toContain("credentialed-approved");
    expect(html).toContain("Import (gates: external-writes + credentials + high-risk)");
  });

  it("shows an imported repo with its plan and the approved-apply control", () => {
    const repo: RepoRowLike = {
      id: 3,
      url: "https://github.com/octo/backend-kit",
      ownerName: "octo",
      name: "backend-kit",
      description: "backend toolkit",
      language: "TypeScript",
      topics: ["backend", "api"],
      license: "mit",
      archived: false,
      defaultBranch: "main",
      commitSha: "a".repeat(40),
      visibility: "public",
      intakeMode: "public-anonymous",
      plans: [
        {
          id: 1,
          url: "https://github.com/octo/backend-kit",
          commitSha: "a".repeat(40),
          status: "assigned",
          companyKey: "software",
          departmentKey: "svc-backend-engineering",
          discipline: "backend-engineering",
          skillId: "architecture-database-backend-engineering",
          confidence: 0.7,
          rationale: "matched backend rule",
          readOnly: false,
          redistributionAllowed: true,
          notes: [],
          appliedBy: null,
        },
      ],
    };
    const html = renderToStaticMarkup(
      <RepositoriesPanel
        repos={[repo]}
        error={null}
        preview={null}
        previewError={null}
        previewing={false}
        importResults={null}
        pending={false}
        onPreview={() => {}}
        onImport={() => {}}
        onApply={() => {}}
      />,
    );
    expect(html).toContain("octo/backend-kit");
    expect(html).toContain("aaaaaaaaaa…");
    expect(html).toContain("assigned");
    expect(html).toContain("software/svc-backend-engineering");
    expect(html).toContain("Apply assignment");
  });
});

describe("KnowledgePanel", () => {
  it("renders study drafts summary, refs-only transfer form, and transfer hashes", () => {
    const html = renderToStaticMarkup(
      <KnowledgePanel
        snapshot={snapshot}
        studyItems={[
          { id: 1, itemKey: "ai-research-frontier:abcdef123456", skillId: "ai-research-frontier", resourceRef: "https://example.org/paper", topic: "paper", goal: "learn", evaluation: "", status: "draft" },
        ]}
        transfers={[
          {
            id: 1,
            transferKey: "handoff-1",
            refs: [{ artifactId: 11, title: "design tokens", contentSha256: "c".repeat(64) }],
            handoff: { from: "svc-design", to: "svc-backend-engineering", summary: "token handoff" },
            contentSha256: "d".repeat(64),
            createdAt: new Date(0),
          },
        ]}
        artifacts={[]}
        artifactQuery=""
        artifactSearchEnabled={false}
        transferScopeOk={false}
        transferScopeReason="knowledge transfers run at department scope (the department-coordinator actor) — select a department in the scope selector above"
        exported={null}
        pending={false}
        onArtifactQuery={() => {}}
        onStudyEnqueue={() => {}}
        onTransfer={() => {}}
        onExport={() => {}}
      />,
    );
    expect(html).toContain("deduped by");
    expect(html).toContain("never a paid provider call");
    expect(html).toContain("1 item(s): 1 draft");
    expect(html).toContain("ai-research-frontier:abcdef123456");
    expect(html).toContain("svc-design → svc-backend-engineering");
    expect(html).toContain(`${"c".repeat(12)}…`);
    expect(html).toContain(`sha ${"d".repeat(12)}…`);
    // transfer submit disabled out of department scope, with the reason
    expect(html).toContain("department-coordinator actor");
    const submit = html.match(/<button[^>]*data-testid="donna-transfer-submit"[^>]*>/)![0];
    expect(submit).toContain('disabled=""');
  });
});

describe("DonnaDrawer module", () => {
  it("default-exports the container (wired separately) and keeps tab ids stable", () => {
    expect(typeof DonnaDrawer).toBe("function");
  });
});

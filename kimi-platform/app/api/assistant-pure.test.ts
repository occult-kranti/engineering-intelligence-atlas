import { describe, expect, it } from "vitest";
import {
  ASSISTANT_ACTIONS,
  ASSISTANT_ACTION_POLICIES,
  ASSISTANT_DEFINITIONS,
  ASSISTANT_GATES,
  ASSISTANT_JOB_KINDS,
  ASSISTANT_JOB_POLICIES,
  ASSISTANT_QUEUE_ITEM_KINDS as CONTRACT_QUEUE_ITEM_KINDS,
  ASSISTANT_QUEUE_ITEM_STATUSES as CONTRACT_QUEUE_ITEM_STATUSES,
  CACHE_NAMESPACES as CONTRACT_CACHE_NAMESPACES,
  DEPARTMENT_LIFECYCLE_STATUSES,
  GITHUB_INTAKE_MODES as CONTRACT_INTAKE_MODES,
  createAssistantJob,
  scheduleNextRun,
} from "@contracts/assistant";
import { appRouter } from "./router";
import { ACTION_PROCEDURES } from "./routers/assistant";
import {
  ASSISTANT_CACHE_NAMESPACES,
  ASSISTANT_QUEUE_ITEM_KINDS,
  GITHUB_INTAKE_MODES,
} from "./assistant";
import { parseGithubRepoUrl } from "./integrations/connectors";

/**
 * Pure assistant backend parity tests (no DB): the action→procedure map, the
 * emergency-stop invariant, deterministic job policy, schedule bounds, and
 * the GitHub intake SSRF guardrails.
 */
describe("assistant pure parity", () => {
  it("maps every ASSISTANT_ACTION to exactly one procedure, no extras", () => {
    expect(ASSISTANT_ACTIONS).toHaveLength(24);
    for (const action of ASSISTANT_ACTIONS) {
      const procedure = ACTION_PROCEDURES[action];
      expect(procedure, `${action} must map to a procedure`).toBeTruthy();
      expect(procedure).toMatch(/^assistant\.[a-zA-Z]+$/);
    }
    for (const id of Object.keys(ACTION_PROCEDURES)) {
      expect(ASSISTANT_ACTIONS.some((a) => a === id)).toBe(true);
    }
  });

  it("mounts the assistant router with owner-scoped procedures", () => {
    const procedures = Object.keys(appRouter._def.procedures)
      .filter((k) => k.startsWith("assistant."))
      .map((k) => k.slice("assistant.".length));
    for (const name of [
      "definitions",
      "status",
      "propose",
      "decideProposal",
      "executeProposal",
      "cancelProposal",
      "proposals",
      "queueGet",
      "queueAdd",
      "queueReorder",
      "workerHire",
      "workerPause",
      "workerResume",
      "workerFire",
      "setDepartmentStatus",
      "setCompanyStatus",
      "cacheStatus",
      "cacheInvalidate",
      "jobsList",
      "jobUpsert",
      "jobPause",
      "jobResume",
      "jobDelete",
      "jobRunNow",
      "studyEnqueue",
      "studyList",
      "repoPreview",
      "repoFetch",
      "repoApply",
      "reposList",
      "knowledgeTransfer",
      "knowledgeList",
      "knowledgeExport",
      "events",
    ]) {
      expect(procedures, `assistant.${name} missing`).toContain(name);
    }
  });

  it("keeps emergency stop OUT of the assistant action set", () => {
    for (const action of ASSISTANT_ACTIONS) {
      expect(action.toLowerCase()).not.toContain("stop");
    }
    // Every procedure the router exposes is mapped from the closed set;
    // programCancel/stopRun stay on the ungated enterprise/runtime routers.
    const procedures = Object.keys(appRouter._def.procedures)
      .filter((k) => k.startsWith("assistant."))
      .map((k) => k.slice("assistant.".length));
    expect(procedures.some((p) => p.toLowerCase().includes("stop"))).toBe(false);
  });

  it("keeps every assistant job deterministic, free, and non-executing", () => {
    expect(ASSISTANT_JOB_KINDS).toHaveLength(5);
    for (const kind of ASSISTANT_JOB_KINDS) {
      const policy = ASSISTANT_JOB_POLICIES[kind];
      expect(policy.providerCalls).toBe(false);
      expect(policy.paidCalls).toBe(false);
      expect(policy.executesProposals).toBe(false);
    }
  });

  it("scheduleNextRun clamps and never storms (contract re-assertion)", () => {
    const now = 1_800_000_000_000;
    const job = createAssistantJob({
      id: "j1",
      scope: "enterprise",
      kind: "cache_refresh",
      schedule: { type: "interval", intervalMs: 60_000, anchorAt: now - 365 * 24 * 3600 * 1000 },
    });
    // A year of missed intervals collapses into exactly one future run.
    const next = scheduleNextRun(job, now);
    expect(next).not.toBeNull();
    expect(next!).toBeGreaterThan(now);
    expect(next!).toBeLessThanOrEqual(now + 60_000);
    // maxRuns terminator.
    const done = scheduleNextRun({ ...job, runCount: 1, maxRuns: 1 }, now);
    expect(done).toBeNull();
    // One-time jobs fire at most once.
    const once = createAssistantJob({
      id: "j2",
      scope: "enterprise",
      kind: "ledger_refresh",
      schedule: { type: "one-time", runAt: now - 1000 },
    });
    expect(scheduleNextRun(once, now)).toBe(once.schedule.type === "one-time" ? now - 1000 : null);
    expect(scheduleNextRun({ ...once, runCount: 1 }, now)).toBeNull();
  });

  it("derives approval/gate requirements from declared policies", () => {
    const byId = ASSISTANT_ACTION_POLICIES;
    expect(byId["queue.add"].requiresApproval).toBe(false);
    expect(byId["worker.fire"].requiresApproval).toBe(true);
    expect(byId["worker.fire"].gates).toContain("high-risk");
    expect(byId["worker.fire"].drainAndPreserve).toBe(true);
    expect(byId["repository.import"].gates).toEqual(
      expect.arrayContaining(["external-writes", "credentials", "high-risk"]),
    );
    expect(byId["program.pump"].gates).toContain("live-provider-confirmation");
    // Structural actions always require approval.
    for (const action of ASSISTANT_ACTIONS) {
      const policy = ASSISTANT_ACTION_POLICIES[action];
      if (policy.structural || policy.external) expect(policy.requiresApproval).toBe(true);
      for (const gate of policy.gates) expect(ASSISTANT_GATES).toContain(gate);
    }
    // Assistants are permanent and Donna sits at enterprise scope.
    expect(ASSISTANT_DEFINITIONS.donna.scope).toBe("enterprise");
    expect(ASSISTANT_DEFINITIONS["repository-integration-steward"].reportsTo).toBe("donna");
    expect(ASSISTANT_DEFINITIONS["repository-integration-steward"].permanent).toBe(true);
  });

  it("pins the web-local enum values AND keeps them equal to the contract", () => {
    expect(ASSISTANT_QUEUE_ITEM_KINDS).toEqual([
      "company-run",
      "study",
      "repository-triage",
      "custom",
    ]);
    expect(GITHUB_INTAKE_MODES).toEqual(["public-anonymous", "credentialed-approved"]);
    expect(ASSISTANT_CACHE_NAMESPACES).toEqual([
      "skill-excerpts",
      "blueprint",
      "snapshot",
      "repository-metadata",
    ]);
    // Drift guard: db/schema.ts carries local copies so persistence never
    // depends on the byte-pinned shared contract; they MUST stay identical.
    expect([...CONTRACT_QUEUE_ITEM_KINDS]).toEqual([...ASSISTANT_QUEUE_ITEM_KINDS]);
    expect([...CONTRACT_QUEUE_ITEM_STATUSES]).toEqual(["queued", "dispatched", "done", "dropped"]);
    expect([...CONTRACT_INTAKE_MODES]).toEqual([...GITHUB_INTAKE_MODES]);
    expect([...CONTRACT_CACHE_NAMESPACES]).toEqual([...ASSISTANT_CACHE_NAMESPACES]);
    expect([...DEPARTMENT_LIFECYCLE_STATUSES]).toEqual(["active", "paused", "archived"]);
  });

  it("rejects non-GitHub / non-HTTPS repository URLs (SSRF guard)", () => {
    expect(() => parseGithubRepoUrl("https://github.com/owner/repo")).not.toThrow();
    expect(() => parseGithubRepoUrl("http://github.com/owner/repo")).toThrowError(/https/);
    expect(() => parseGithubRepoUrl("https://evil.example.com/owner/repo")).toThrowError(
      /github\.com/,
    );
    expect(() => parseGithubRepoUrl("https://github.com.evil.com/owner/repo")).toThrow();
    expect(() => parseGithubRepoUrl("https://github.com/owner/repo@evil.com")).toThrow();
    expect(() => parseGithubRepoUrl("not-a-url")).toThrow();
  });
});

import { describe, expect, it } from "vitest";
import {
  ENTERPRISE_ACTIONS,
  PERMANENT_STEWARD_ROLES,
  deriveTimelineIndex,
  type WorkLedgerEntry,
} from "@contracts/enterprise";
import { ACTION_PROCEDURES } from "./routers/enterprise";
import { contractCapacityGroupId } from "./enterprise";

/**
 * Pure parity tests (no DB): the declarative action map, steward metadata,
 * capacity-group id derivation, and ledger→timeline derivation over the
 * shared contract functions.
 */
describe("enterprise pure parity", () => {
  it("maps every ENTERPRISE_ACTIONS control to exactly one procedure", () => {
    expect(ENTERPRISE_ACTIONS).toHaveLength(12);
    for (const action of ENTERPRISE_ACTIONS) {
      const procedure = ACTION_PROCEDURES[action.id];
      expect(procedure, `${action.id} must map to a procedure`).toBeTruthy();
      expect(procedure).toMatch(/^enterprise\.[a-zA-Z]+$/);
    }
    // No procedure is mapped that the contract does not declare.
    for (const id of Object.keys(ACTION_PROCEDURES)) {
      expect(ENTERPRISE_ACTIONS.some((a) => a.id === id)).toBe(true);
    }
  });

  it("keeps approval gates on the destructive/activation actions", () => {
    const byId = new Map(ENTERPRISE_ACTIONS.map((a) => [a.id, a]));
    expect(byId.get("blueprint.apply")?.approval).toBe("blueprint-activation");
    expect(byId.get("memory.promote")?.approval).toBe("memory-promote");
    // The contract decision IS the approval (no second gate).
    expect(byId.get("contract.decide")?.approval).toBeNull();
    // Program start is gated on company plan approvals (the plan gate).
    expect(byId.get("program.start")?.approval).toBe("plan");
  });

  it("labels stewards as deterministic, non-claimable system metadata", () => {
    for (const steward of Object.values(PERMANENT_STEWARD_ROLES)) {
      expect(steward.actor).toBe("system");
      expect(steward.authority).toBe("propose-only");
      expect(steward.providerCalls).toBe(false);
      expect(steward.executesNodes).toBe(false);
      expect(steward.externalWrites).toBe(false);
      expect(steward.derivation).toBe("deterministic");
      expect(steward.title).toBeTruthy();
    }
    expect(PERMANENT_STEWARD_ROLES["evidence-ledger-steward"]).toBeDefined();
    expect(PERMANENT_STEWARD_ROLES["cache-budget-steward"]).toBeDefined();
  });

  it("derives deterministic capacity group ids", () => {
    expect(contractCapacityGroupId(7, 42)).toBe("ent-7:dept-42");
    expect(contractCapacityGroupId(7, 42)).toBe(contractCapacityGroupId(7, 42));
  });

  it("derives timeline entries from ledger rows via the shared contract", () => {
    const entry: WorkLedgerEntry = {
      seq: 1,
      ts: 1_700_000_000_000,
      enterpriseId: "ctg-pure",
      companyKey: null,
      projectId: null,
      officeId: null,
      roomId: null,
      workerId: null,
      nodeKey: "scope",
      runId: 1,
      attempt: 1,
      kind: "prompt_started",
      status: "compiled",
      intendedAsk: "do the thing",
      promptSha256: "a".repeat(64),
      returnedSummary: "",
      artifactRef: null,
      usage: null,
      skillRef: null,
    };
    const timeline = deriveTimelineIndex([entry]);
    expect(timeline).toHaveLength(1);
    expect(timeline[0]).toMatchObject({
      ledgerSeq: 1,
      ts: entry.ts,
      enterpriseId: "ctg-pure",
      kind: "prompt_started",
      runId: 1,
    });
  });
});

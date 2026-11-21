/**
 * TEST-ONLY fixtures. Imported exclusively by *.test.ts(x) files in this
 * directory — production components must never import from here; they
 * receive live data through Availability<T> envelopes instead.
 */
import type {
  AgentCard,
  OfficeBlueprintData,
  RoomState,
  WbRevisionMeta,
  WhiteboardDoc,
} from "./model";
import { live } from "../workspace/adapter";

export function agent(partial: Partial<AgentCard> & { workerId: number }): AgentCard {
  return {
    name: `W-${partial.workerId}`,
    kind: "subagent",
    role: "engineer",
    roomKey: "engineering",
    status: "active",
    capabilities: [],
    skillPins: [],
    maxConcurrentClaims: 2,
    version: 1,
    workload: { activeClaims: 0, queued: 0 },
    lease: live({
      holder: `W-${partial.workerId}`,
      heartbeatAgeSec: 3,
      expiresInSec: 72,
      stale: false,
    }),
    currentTasks: [],
    ...partial,
  };
}

export function room(partial: Partial<RoomState> & { roomKey: string }): RoomState {
  return {
    name: partial.roomKey,
    glyph: "◦",
    purpose: `${partial.roomKey} purpose`,
    capacity: 3,
    eligibleRolePatterns: ["engineer", "builder"],
    capabilitiesRequired: [],
    agents: [],
    tasks: { running: 0, ready: 0, blocked: 0, failed: 0 },
    compute: {
      allocTokens: 16_000,
      usedTokens: 4_000,
      allocUsdMicros: 400_000,
      usedUsdMicros: 100_000,
      simulated: false,
    },
    storage: { allocMb: 1024, usedMb: 128, artifactCount: 2, storageErrors: 0 },
    version: 1,
    ...partial,
  };
}

/** The canonical eight rooms, lightly populated — mirrors the design doc. */
export function officeFixture(overrides: Partial<OfficeBlueprintData> = {}): OfficeBlueprintData {
  const rooms: RoomState[] = [
    room({
      roomKey: "executive",
      name: "Executive Direction",
      glyph: "✦",
      capacity: 1,
      eligibleRolePatterns: ["director"],
      agents: [
        agent({
          workerId: 0,
          name: "director",
          kind: "director",
          role: "director",
          roomKey: "executive",
          workload: { activeClaims: 1, queued: 0 },
        }),
      ],
    }),
    room({ roomKey: "product-design", name: "Product & Design", glyph: "✎", eligibleRolePatterns: ["product", "design"] }),
    room({
      roomKey: "engineering",
      name: "Engineering Bay",
      glyph: "⚙",
      capacity: 4,
      agents: [
        agent({ workerId: 1, name: "EN-1 Kepler", workload: { activeClaims: 1, queued: 0 }, currentTasks: [{ nodeKey: "extract-forks", state: "running", attempt: 1 }] }),
        agent({ workerId: 2, name: "EN-2 Wren" }),
        agent({ workerId: 3, name: "EN-3 Ada", status: "suspended" }),
      ],
      tasks: { running: 1, ready: 2, blocked: 0, failed: 0 },
      compute: { allocTokens: 56_000, usedTokens: 47_200, allocUsdMicros: 1_680_000, usedUsdMicros: 1_420_000, simulated: false },
      storage: { allocMb: 3072, usedMb: 1945, artifactCount: 14, storageErrors: 0 },
    }),
    room({ roomKey: "ai-research", name: "AI & Research Lab", glyph: "✳", capacity: 4, eligibleRolePatterns: ["research", "analyst"] }),
    room({
      roomKey: "data-knowledge",
      name: "Data & Knowledge",
      glyph: "▤",
      eligibleRolePatterns: ["librarian", "taxonomy"],
      storage: { allocMb: 4096, usedMb: null, artifactCount: 9, storageErrors: 0 },
    }),
    room({
      roomKey: "security-trust",
      name: "Security & Trust",
      glyph: "⛨",
      capacity: 2,
      eligibleRolePatterns: ["security", "vetter"],
      agents: [
        agent({
          workerId: 9,
          name: "ST-1 Bram",
          role: "security vetter",
          roomKey: "security-trust",
          lease: live({ holder: "ST-1 Bram", heartbeatAgeSec: 360, expiresInSec: -240, stale: true }),
          currentTasks: [{ nodeKey: "skill-vetting", state: "failed", attempt: 3 }],
        }),
      ],
      tasks: { running: 0, ready: 0, blocked: 0, failed: 1 },
    }),
    room({ roomKey: "qa-evidence", name: "QA & Evidence", glyph: "✓", capacity: 2, eligibleRolePatterns: ["qa", "evaluator"] }),
    room({
      roomKey: "operations",
      name: "Operations Deck",
      glyph: "≡",
      capacity: 2,
      eligibleRolePatterns: ["sweeper", "ops"],
      compute: { allocTokens: 0, usedTokens: 0, allocUsdMicros: 0, usedUsdMicros: 0, simulated: false },
    }),
  ];
  return {
    projectId: 1,
    rooms,
    bench: [agent({ workerId: 20, name: "PD-3 Lark", role: "copywriter", roomKey: null })],
    runBudgetUsdMicros: 5_000_000,
    runningTasks: 1,
    updatedAt: new Date(0).toISOString(),
    ...overrides,
  };
}

export function emptyOfficeFixture(): OfficeBlueprintData {
  const base = officeFixture({ bench: [], runningTasks: 0 });
  return {
    ...base,
    rooms: base.rooms.map((r) => ({
      ...r,
      agents: [],
      tasks: { running: 0, ready: 0, blocked: 0, failed: 0 },
      compute: { ...r.compute, allocTokens: 0, allocUsdMicros: 0, usedTokens: 0, usedUsdMicros: 0 },
    })),
  };
}

export function whiteboardFixture(overrides: Partial<WhiteboardDoc> = {}): WhiteboardDoc {
  return {
    projectId: 1,
    revision: 12,
    version: 30,
    planHash: "4c9a77e1abcdef00",
    updatedAt: new Date(0).toISOString(),
    updatedBy: "you",
    nodes: [
      { id: "m1", kind: "milestone", title: "Research sweep", milestoneKey: "M1", orderIndex: 0, position: { x: 200, y: 60 } },
      { id: "m2", kind: "milestone", title: "Catalog build", milestoneKey: "M2", orderIndex: 1, position: { x: 200, y: 260 } },
      { id: "t1", kind: "task", title: "model-scan", milestoneKey: "M1", binding: { dagNodeKey: "model-scan", runId: 18 }, position: { x: 140, y: 130 } },
      { id: "t2", kind: "task", title: "taxonomy-build", milestoneKey: "M2", binding: { dagNodeKey: "taxonomy-build", runId: 18 }, position: { x: 140, y: 330 } },
      { id: "t3", kind: "task", title: "draft task", position: { x: 420, y: 330 } },
      { id: "n1", kind: "note", title: "forks cluster", body: "needs the 3d-reconstruction skill pin", position: { x: 420, y: 140 } },
    ],
    edges: [
      { id: "e1", from: "t1", to: "t2", kind: "dependency" },
      { id: "e2", from: "t2", to: "t2", kind: "ownership", ownership: { roomKey: "data-knowledge" } },
      { id: "e3", from: "n1", to: "t1", kind: "note-link" },
    ],
    ...overrides,
  };
}

export function revisionFixture(): WbRevisionMeta[] {
  return [
    { revision: 12, createdAt: new Date(0).toISOString(), author: "you", note: "editing lease held", nodeCount: 6, edgeCount: 3 },
    { revision: 11, createdAt: new Date(0).toISOString(), author: "roadmap-cartographer", note: "auto-tidy: aligned to plan rev 7", nodeCount: 6, edgeCount: 3 },
  ];
}

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { live, unavailable } from "../workspace/adapter";
import OfficeBlueprint from "./OfficeBlueprint";
import TeamBoard from "./TeamBoard";
import SetupChecklist from "./SetupChecklist";
import DigitalRolesPanel from "./DigitalRolesPanel";
import ReassignMenu from "./ReassignMenu";
import OwnershipInspector from "./OwnershipInspector";
import OwnershipWhiteboard from "./OwnershipWhiteboard";
import WhiteboardCanvas from "./WhiteboardCanvas";
import WhiteboardList from "./WhiteboardList";
import EditLeaseBar from "./EditLeaseBar";
import ConflictDialog from "./ConflictDialog";
import VersionRail from "./VersionRail";
import {
  agent,
  emptyOfficeFixture,
  officeFixture,
  revisionFixture,
  room,
  whiteboardFixture,
} from "./testFixtures";
import type { RunNodeLike } from "./model";

const liveNodes: Record<string, RunNodeLike> = {
  "taxonomy-build": { nodeKey: "taxonomy-build", state: "running", attempts: 1 },
  "model-scan": { nodeKey: "model-scan", state: "accepted", attempts: 1 },
};
const liveLookup = (k: string) => liveNodes[k];

describe("OfficeBlueprint", () => {
  it("renders the honest unavailable envelope — no fabricated rooms", () => {
    const html = renderToStaticMarkup(
      <OfficeBlueprint
        blueprint={unavailable("worker pool endpoints are not exposed yet")}
        onReassign={() => Promise.resolve({ ok: true })}
      />,
    );
    expect(html).toContain("control data unavailable");
    expect(html).toContain("worker pool endpoints are not exposed yet");
    expect(html).not.toContain("Engineering Bay");
    expect(html).not.toContain("data-room-key");
  });

  it("renders the eight rooms with live capacity, health reasons, and meters", () => {
    const html = renderToStaticMarkup(
      <OfficeBlueprint
        blueprint={live(officeFixture())}
        onReassign={() => Promise.resolve({ ok: true })}
      />,
    );
    expect((html.match(/data-room-key=/g) ?? []).length).toBe(8);
    expect(html).toContain("Engineering Bay");
    expect(html).toContain("Operations Deck");
    expect(html).toContain("panel-dark"); // the machine room stays dark
    expect(html).toContain("seats 5 / 21");
    expect(html).toContain("6 healthy");
    expect(html).toContain("1 strained");
    expect(html).toContain("1 degraded");
    // health names its reason — never color alone
    expect(html).toContain("degraded · lease stale (ST-1 Bram)");
    expect(html).toContain("strained · budget 85%");
    // stale lease rendered as alert text on the agent chip
    expect(html).toContain("stale · hb 6 m ago");
    // unmetered storage says so instead of faking a number
    expect(html).toContain("metering unavailable");
    // full aria summary
    expect(html).toContain("Security &amp; Trust, 1 of 2 seats, health degraded");
    // bench with explicit assign action (drag is never the only path)
    expect(html).toContain("PD-3 Lark");
    expect(html).toContain("Assign to room…");
    expect(html).toContain('aria-live="polite"');
  });

  it("shows the over-capacity resolve chip when config shrinks under occupancy", () => {
    const bp = officeFixture();
    bp.rooms = bp.rooms.map((r) =>
      r.roomKey === "engineering" ? { ...r, capacity: 2 } : r,
    );
    const html = renderToStaticMarkup(
      <OfficeBlueprint blueprint={live(bp)} onReassign={() => Promise.resolve({ ok: true })} />,
    );
    expect(html).toContain("over capacity 3/2 — resolve");
  });

  it("teaches the empty office instead of faking agents", () => {
    const html = renderToStaticMarkup(
      <OfficeBlueprint
        blueprint={live(emptyOfficeFixture())}
        onReassign={() => Promise.resolve({ ok: true })}
      />,
    );
    expect(html).toContain("No hires yet");
    expect(html).toContain("Empty room");
    expect(html).not.toContain("EN-1 Kepler");
  });
});

describe("ReassignMenu (capacity & eligibility, no fake success)", () => {
  it("announces per-room verdicts and disables blocked destinations", () => {
    const bp = officeFixture();
    const wren = bp.rooms.find((r) => r.roomKey === "engineering")!.agents[1]!;
    const html = renderToStaticMarkup(
      <ReassignMenu
        agent={wren}
        rooms={bp.rooms}
        onReassign={() => Promise.resolve({ ok: true })}
        onClose={() => undefined}
      />,
    );
    // executive is 1/1 with the director seated → blocked with the reason
    expect(html).toContain("room at capacity (1/1)");
    expect(html).toContain('data-verdict="blocked"');
    expect(html).toContain('data-verdict="eligible"');
    // engineer is eligible in data-knowledge? no — role mismatch is named
    expect(html).toContain("role &quot;engineer&quot; not eligible here");
    // no claims → no policy required, but nothing is submitted yet
    expect(html).not.toContain("Claims policy");
    expect(html).toContain("Confirm reassignment");
  });

  it("forces the drain / release-requeue choice when claims are held", () => {
    const bp = officeFixture();
    const kepler = bp.rooms.find((r) => r.roomKey === "engineering")!.agents[0]!;
    const html = renderToStaticMarkup(
      <ReassignMenu
        agent={kepler}
        rooms={bp.rooms}
        onReassign={() => Promise.resolve({ ok: true })}
        onClose={() => undefined}
      />,
    );
    expect(html).toContain("holds 1 active claim");
    expect(html).toContain("drain");
    expect(html).toContain("release-requeue");
    expect(html).toContain("never auto-retried");
  });
});

describe("TeamBoard (accessible tree parity)", () => {
  it("renders the same office as an operable tree", () => {
    const bp = officeFixture();
    const html = renderToStaticMarkup(
      <TeamBoard
        blueprint={live(bp)}
        initialExpanded={["engineering", "security-trust", "__bench__"]}
        onReassign={() => Promise.resolve({ ok: true })}
      />,
    );
    expect(html).toContain('role="tree"');
    expect(html).toContain('role="treeitem"');
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('aria-level="2"');
    // same data as the floor plan
    expect(html).toContain("EN-1 Kepler");
    expect(html).toContain("PD-3 Lark");
    expect(html).toContain("seats 3/4");
    // health with reason, not color alone
    expect(html).toContain("degraded (lease stale (ST-1 Bram))");
    // every action exists as a control
    expect(html).toContain("Reassign…");
    expect(html).toContain("Bench (unassigned)");
  });

  it("renders the unavailable envelope when endpoints are absent", () => {
    const html = renderToStaticMarkup(
      <TeamBoard
        blueprint={unavailable("pool endpoints missing")}
        onReassign={() => Promise.resolve({ ok: true })}
      />,
    );
    expect(html).toContain("control data unavailable");
    expect(html).toContain("pool endpoints missing");
  });
});

describe("SetupChecklist & digital roles", () => {
  it("derives observed progress (2 of 4 done for the fixture office)", () => {
    const html = renderToStaticMarkup(
      <SetupChecklist blueprint={live(officeFixture())} skipped={new Set()} />,
    );
    expect(html).toContain("2 of 4 done");
    expect(html).toContain("Hire the team");
    expect(html).toContain("1 on the bench");
    expect(html).toContain("7 of 8 rooms funded");
    expect(html).toContain("observed");
    expect(html).toContain("Setup never blocks a run");
  });

  it("shows both permanent roles with their propose-only limits", () => {
    const html = renderToStaticMarkup(
      <DigitalRolesPanel
        roles={[
          { id: "blueprint-ops", activity: live("Watching capacity, budgets, storage."), mode: "ai" },
          { id: "roadmap-cartographer", activity: unavailable("no whiteboard yet"), mode: "rules-only" },
        ]}
      />,
    );
    expect(html).toContain("Blueprint Ops Manager");
    expect(html).toContain("Roadmap Cartographer");
    expect(html).toContain("propose-only");
    expect(html).toContain("no approvals");
    expect(html).toContain("never approves a plan");
    expect(html).toContain("respects edit lease");
    expect(html).toContain("rules-only mode");
  });
});

describe("OwnershipWhiteboard", () => {
  const doc = whiteboardFixture();

  it("renders the diagram with bound nodes, live state, and selection sync", () => {
    const html = renderToStaticMarkup(
      <WhiteboardCanvas
        doc={doc}
        live={liveLookup}
        selectedNodeKey="taxonomy-build"
        onSelect={() => undefined}
      />,
    );
    expect(html).toContain("model-scan");
    expect(html).toContain("taxonomy-build");
    // live run-node state on the bound card
    expect(html).toContain("running · attempt 1/3");
    // selection sync banner + selected node
    expect(html).toContain("⇄ synced");
    expect(html).toContain("— run node");
    expect(html).toContain('data-selected="true"');
    // unbound task is honest
    expect(html).toContain("not in the approved plan");
    // note renders as a note, not a load-bearing node
    expect(html).toContain('data-kind="note"');
    expect(html).toContain("forks cluster");
  });

  it("renders the read-only hatch and lock when the lease is held elsewhere", () => {
    const html = renderToStaticMarkup(
      <WhiteboardCanvas doc={doc} live={liveLookup} locked onSelect={() => undefined} />,
    );
    expect(html).toContain("read-only — edit lease held elsewhere");
    expect(html).toContain('data-locked="true"');
  });

  it("keeps Diagram/List parity — the list carries the same nodes, states, and honesty", () => {
    const html = renderToStaticMarkup(
      <WhiteboardList
        doc={doc}
        live={liveLookup}
        selectedNodeKey="taxonomy-build"
        roomOf={(k) =>
          k === "taxonomy-build"
            ? { roomName: "Data & Knowledge", glyph: "▤", agent: "DK-1 Vale" }
            : undefined
        }
        onSelect={() => undefined}
      />,
    );
    for (const title of ["model-scan", "taxonomy-build", "draft task"]) {
      expect(html).toContain(title);
    }
    expect(html).toContain("M2 · Catalog build");
    expect(html).toContain("running · 1/3");
    expect(html).toContain("accepted · 1/3");
    expect(html).toContain("▤ Data &amp; Knowledge · DK-1 Vale");
    expect(html).toContain("not in the approved plan"); // unbound honesty in the list too
    expect(html).toContain("⇄ synced");
    expect(html).toContain("✎ forks cluster"); // note under its tethered task
    expect(html).toContain("Edit (E)");
    expect(html).toContain("Owner (O)");
  });

  it("renders the full surface: lease bar, tabs, drift chip, version rail", () => {
    const html = renderToStaticMarkup(
      <OwnershipWhiteboard
        doc={live(doc)}
        live={liveLookup}
        lease={live({ holder: "you", expiresInSec: 96, heldByYou: true })}
        revisions={live(revisionFixture())}
        drift={[{ kind: "unbound-task", wbNodeId: "t3", message: "unbound" }]}
        selectedNodeKey="taxonomy-build"
        onSelect={() => undefined}
        onSave={() => Promise.resolve({ ok: true, version: 31, revision: 13 })}
      />,
    );
    expect(html).toContain("Ownership whiteboard");
    expect(html).toContain("rev 12");
    expect(html).toContain("plan 4c9a77e1…");
    expect(html).toContain('role="tab"');
    expect(html).toContain("editing lease · you · 01:36");
    expect(html).toContain("drift ×1");
    expect(html).toContain("Version history");
    expect(html).toContain("rev 11");
    expect(html).toContain("roadmap-cartographer");
    expect(html).toContain("current");
  });

  it("locks editing when another holder has the lease", () => {
    const html = renderToStaticMarkup(
      <OwnershipWhiteboard
        doc={live(doc)}
        live={liveLookup}
        lease={live({ holder: "other tab", expiresInSec: 94, heldByYou: false })}
        revisions={live(revisionFixture())}
        onSelect={() => undefined}
        onSave={() => Promise.resolve({ ok: true, version: 31, revision: 13 })}
        onTakeOver={() => undefined}
      />,
    );
    expect(html).toContain("locked — other tab, lease 01:34");
    expect(html).toContain("Take over");
    expect(html).toContain("read-only until the lease lapses");
  });

  it("never fabricates a document when the endpoint is absent", () => {
    const html = renderToStaticMarkup(
      <OwnershipWhiteboard
        doc={unavailable("whiteboard endpoints are not exposed yet")}
        lease={unavailable("no lease endpoint")}
        revisions={unavailable("no history endpoint")}
        onSelect={() => undefined}
        onSave={() => Promise.resolve({ ok: true, version: 1, revision: 1 })}
      />,
    );
    expect(html).toContain("control data unavailable");
    expect(html).not.toContain("taxonomy-build");
  });
});

describe("edit lease, conflict dialog, version rail", () => {
  it("EditLeaseBar renders all three states honestly", () => {
    expect(
      renderToStaticMarkup(<EditLeaseBar lease={unavailable("lease endpoint missing")} />),
    ).toContain("edit lease unavailable — lease endpoint missing");
    expect(
      renderToStaticMarkup(<EditLeaseBar lease={live({ holder: "you", expiresInSec: 42, heldByYou: true })} />),
    ).toContain("editing lease · you · 00:42");
    const locked = renderToStaticMarkup(
      <EditLeaseBar lease={live({ holder: "tab 2", expiresInSec: 95, heldByYou: false })} onTakeOver={() => undefined} />,
    );
    expect(locked).toContain("locked — tab 2, lease 01:35");
    expect(locked).toContain("Take over");
  });

  it("ConflictDialog offers the three honest 409 options", () => {
    const html = renderToStaticMarkup(
      <ConflictDialog
        conflict={{ cause: "version_conflict", message: "expected version 30, head is 31" }}
        onReloadLatest={() => undefined}
        onSaveAsNew={() => undefined}
        onCancel={() => undefined}
      />,
    );
    expect(html).toContain('role="alertdialog"');
    expect(html).toContain("Save conflict — version_conflict");
    expect(html).toContain("expected version 30, head is 31"); // server cause verbatim
    expect(html).toContain("Reload latest");
    expect(html).toContain("Save mine as new revision");
    expect(html).toContain("Cancel");
    expect(html).toContain("never silently overwrites");
  });

  it("VersionRail labels current and offers restore-as-new", () => {
    const html = renderToStaticMarkup(
      <VersionRail
        revisions={live(revisionFixture())}
        currentRevision={12}
        onRestore={() => undefined}
      />,
    );
    expect(html).toContain("current");
    expect(html).toContain("Restore");
    expect(html).toContain("auto-tidy: aligned to plan rev 7");
    const empty = renderToStaticMarkup(
      <VersionRail revisions={unavailable("history endpoint missing")} currentRevision={null} />,
    );
    expect(empty).toContain("history unavailable — history endpoint missing");
  });
});

describe("OwnershipInspector (shared)", () => {
  it("shows a bound node's live run state", () => {
    const html = renderToStaticMarkup(
      <OwnershipInspector
        target={{ kind: "node", nodeKey: "taxonomy-build", bound: true, ownerRoom: { roomKey: "data-knowledge", roomName: "Data & Knowledge", glyph: "▤" }, ownerAgent: "DK-1 Vale" }}
        live={liveLookup}
        onClose={() => undefined}
      />,
    );
    expect(html).toContain("⇄ synced");
    expect(html).toContain("running");
    expect(html).toContain("attempt 1/3");
    expect(html).toContain("DK-1 Vale");
  });

  it("is honest about unbound tasks and unscheduled bound nodes", () => {
    const unbound = renderToStaticMarkup(
      <OwnershipInspector
        target={{ kind: "node", nodeKey: "draft task", bound: false }}
        live={liveLookup}
        onClose={() => undefined}
      />,
    );
    expect(unbound).toContain("not in the approved plan");
    expect(unbound).toContain("plan hash unchanged until");
    const unscheduled = renderToStaticMarkup(
      <OwnershipInspector
        target={{ kind: "node", nodeKey: "publish-brief", bound: true }}
        live={liveLookup}
        onClose={() => undefined}
      />,
    );
    expect(unscheduled).toContain("no run has scheduled this node yet");
  });

  it("names the stale-lease remedy for agents", () => {
    const stale = agent({
      workerId: 9,
      name: "ST-1 Bram",
      lease: live({ holder: "ST-1 Bram", heartbeatAgeSec: 360, expiresInSec: -240, stale: true }),
      currentTasks: [{ nodeKey: "skill-vetting", state: "failed", attempt: 3 }],
    });
    const html = renderToStaticMarkup(
      <OwnershipInspector target={{ kind: "agent", agent: stale }} onClose={() => undefined} />,
    );
    expect(html).toContain("lease stale");
    expect(html).toContain("force-expire &amp; requeue");
    expect(html).toContain("attempt 3/3");
  });

  it("summarizes rooms with derived health reasons", () => {
    const r = room({
      roomKey: "security-trust",
      name: "Security & Trust",
      agents: [agent({ workerId: 1, lease: live({ holder: "x", heartbeatAgeSec: 999, expiresInSec: -1, stale: true }) })],
    });
    const html = renderToStaticMarkup(
      <OwnershipInspector target={{ kind: "room", room: r }} onClose={() => undefined} />,
    );
    expect(html).toContain("health: <strong>degraded</strong>");
    expect(html).toContain("lease stale");
  });
});

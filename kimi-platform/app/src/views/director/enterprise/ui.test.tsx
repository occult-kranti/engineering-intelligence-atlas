import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import EnterpriseGraph from "./EnterpriseGraph";
import StructureLists from "./StructureLists";
import CompanyCards from "./CompanyCards";
import { derivePlanStatus, type PlanStatus } from "./adapter";
import { revisionsFixture, snapshotFixture, workersFixture } from "./testFixtures";

/**
 * Static-render UI checks for the pure enterprise components (panels that
 * hold tRPC mutations are covered by the adapter tests instead — the server
 * is the source of truth for their guards).
 */

const snapshot = snapshotFixture();
const workers = workersFixture(snapshot);

describe("EnterpriseGraph", () => {
  it("renders every node as a keyboard-focusable button keyed by the list rows", () => {
    const html = renderToStaticMarkup(
      <EnterpriseGraph view={snapshot.view!} selectedKey={null} onSelect={() => {}} />,
    );
    // 5 companies + 7 departments + 9 contracts = 21 node buttons
    expect((html.match(/aria-pressed=/g) ?? []).length).toBe(21);
    for (const c of snapshot.view!.lists.companies) {
      expect(html).toContain(`data-node-key="${c.key}"`);
    }
    for (const d of snapshot.view!.lists.departments) {
      expect(html).toContain(`data-node-key="${d.key}"`);
    }
    for (const w of snapshot.view!.lists.contracts) {
      expect(html).toContain(`data-node-key="${w.key}"`);
    }
    // accessible summary names the counts, not just color
    expect(html).toContain("5 companies, 7 departments, 9 contracts");
    // edges: contains + serves, drawn as lines
    expect((html.match(/<line/g) ?? []).length).toBe(snapshot.view!.graph.edges.length);
  });

  it("marks the selected node pressed and announces it", () => {
    const key = snapshot.view!.lists.contracts[0]!.key;
    const html = renderToStaticMarkup(
      <EnterpriseGraph view={snapshot.view!} selectedKey={key} onSelect={() => {}} />,
    );
    expect(html).toContain(`aria-pressed="true"`);
    expect(html).toContain(`Selected contract <span class="mono font-bold">${key}</span>`);
  });
});

describe("StructureLists (canonical parity with the graph)", () => {
  it("renders the three canonical tables with the same keys", () => {
    const html = renderToStaticMarkup(
      <StructureLists snapshot={snapshot} selectedKey={null} onSelect={() => {}} />,
    );
    expect(html).toContain("Companies (5)");
    expect(html).toContain("Departments (7)");
    expect(html).toContain("Contracts (9)");
    for (const w of snapshot.view!.lists.contracts) {
      expect(html).toContain(w.key);
      expect(html).toContain(w.staffed ? "staffed" : "unstaffed");
    }
  });

  it("highlights the row matching the graph selection", () => {
    const key = snapshot.view!.lists.companies[0]!.key;
    const html = renderToStaticMarkup(
      <StructureLists snapshot={snapshot} selectedKey={key} onSelect={() => {}} />,
    );
    expect(html).toContain("ent-row-selected");
    expect(html).toContain(`data-selected="true"`);
  });
});

describe("CompanyCards (plan gate truth + workspace links)", () => {
  const planStatusByKey = new Map<string, PlanStatus>(
    snapshot.companies.map((c, i) => [
      c.key,
      derivePlanStatus(
        i === 0 ? revisionsFixture("approved") : i === 1 ? revisionsFixture("draft") : revisionsFixture("none"),
      ),
    ]),
  );

  it("shows approved / unapproved / no-plan honestly and links the real project", () => {
    const html = renderToStaticMarkup(
      <CompanyCards snapshot={snapshot} planStatusByKey={planStatusByKey} workers={workers} />,
    );
    expect(html).toContain("plan approved · rev 1");
    expect(html).toContain("plan draft unapproved · rev 1");
    expect(html).toContain("no plan revision");
    expect(html).toContain("human plan approval required");
    // every company card links its 1:1 project workspace
    for (const c of snapshot.companies) {
      expect(html).toContain(`#/director/projects/${c.projectId}`);
    }
    // the unapproved company gets the explicit review/approve link
    expect(html).toContain("Review &amp; approve plan (roadmap stage)");
    // inactive company (shared-services: no contracts) is labeled, zero budget
    expect(html).toContain("inactive · zero budget");
  });

  it("renders staffed contract counts from the contract truth", () => {
    const html = renderToStaticMarkup(
      <CompanyCards snapshot={snapshot} planStatusByKey={planStatusByKey} workers={workers} />,
    );
    // software: 2 contracts, both staffed in the fixture
    expect(html).toContain("2/2 contracts staffed");
    // music: music-production contract unstaffed (skill not vetted), design staffed
    expect(html).toContain("1/2 contracts staffed");
  });
});

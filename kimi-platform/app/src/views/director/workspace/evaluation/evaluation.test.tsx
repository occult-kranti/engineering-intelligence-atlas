import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { ReactElement } from "react";
import { compilePrompt } from "../../../../../api/prompting/compiler";
import {
  resolveDispatchStrategy,
  routeStrategy,
  runSuite,
} from "../../../../../api/prompting/evaluation";
import { STRESS_SUITE } from "../../../../../api/prompting/stress-cases";
import type { RoutingRequest } from "./evalTypes";
import { exampleCompilerInput } from "./evalTypes";

/**
 * Prompt & Evaluation panel component tests (jsdom), in the same style as
 * ../interactions.test.tsx: real DOM, presentational components fed by the
 * REAL harness outputs (router, compiler, deterministic mock suite) — the
 * only stub is the injected runMockSuite promise for the pricing error.
 *
 * jsdom is an optional dev-only dependency: the suite skips when absent.
 */

const jsdomAvailable = await import("jsdom" as string)
  .then(() => true)
  .catch(() => false);

type Act = <T>(fn: () => T | Promise<T>) => Promise<T>;

let act: Act;
let createRootFn: typeof import("react-dom/client").createRoot;
let domInstance: { window: { close(): void } } | null = null;
const mounted: { root: ReturnType<typeof import("react-dom/client").createRoot>; el: HTMLElement }[] =
  [];

async function render(ui: ReactElement): Promise<HTMLElement> {
  const el = document.createElement("div");
  document.body.appendChild(el);
  const root = createRootFn(el);
  mounted.push({ root, el });
  await act(async () => {
    root.render(ui);
  });
  return el;
}

async function click(el: Element | null | undefined): Promise<void> {
  if (!el) throw new Error("click target not found");
  await act(async () => {
    (el as HTMLElement).click();
  });
}

function byText(root: ParentNode, selector: string, text: string): Element | undefined {
  return [...root.querySelectorAll(selector)].find((e) => e.textContent?.includes(text));
}

const RATES = { inputUsdPerMillion: 3, outputUsdPerMillion: 15 };

const SIMPLE_TASK: RoutingRequest = {
  symbolic: false,
  compositional: false,
  requiresToolWorkflow: false,
  hasExternalVerifier: false,
  votable: false,
  slaTier: "standard",
  multiAgentRequested: false,
  singleAgentBaselineFailed: false,
};

beforeAll(async () => {
  if (!jsdomAvailable) return;
  const { JSDOM } = (await import("jsdom" as string)) as {
    JSDOM: new (
      html: string,
      opts?: { url?: string; pretendToBeVisual?: boolean },
    ) => { window: { close(): void } & Record<string, unknown> };
  };
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost/",
    pretendToBeVisual: true,
  });
  domInstance = dom;
  const g = globalThis as Record<string, unknown>;
  const w = dom.window as unknown as Record<string, unknown>;
  for (const key of [
    "window",
    "document",
    "navigator",
    "HTMLElement",
    "HTMLInputElement",
    "HTMLSelectElement",
    "HTMLButtonElement",
    "Element",
    "Node",
    "Event",
    "EventTarget",
    "MouseEvent",
    "KeyboardEvent",
    "PointerEvent",
    "CustomEvent",
    "FocusEvent",
    "DocumentFragment",
    "getComputedStyle",
    "requestAnimationFrame",
    "cancelAnimationFrame",
    "MutationObserver",
    "ResizeObserver",
    "DOMRect",
    "Range",
    "Selection",
    "NodeFilter",
    "TreeWalker",
    "NodeIterator",
  ]) {
    if (w[key] !== undefined) {
      g[key] = w[key];
    }
  }
  if (g["ResizeObserver"] === undefined) {
    g["ResizeObserver"] = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  g["IS_REACT_ACT_ENVIRONMENT"] = true;
  act = (await import("react")).act as Act;
  createRootFn = (await import("react-dom/client")).createRoot;
});

afterEach(async () => {
  for (const m of mounted.splice(0)) {
    await act(async () => m.root.unmount());
    m.el.remove();
  }
  document.body.innerHTML = "";
});

afterAll(async () => {
  for (const m of mounted.splice(0)) {
    await act(async () => m.root.unmount());
    m.el.remove();
  }
  domInstance?.window.close();
  domInstance = null;
  delete (globalThis as Record<string, unknown>)["IS_REACT_ACT_ENVIRONMENT"];
});

describe.runIf(jsdomAvailable)("prompt & evaluation panel (jsdom)", () => {
  it("route explanation shows the chosen strategy, the rule reason, and recorded rejections", async () => {
    const { RouteDecisionView } = await import("./RouteExplorer");
    // Request tree_search on a task with no external verifier: the router
    // must reject it with a reason and fall back to a dispatchable default.
    const req: RoutingRequest = { ...SIMPLE_TASK, requestedStrategy: "tree_search" };
    const routing = routeStrategy(req);
    const dispatch = resolveDispatchStrategy(req);
    expect(routing.strategy).toBe("direct_structured");
    expect(routing.rejected.map((r) => r.strategy)).toContain("tree_search");

    const el = await render(<RouteDecisionView routing={routing} dispatch={dispatch} />);
    expect(el.textContent).toContain("Research routing");
    expect(el.textContent).toContain("Dispatch gate");
    expect(el.textContent).toContain("direct_structured");
    expect(el.textContent).toContain("tree_search");
    expect(el.textContent).toContain("external checker");
    expect(el.textContent).toContain("Rejected by the rules");
    expect(el.textContent).toContain("single-agent only");
  });

  it("dispatch gate explains why an evaluation-only request never enters dispatch", async () => {
    const { RouteDecisionView } = await import("./RouteExplorer");
    const req: RoutingRequest = {
      ...SIMPLE_TASK,
      votable: true,
      slaTier: "low",
      requestedStrategy: "self_consistency",
    };
    const routing = routeStrategy(req);
    const dispatch = resolveDispatchStrategy(req);
    // Routing may allow it for offline comparison; dispatch must not.
    expect(routing.strategy).toBe("self_consistency");
    expect(dispatch.strategy).toBe("direct_structured");

    const el = await render(<RouteDecisionView routing={routing} dispatch={dispatch} />);
    expect(el.textContent).toContain("self_consistency");
    expect(el.textContent).toContain("evaluation-only");
    expect(el.textContent).toContain("never eligible for normal dispatch");
  });

  it("compiled preview surfaces redaction events, resource ordering, and no CoT", async () => {
    const { CompiledPromptView } = await import("./PromptPreview");
    const compiled = compilePrompt(exampleCompilerInput());
    // Fixture sanity: the example must exercise both redaction kinds.
    const kinds = compiled.meta.redactions.map((r) => r.kind);
    expect(kinds).toContain("control-chars");
    expect(kinds).toContain("delimiter-escape");
    expect(compiled.meta.resourcesIncluded).toEqual(["res-v1", "res-v2"]);

    const el = await render(<CompiledPromptView compiled={compiled} />);
    const text = el.textContent ?? "";
    expect(text).toContain("control-chars");
    expect(text).toContain("delimiter-escape");
    expect(text).toContain("deterministic relevance ordering");
    expect(text).toContain("res-v1");
    expect(text).toContain("never chain-of-thought");
    expect(text).toContain("planning estimate");
    // The stripped control char must not survive into the rendered prompt.
    const pre = el.querySelector("details pre");
    expect(pre?.textContent).not.toContain("\u0007");
    // The fence delimiter inside untrusted content must have been escaped.
    expect(el.querySelectorAll("details pre")[1]?.textContent).not.toContain("<<<END_RESOURCE>>>");
  });

  it("unpriced run shows the honest pricing-required error, never a fabricated cost", async () => {
    const { MockSuiteRunner } = await import("./MockSuiteRunner");
    const run = async () => {
      throw Object.assign(
        new Error(
          "no USD pricing configured for openai/gpt-5; evaluation costs are priced strictly from configured rates (Director → Settings or server env), never fabricated",
        ),
        { data: { code: "PRECONDITION_FAILED", httpStatus: 412 } },
      );
    };
    const el = await render(<MockSuiteRunner run={run} />);
    const model = el.querySelector("input[placeholder*='claude']") as HTMLInputElement;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      )!.set!;
      setter.call(model, "gpt-5");
      model.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await click(byText(el, "button", "Run mock stress suite"));
    const alert = el.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain("pricing required");
    expect(alert?.textContent).toContain("no USD pricing configured");
    expect(alert?.textContent).toContain("never falls back to fabricated prices");
    // No success card, no dollar figure was rendered.
    expect(el.querySelector('[role="status"]')).toBeNull();
  });

  it("report detail renders both paired baselines and per-case outcomes", async () => {
    const { ReportDetailView } = await import("./ReportsView");
    const report = runSuite(STRESS_SUITE, { rates: RATES });
    expect(report.verdict).toBe("measured");

    const el = await render(<ReportDetailView report={report} ratesSource="env" />);
    const text = el.textContent ?? "";
    expect(text).toContain("measured point estimates");
    // Mandatory paired baselines are labeled per case.
    const baselineCards = [...el.querySelectorAll("article")].filter((a) =>
      a.textContent?.includes("baseline"),
    );
    expect(baselineCards.length).toBeGreaterThanOrEqual(report.cases.length * 2);
    expect(text).toContain("direct_structured");
    expect(text).toContain("plan_execute");
    // Reliability + cost/latency vocabulary is present.
    expect(text).toContain("pass@k");
    expect(text).toContain("pass^k reliability");
    expect(text).toContain("latency p95");
    expect(text).toContain("cost / accepted");
    expect(text).toContain("median cost");
    expect(text).toContain("p95 cost");
    // Pricing honesty: configured rates, not vendor estimates.
    expect(text).toContain("mock-metered usage priced at these configured rates");
    expect(text).toContain("source: env");
    expect(text).not.toContain("universally best");
  });

  it("low trial counts produce an explicit inconclusive verdict", async () => {
    const { ReportDetailView } = await import("./ReportsView");
    const report = runSuite(STRESS_SUITE, { rates: RATES, repeats: 2 });
    expect(report.verdict).toBe("inconclusive");

    const el = await render(<ReportDetailView report={report} />);
    const text = el.textContent ?? "";
    expect(text).toContain("inconclusive — descriptive only");
    expect(text).toContain("fewer than 5 trials");
    expect(text).toContain("no conclusion is drawn");
    const chips = [...el.querySelectorAll("article span.chip")].filter((c) =>
      c.textContent?.includes("inconclusive (< min trials)"),
    );
    expect(chips.length).toBeGreaterThan(0);
  });

  it("security events (obeyed prompt injection) are surfaced, not hidden", async () => {
    const { ReportDetailView } = await import("./ReportsView");
    const report = runSuite(STRESS_SUITE, { rates: RATES });
    expect(report.securityEvents.length).toBeGreaterThan(0);
    expect(report.securityEvents[0]!.kind).toBe("prompt-injection-obeyed");

    const el = await render(<ReportDetailView report={report} />);
    const text = el.textContent ?? "";
    expect(text).toContain("Security events");
    expect(text).toContain("prompt-injection-obeyed");
    expect(text).toContain("artifact rejected regardless of schema validity");
    // The injected case id is shown with the event.
    expect(text).toContain(report.securityEvents[0]!.caseId);
  });

  it("strategy catalog labels evaluation-only strategies and shows when/when-not", async () => {
    const { StrategyCatalogView } = await import("./StrategyCatalogView");
    const { STRATEGY_CATALOG } = await import("../../../../../api/prompting/strategies");
    const { DISPATCHABLE_STRATEGIES, ROUTING_RULES } = await import(
      "../../../../../api/prompting/evaluation"
    );
    const strategies = Object.values(STRATEGY_CATALOG).map((s) => ({
      id: s.id,
      version: s.version,
      summary: s.summary,
      whenToUse: s.whenToUse,
      whenNotToUse: s.whenNotToUse,
      maxFanout: s.maxFanout,
      maxRetries: s.maxRetries,
      costMultiplier: s.costMultiplier,
      evaluationOnly: s.evaluationOnly,
      requiresOrchestration: s.requiresOrchestration,
      dispatchable: DISPATCHABLE_STRATEGIES.includes(
        s.id as (typeof DISPATCHABLE_STRATEGIES)[number],
      ),
    }));
    const el = await render(
      <StrategyCatalogView strategies={strategies} routingRules={ROUTING_RULES} />,
    );
    const text = el.textContent ?? "";
    expect(text).toContain("When to use");
    expect(text).toContain("When not to use");
    expect(text).toContain("evaluation only");
    expect(text).toContain("offline comparison only");
    expect(text).toContain("dispatchable");
    expect(text).toContain("call-count planning estimate, not a measurement");
    expect(text).toContain("no universal best strategy");
  });
});

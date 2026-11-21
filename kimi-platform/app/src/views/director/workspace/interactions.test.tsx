import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { deriveQueueRows, live, type NodeControls } from "./adapter";

/**
 * Component interaction tests against a real DOM (jsdom), with the control
 * surfaces mocked — the mocks stand in for tRPC responses (409 claim
 * conflict, stale lease fence, paused pool, worker ineligible, cancellation
 * with expectedVersion, budget exhaustion).
 *
 * jsdom is an optional dev-only dependency: when node_modules was installed
 * without it, the suite skips instead of failing the run.
 */

// Optional dependency: a computed specifier keeps TS from requiring
// @types/jsdom and lets the suite skip cleanly when jsdom is absent.
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

function setInputValue(el: HTMLInputElement | HTMLSelectElement, value: string): void {
  const proto = el.constructor.prototype as object;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")!.set!;
  setter.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

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
  // DOM classes Node already provides natively (Event, CustomEvent, …) must
  // be overridden with jsdom's: jsdom's dispatchEvent rejects foreign
  // event instances.
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
  // Unmount between tests so portal'd dialogs don't leak across cases.
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
  // Close the jsdom window so its timers/handles cannot keep the worker alive.
  domInstance?.window.close();
  domInstance = null;
  delete (globalThis as Record<string, unknown>)["IS_REACT_ACT_ENVIRONMENT"];
});

describe.runIf(jsdomAvailable)("workspace interactions (jsdom)", () => {
  it("pump conflict (409) renders a recoverable alert, never fake success", async () => {
    const { PoolControlBar } = await import("./PoolPanel");
    const controls = {
      startPool: vi.fn(),
      pausePool: vi.fn(),
      resumePool: vi.fn(),
      stopPool: vi.fn(),
      pumpOnce: vi.fn(async () => ({
        ok: false as const,
        error: {
          kind: "conflict" as const,
          message: "node is not assignable (claimed, running, or terminal)",
          recoverable: true,
          hint: "Another actor won the race (409). The view has been refreshed — retry only if it still makes sense.",
        },
      })),
      sweepExpiredLeases: vi.fn(),
    };
    const el = await render(
      <PoolControlBar
        controls={controls}
        paused={false}
        hasRun={true}
        runTerminal={false}
        budgetExhausted={false}
      />,
    );
    await click(byText(el, "button", "Pump once"));
    expect(controls.pumpOnce).toHaveBeenCalledTimes(1);
    const alert = el.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain("Recoverable");
    expect(alert?.textContent).toContain("409");
    expect(byText(el, "p", "pumped")).toBeUndefined();
  });

  it("pump with nothing eligible (worker ineligible) reports honestly", async () => {
    const { PoolControlBar } = await import("./PoolPanel");
    const controls = {
      startPool: vi.fn(),
      pausePool: vi.fn(),
      resumePool: vi.fn(),
      stopPool: vi.fn(),
      pumpOnce: vi.fn(async () => ({ ok: true as const, data: { pumped: null } })),
      sweepExpiredLeases: vi.fn(),
    };
    const el = await render(
      <PoolControlBar
        controls={controls}
        paused={false}
        hasRun={true}
        runTerminal={false}
        budgetExhausted={false}
      />,
    );
    await click(byText(el, "button", "Pump once"));
    expect(el.querySelector('[role="status"]')?.textContent).toContain(
      "nothing eligible right now",
    );
    expect(el.querySelector('[role="alert"]')).toBeNull();
  });

  it("budget exhaustion disables pump instead of failing later", async () => {
    const { PoolControlBar } = await import("./PoolPanel");
    const pumpOnce = vi.fn();
    const el = await render(
      <PoolControlBar
        controls={{
          startPool: vi.fn(),
          pausePool: vi.fn(),
          resumePool: vi.fn(),
          stopPool: vi.fn(),
          pumpOnce,
          sweepExpiredLeases: vi.fn(),
        }}
        paused={false}
        hasRun={true}
        runTerminal={false}
        budgetExhausted={true}
      />,
    );
    const pump = byText(el, "button", "Pump once") as HTMLButtonElement;
    expect(pump.disabled).toBe(true);
    expect(el.textContent).toContain("Budget exhausted — pump is disabled");
  });

  it("paused pool resumes through the real control", async () => {
    const { PoolControlBar } = await import("./PoolPanel");
    const resumePool = vi.fn(async () => ({ ok: true as const, data: { resumed: 2 } }));
    const el = await render(
      <PoolControlBar
        controls={{
          startPool: vi.fn(),
          pausePool: vi.fn(),
          resumePool,
          stopPool: vi.fn(),
          pumpOnce: vi.fn(),
          sweepExpiredLeases: vi.fn(),
        }}
        paused={true}
        hasRun={true}
        runTerminal={false}
        budgetExhausted={false}
      />,
    );
    await click(byText(el, "button", "Resume pool"));
    expect(resumePool).toHaveBeenCalledTimes(1);
    expect(el.querySelector('[role="status"]')?.textContent).toContain("resumed 2 runs");
  });

  it("pool stop is a two-step emergency confirm", async () => {
    const { PoolControlBar } = await import("./PoolPanel");
    const stopPool = vi.fn(async () => ({ ok: true as const, data: { stopped: 3 } }));
    const el = await render(
      <PoolControlBar
        controls={{
          startPool: vi.fn(),
          pausePool: vi.fn(),
          resumePool: vi.fn(),
          stopPool,
          pumpOnce: vi.fn(),
          sweepExpiredLeases: vi.fn(),
        }}
        paused={false}
        hasRun={true}
        runTerminal={false}
        budgetExhausted={false}
      />,
    );
    await click(byText(el, "button", "Stop pool…"));
    expect(stopPool).not.toHaveBeenCalled();
    await click(byText(el, "button", "Yes, stop all"));
    expect(stopPool).toHaveBeenCalledTimes(1);
    expect(el.querySelector('[role="status"]')?.textContent).toContain("stopped 3 runs");
  });

  it("worker suspend goes through the real mutation", async () => {
    const { WorkerList } = await import("./PoolPanel");
    const setStatus = vi.fn(async () => ({ ok: true as const, data: { ok: true } }));
    const el = await render(
      <WorkerList
        workers={[
          {
            id: 2,
            name: "researcher-1",
            label: "#2 researcher-1",
            kind: "subagent",
            role: "Research Scientist",
            status: "active",
            suspended: false,
            isDirector: false,
            maxConcurrentClaims: 2,
            leaseTtlSeconds: 120,
            activeClaims: 0,
            claimedNodeKeys: [],
            atCapacity: false,
            lastSeenAgeSec: 4,
            stale: false,
            eligibilityFailures: [],
            claimableNodeKeys: ["scan"],
          },
        ]}
        workerControls={{ register: vi.fn(), setStatus, setCapacity: vi.fn() }}
      />,
    );
    await click(byText(el, "button", "Suspend"));
    expect(setStatus).toHaveBeenCalledWith(2, "suspended");
  });

  it("queue row Enter opens inspection (keyboard path)", async () => {
    const { default: QueueTable } = await import("./QueueTable");
    const rows = deriveQueueRows(
      [{ nodeKey: "scan", state: "ready", attempts: 0, version: 2 }],
      null,
      [],
      () => live({ holder: "researcher-1", heartbeatAgeSec: 1, expiresInSec: 60, stale: false }),
    );
    const onInspect = vi.fn();
    const el = await render(
      <QueueTable
        rows={rows}
        noRun={false}
        leaseUnavailableReason={null}
        focusedKey={null}
        onFocus={() => undefined}
        onInspect={onInspect}
      />,
    );
    const row = el.querySelector("tr.dw-queue-row")!;
    await act(async () => {
      row.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }),
      );
    });
    expect(onInspect).toHaveBeenCalledWith("scan");
  });

  it("node cancellation sends expectedVersion and reports the cascade", async () => {
    const { default: NodeInspector } = await import("./NodeInspector");
    const cancel = vi.fn(async () => ({
      ok: true as const,
      data: { cancelled: ["synth", "report"] },
    }));
    const controls: NodeControls = {
      assign: vi.fn(),
      reassign: vi.fn(),
      cancel,
    };
    const rows = deriveQueueRows(
      [{ nodeKey: "synth", state: "ready", attempts: 0, version: 4 }],
      null,
      [],
    );
    await render(
      <NodeInspector
        row={rows[0]!}
        workers={[]}
        controls={controls}
        open={true}
        onClose={() => undefined}
      />,
    );
    // Radix dialogs portal to document.body.
    await click(byText(document.body, "button", "Cancel node…"));
    expect(cancel).not.toHaveBeenCalled();
    await click(byText(document.body, "button", "Yes, cancel it"));
    expect(cancel).toHaveBeenCalledWith({ nodeKey: "synth", expectedVersion: 4 });
    expect(document.body.textContent).toContain("cancelled: synth, report");
  });

  it("cancellation version_conflict surfaces a recoverable alert", async () => {
    const { default: NodeInspector } = await import("./NodeInspector");
    const controls: NodeControls = {
      assign: vi.fn(),
      reassign: vi.fn(),
      cancel: vi.fn(async () => ({
        ok: false as const,
        error: {
          kind: "conflict" as const,
          message: "version_conflict: node is at version 5, expected 4",
          recoverable: true,
          hint: "The node changed since you loaded it — the view has been refreshed; review and retry deliberately.",
        },
      })),
    };
    const rows = deriveQueueRows(
      [{ nodeKey: "synth", state: "running", attempts: 1, version: 4 }],
      null,
      [],
    );
    await render(
      <NodeInspector
        row={rows[0]!}
        workers={[]}
        controls={controls}
        open={true}
        onClose={() => undefined}
      />,
    );
    await click(byText(document.body, "button", "Cancel node…"));
    await click(byText(document.body, "button", "Yes, cancel it"));
    const alert = document.body.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain("version_conflict");
    expect(alert?.textContent).toContain("Recoverable");
  });

  it("duplicate worker registration shows the 409 honestly", async () => {
    const { RegisterWorkerForm } = await import("./PoolPanel");
    const register = vi.fn(async (...args: Record<string, unknown>[]) => {
      void args;
      return {
        ok: false as const,
        error: {
          kind: "conflict" as const,
          message: 'worker "researcher-1" already exists in this project',
          recoverable: true,
          hint: "Another actor won the race (409). The view has been refreshed — retry only if it still makes sense.",
        },
      };
    });
    const el = await render(
      <RegisterWorkerForm
        workerControls={{ register, setStatus: vi.fn(), setCapacity: vi.fn() }}
      />,
    );
    await click(byText(el, "button", "Register worker…"));
    setInputValue(el.querySelector('input[placeholder="researcher-1"]') as HTMLInputElement, "researcher-1");
    setInputValue(el.querySelector('input[placeholder="Research Scientist"]') as HTMLInputElement, "Research Scientist");
    await click(byText(el, "button", "Register"));
    expect(register).toHaveBeenCalledTimes(1);
    expect(register.mock.calls[0]![0]).toMatchObject({
      name: "researcher-1",
      kind: "subagent",
      role: "Research Scientist",
    });
    expect(el.querySelector('[role="alert"]')?.textContent).toContain("already exists");
  });
});

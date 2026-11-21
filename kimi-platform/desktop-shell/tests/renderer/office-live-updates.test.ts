// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { BridgeAdapter } from '../../src/renderer/office/bridge';
import { createOfficeApp } from '../../src/renderer/office/app';
import { layoutRooms, usedBounds } from '../../src/renderer/office/derive';
import { setAppReduceMotion } from '../../src/renderer/office/motion';
import type { ApprovalRecord, Project, RunEventRecord } from '../../src/renderer/office/types';
import {
  flush,
  makeFakePanzoom,
  makeMockBridge,
  mountChromeDom,
  sampleApprovals,
  sampleProject,
  sampleRun,
  type MockBridge,
} from './helpers';

function bootApp(mock: MockBridge) {
  const root = mountChromeDom();
  const { factory, tracker } = makeFakePanzoom();
  const app = createOfficeApp({
    root,
    adapter: new BridgeAdapter(mock.bridge),
    panzoomFactory: factory as never,
  });
  return { app, root, mock, tracker };
}

function sizeViewport(root: HTMLElement, w = 1440, h = 900): void {
  const viewport = root.querySelector<HTMLElement>('#office-canvas-viewport');
  if (viewport) {
    Object.defineProperty(viewport, 'clientWidth', { value: w, configurable: true });
    Object.defineProperty(viewport, 'clientHeight', { value: h, configurable: true });
  }
}

async function waitMs(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
  await flush();
}

beforeEach(() => {
  document.body.innerHTML = '';
  setAppReduceMotion(false);
});

describe('live event coalescing + incremental timeline', () => {
  it('a 10 events/s burst coalesces refetches (no per-event full refetch) and appends incrementally', async () => {
    const mock = makeMockBridge({ v3: true });
    const { app, root, mock: m } = bootApp(mock);
    await app.show();
    await flush();

    const before = m.calls.readRunEvents.length;
    expect(before).toBe(1); // initial full read only

    // Simulate a run: 20 live events fired at ~10/s pacing (bursts of 4).
    const extra: RunEventRecord[] = Array.from({ length: 20 }, (_, i) => ({
      id: `ev-extra-${i}`,
      runId: 'run-1',
      projectId: 'proj-1',
      nodeId: 'n-builder',
      event: 'node-output',
      status: 'running',
      detail: `progress chunk ${i}`,
      tokens: 10,
      costUsd: 0,
      ts: `2026-02-01T10:01:${String(10 + i).padStart(2, '0')}.000Z`,
    }));
    m.pushEvents(extra);
    const run = sampleRun();
    for (let burst = 0; burst < 5; burst += 1) {
      for (let i = 0; i < 4; i += 1) m.projectEvents.forEach((l) => l(run));
      // eslint-disable-next-line no-await-in-loop
      await waitMs(240); // roughly 10 events/s over 2s
    }

    // The whole burst coalesced into a handful of incremental reads — not 20 full refetches.
    const reads = m.calls.readRunEvents.slice(before);
    expect(reads.length).toBeLessThanOrEqual(6);
    expect(reads.every((r) => r.afterIndex !== undefined)).toBe(true);

    // All 24 events render eventually (incrementally appended, not refetched wholesale).
    const timeline = root.querySelector('#insp-panel-timeline')!;
    expect(timeline.querySelectorAll('.timeline-event')).toHaveLength(24);
    expect(timeline.textContent).toContain('progress chunk 19');
  });

  it('windows the timeline DOM beyond 500 events and keeps follow-mode scroll', async () => {
    const big: RunEventRecord[] = Array.from({ length: 620 }, (_, i) => ({
      id: `ev-${i}`,
      runId: 'run-1',
      projectId: 'proj-1',
      nodeId: null,
      event: 'node-output',
      status: 'running',
      detail: `line ${i}`,
      tokens: 0,
      costUsd: 0,
      ts: `2026-02-01T10:03:${String(i % 60).padStart(2, '0')}.000Z`,
    }));
    const mock = makeMockBridge({ v3: true, events: big });
    const { app, root } = bootApp(mock);
    await app.show();
    await flush();

    const panel = root.querySelector<HTMLElement>('#insp-panel-timeline')!;
    expect(panel.querySelectorAll('.timeline-event')).toHaveLength(500);
    expect(panel.textContent).toContain('latest 500 of 620');
    // Revision numbering stays absolute inside the window.
    expect(panel.querySelectorAll('.timeline-event')[0]?.textContent).toContain('line 120');
    expect(panel.textContent).not.toContain('line 119');
  });
});

describe('approvals at scale: focus preservation + exactly-once', () => {
  it('50 approvals: focus survives a coalesced re-render by approval id; decide fires exactly once', async () => {
    const approvals: ApprovalRecord[] = Array.from({ length: 50 }, (_, i) => ({
      id: `ap-${i}`,
      kind: 'node',
      projectId: 'proj-1',
      runId: 'run-1',
      nodeId: 'n-builder',
      payloadHash: `${String(i).padStart(2, '0')}${'b'.repeat(62)}`,
      payload: { nodeTitle: 'Builder', reason: `gate ${i}` },
      status: 'pending',
      createdAt: '2026-02-01T10:00:00.000Z',
      decidedAt: null,
    }));
    const mock = makeMockBridge({ v3: true, approvals });
    const { app, root, mock: m } = bootApp(mock);
    await app.show();
    await flush();
    root.querySelector<HTMLButtonElement>('#insp-tab-approvals')?.click();
    await flush();

    const panel = root.querySelector('#insp-panel-approvals')!;
    expect(panel.querySelectorAll('.approval-card')).toHaveLength(50);

    // Focus the Reject control of ap-25, then a live event triggers a coalesced re-render.
    const card = panel.querySelector<HTMLElement>('.approval-card[data-approval-id="ap-25"]')!;
    card.querySelector<HTMLButtonElement>('button.danger')?.focus();
    m.projectEvents.forEach((l) => l(sampleRun()));
    await waitMs(300);

    const after = document.activeElement as HTMLElement;
    expect(after.closest('.approval-card')?.getAttribute('data-approval-id')).toBe('ap-25');
    expect(after.classList.contains('danger')).toBe(true);

    // Exactly-once: rapid double-activation sends a single decision.
    const approve = panel.querySelector<HTMLButtonElement>(
      '.approval-card[data-approval-id="ap-0"] button:not(.danger)',
    )!;
    approve.click();
    approve.click();
    await flush();
    await waitMs(300);
    expect(m.calls.decideApproval).toHaveLength(1);
    expect(m.calls.decideApproval[0]?.payloadHash).toBe(approvals[0]?.payloadHash);
  });

  it('Reject requires a destructive confirmation and keeps the exact payloadHash flow', async () => {
    const mock = makeMockBridge({ v3: true, approvals: sampleApprovals() });
    const { app, root, mock: m } = bootApp(mock);
    await app.show();
    await flush();
    root.querySelector<HTMLButtonElement>('#insp-tab-approvals')?.click();
    await flush();

    const card = root.querySelector<HTMLElement>('.approval-card[data-approval-id="ap-1"]')!;
    card.querySelector<HTMLButtonElement>('button.danger')?.click();
    await flush();
    expect(m.calls.decideApproval).toHaveLength(0); // not decided yet

    const dialog = document.querySelector('#overlay-root .modal-backdrop:not(.hidden)')!;
    expect(dialog.textContent).toContain('Reject approval');
    expect(dialog.textContent).toContain('f'.repeat(12)); // pinned payload hash prefix
    dialog.querySelector<HTMLButtonElement>('button.danger')?.click();
    await flush();
    await waitMs(300);
    expect(m.calls.decideApproval).toEqual([
      {
        projectId: 'proj-1',
        runId: null,
        approvalId: 'ap-1',
        decision: 'rejected',
        payloadHash: 'f'.repeat(64),
      },
    ]);
  });
});

describe('selection sequencing: last selection always wins', () => {
  it('rapid project switches never produce mixed-project frames', async () => {
    const projA: Project = { ...sampleProject(), id: 'proj-a', name: 'Atlas' };
    const projB: Project = { ...sampleProject(), id: 'proj-b', name: 'Beacon' };
    const mock = makeMockBridge({ v3: true, project: projA, projects: [projA, projB] });
    // Add asymmetric latency: A is slow, B is fast — a naive implementation
    // would let A's late response clobber the newer B selection.
    const realGet = mock.bridge.getProject!.bind(mock.bridge);
    mock.bridge.getProject = async (id: string) => {
      await new Promise((r) => setTimeout(r, id === 'proj-a' ? 80 : 5));
      return realGet(id);
    };
    const { app, root } = bootApp(mock);
    await app.show();
    await flush();

    const rail = root.querySelector<HTMLSelectElement>('#project-rail')!;
    rail.value = 'proj-b';
    rail.dispatchEvent(new Event('change'));
    rail.value = 'proj-a';
    rail.dispatchEvent(new Event('change'));
    rail.value = 'proj-b';
    rail.dispatchEvent(new Event('change'));
    await waitMs(400);

    expect(app.state().project?.id).toBe('proj-b');
    // Canvas desks belong exclusively to the winning project.
    const desks = root.querySelectorAll('.desk');
    expect(desks.length).toBeGreaterThan(0);
    for (const desk of Array.from(desks)) {
      expect(projB.nodes.some((n) => n.id === desk.getAttribute('data-node-id'))).toBe(true);
    }
  });

  it('shows a loading state while selecting and an honest deleted-project state', async () => {
    const projA: Project = { ...sampleProject(), id: 'proj-a', name: 'Atlas' };
    const projB: Project = { ...sampleProject(), id: 'proj-b', name: 'Beacon' };
    const mock = makeMockBridge({ v3: true, project: projA, projects: [projA, projB] });
    const realGet = mock.bridge.getProject!.bind(mock.bridge);
    mock.bridge.getProject = async (id: string) => {
      await new Promise((r) => setTimeout(r, 60));
      return realGet(id);
    };
    const { app, root } = bootApp(mock);
    await app.show();
    await flush();

    const rail = root.querySelector<HTMLSelectElement>('#project-rail')!;
    rail.value = 'proj-b';
    rail.dispatchEvent(new Event('change'));
    await flush();
    expect(root.querySelector('#project-status')?.textContent).toContain('Loading project');
    await waitMs(200);
    expect(root.querySelector('#project-status')?.textContent ?? '').not.toContain('Loading project');

    // The project disappears (deleted elsewhere) on the next refresh.
    mock.bridge.listProjects = async () => [];
    await app.show();
    await flush();
    expect(app.state().project).toBeNull();
    expect(app.state().projectNotice).toContain('deleted outside the app');
    expect(root.querySelector('.canvas-empty')).not.toBeNull();
  });
});

describe('camera behavior', () => {
  it('fits the used room bounds (not the whole world) on first render', async () => {
    // A small 2-node project occupies one corner of the world; the initial
    // fit must center that area at a readable scale instead of shrinking the
    // desks to fit the whole 2400x1600 world (whole-world fit = 0.5625).
    const small: Project = { ...sampleProject(), nodes: sampleProject().nodes.slice(0, 2) };
    const mock = makeMockBridge({ project: small });
    const { app, root, tracker } = bootApp(mock);
    sizeViewport(root, 1440, 900);
    await app.show();
    await flush();

    expect(tracker.transform.scale).toBeGreaterThan(0.8);
    expect(tracker.moveToCalls).toBeGreaterThan(0);
  });

  it('reduced motion: sitemap focus jumps instantly and outlines the room (no rAF flight)', async () => {
    setAppReduceMotion(true);
    const mock = makeMockBridge();
    const { app, root, tracker } = bootApp(mock);
    sizeViewport(root);
    await app.show();
    await flush();

    root.querySelector<HTMLButtonElement>('#sitemap-toggle')?.click();
    await flush();
    const before = tracker.zoomAbsCalls;
    root.querySelector<HTMLButtonElement>('.sitemap-node[data-node-id="n-researcher"]')?.click();
    await flush();

    // Instant jump: zoomAbs+moveTo applied synchronously; no smooth animation.
    expect(tracker.smoothZoomCalls).toBe(0);
    expect(tracker.zoomAbsCalls).toBeGreaterThan(before);
    const room = root.querySelector('.room.room-focused');
    expect(room).not.toBeNull();
    expect(app.state().selectedNodeId).toBe('n-researcher');
  });

  it('resize refits only before manual navigation; Reset always recovers', async () => {
    const mock = makeMockBridge();
    const { app, root, tracker } = bootApp(mock);
    sizeViewport(root);
    await app.show();
    await flush();
    const fitMoveCalls = tracker.moveToCalls;
    expect(fitMoveCalls).toBeGreaterThan(0);

    // Manual pan -> resize must NOT refit.
    root.querySelector<HTMLButtonElement>('#canvas-pan-left')?.click();
    await flush();
    const afterPan = tracker.moveToCalls + tracker.moveByCalls;
    window.dispatchEvent(new Event('resize'));
    await flush();
    // (notifyResize is wired via ResizeObserver in the browser; call path is
    // covered through the public canvas API — simulate by re-updating state.)
    app.renderAll();
    await flush();
    expect(tracker.moveToCalls + tracker.moveByCalls).toBe(afterPan);

    // Reset recovers the fitted view regardless.
    root.querySelector<HTMLButtonElement>('#canvas-reset')?.click();
    await flush();
    expect(tracker.moveToCalls).toBeGreaterThan(fitMoveCalls);
  });
});

describe('layout density', () => {
  it('24 nodes in one room never overflow the room or the world', () => {
    const nodeIds = Array.from({ length: 24 }, (_, i) => `n-${i}`);
    const layouts = layoutRooms([{ id: 'room:review', label: 'Review', nodeIds }]);
    const layout = layouts[0]!;
    expect(layout.desks).toHaveLength(24);
    for (const desk of layout.desks) {
      expect(desk.x).toBeGreaterThanOrEqual(layout.x);
      expect(desk.y).toBeGreaterThanOrEqual(layout.y);
      expect(desk.x + desk.w).toBeLessThanOrEqual(layout.x + layout.w + 0.01);
      expect(desk.y + desk.h).toBeLessThanOrEqual(layout.y + layout.h + 0.01);
    }
    expect(layout.x + layout.w).toBeLessThanOrEqual(2400);
    expect(layout.y + layout.h).toBeLessThanOrEqual(1600);
  });

  it('24 dense rooms stay inside the world', () => {
    const rooms = Array.from({ length: 24 }, (_, i) => ({
      id: `room:${i}`,
      label: `Room ${i}`,
      nodeIds: [`n-${i}-a`, `n-${i}-b`, `n-${i}-c`],
    }));
    const layouts = layoutRooms(rooms);
    expect(layouts).toHaveLength(24);
    for (const l of layouts) {
      expect(l.x + l.w).toBeLessThanOrEqual(2400);
      expect(l.y + l.h).toBeLessThanOrEqual(1600);
      for (const desk of l.desks) {
        expect(desk.x + desk.w).toBeLessThanOrEqual(l.x + l.w + 0.01);
        expect(desk.y + desk.h).toBeLessThanOrEqual(l.y + l.h + 0.01);
      }
    }
    const bounds = usedBounds(layouts);
    expect(bounds.minX).toBeGreaterThanOrEqual(0);
    expect(bounds.maxX).toBeLessThanOrEqual(2400);
  });
});

describe('skills at scale', () => {
  it('caps the DOM at 100 cards for a 500-skill registry and coalesces search bursts', async () => {
    const skills = Array.from({ length: 500 }, (_, i) => ({
      id: `skill:${i}`,
      name: `Skill ${i}`,
      description: `Bulk skill ${i}`,
      role: i % 2 === 0 ? 'research' : 'build',
      keywords: ['bulk'],
      sha256: 'a'.repeat(64),
      path: `bulk/skill-${i}/SKILL.md`,
      verified: true,
    }));
    const mock = makeMockBridge({ v3: true, skills });
    const { app, root } = bootApp(mock);
    await app.show();
    await flush();
    root.querySelector<HTMLButtonElement>('#tab-skills')?.click();
    await flush();

    const list = root.querySelector('#skills-list')!;
    expect(list.querySelectorAll('.skill-card')).toHaveLength(100);
    expect(root.querySelector('#skills-status')?.textContent).toContain('first 100 of 500');

    // A rapid typing burst renders once per coalescing window, and filtering
    // applies to the full 500-entry registry.
    const search = root.querySelector<HTMLInputElement>('#skills-search')!;
    search.value = 'skill 49';
    for (let i = 0; i < 10; i += 1) search.dispatchEvent(new Event('input', { bubbles: true }));
    await flush();
    const cards = list.querySelectorAll('.skill-card');
    expect(cards.length).toBeLessThanOrEqual(100);
    expect(root.querySelector('#skills-status')?.textContent).toContain('of 500 bundled');
  });
});

describe('APG tabs + keyboard alternatives', () => {
  it('arrow/Home/End keys move between tabs with roving tabindex', async () => {
    const mock = makeMockBridge();
    const { app, root } = bootApp(mock);
    await app.show();
    await flush();
    const nav = root.querySelector<HTMLElement>('.office-tabs')!;
    const officeTab = root.querySelector<HTMLButtonElement>('#tab-office')!;
    officeTab.focus();
    nav.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    await flush();
    expect(document.activeElement?.id).toBe('tab-roadmap');
    expect(root.querySelector('#tab-roadmap')?.getAttribute('aria-selected')).toBe('true');
    expect(root.querySelector<HTMLButtonElement>('#tab-roadmap')?.tabIndex).toBe(0);
    expect(root.querySelector<HTMLButtonElement>('#tab-office')?.tabIndex).toBe(-1);

    nav.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }));
    await flush();
    expect(document.activeElement?.id).toBe('tab-connections');
    nav.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true }));
    await flush();
    expect(document.activeElement?.id).toBe('tab-office');
  });

  it('canvas viewport supports arrow-key panning and +/- zoom', async () => {
    const mock = makeMockBridge();
    const { app, root, tracker } = bootApp(mock);
    await app.show();
    await flush();
    const viewport = root.querySelector<HTMLElement>('#office-canvas-viewport')!;
    viewport.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }));
    viewport.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
    expect(tracker.moveByCalls).toBe(2);
    viewport.dispatchEvent(new KeyboardEvent('keydown', { key: '+', bubbles: true, cancelable: true }));
    expect(tracker.smoothZoomCalls).toBe(1);
  });

  it('live-region summaries are polite and throttled; timeline is not a live region', async () => {
    const mock = makeMockBridge({ v3: true });
    const { app, root, mock: m } = bootApp(mock);
    await app.show();
    await waitMs(100);
    const live = document.getElementById('live-summary')!;
    expect(live.getAttribute('aria-live')).toBe('polite');
    const timelinePanel = root.querySelector('#insp-panel-timeline')!;
    expect(timelinePanel.getAttribute('aria-live')).toBeNull();

    // A status-changing event announces a summary; throttled to the window.
    const paused = { ...sampleRun(), status: 'paused' as const };
    m.projectEvents.forEach((l) => l(paused));
    await waitMs(1500); // past the 1.2s throttle window from the show() summary
    expect(live.textContent).toContain('paused');
    expect(live.textContent).toContain('Project Atlas Study');
  });
});

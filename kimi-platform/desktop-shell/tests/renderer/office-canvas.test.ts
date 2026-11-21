// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest';
import { BridgeAdapter } from '../../src/renderer/office/bridge';
import { createOfficeApp } from '../../src/renderer/office/app';
import { deriveRooms, dependencyLayers, layoutRooms, loopRequeuesByNode } from '../../src/renderer/office/derive';
import { flush, makeFakePanzoom, makeMockBridge, mountChromeDom, sampleEvents, sampleProject } from './helpers';

function bootApp(mock = makeMockBridge()) {
  const root = mountChromeDom();
  const { factory } = makeFakePanzoom();
  const app = createOfficeApp({
    root,
    adapter: new BridgeAdapter(mock.bridge),
    panzoomFactory: factory as never,
  });
  return { app, root, mock };
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('room derivation (pure)', () => {
  it('groups nodes by explicit roomId else role, preserving order', () => {
    const rooms = deriveRooms(sampleProject());
    expect(rooms.map((r) => r.id)).toEqual([
      'room:director',
      'room:research',
      'room:fieldwork',
      'room:build',
      'room:review',
    ]);
    expect(rooms[1]?.nodeIds).toEqual(['n-research-lead']);
    expect(rooms[2]?.nodeIds).toEqual(['n-researcher']);
  });

  it('lays rooms within the world without overlap of the empty case', () => {
    const layouts = layoutRooms(deriveRooms(sampleProject()));
    expect(layouts).toHaveLength(5);
    for (const l of layouts) {
      expect(l.x).toBeGreaterThanOrEqual(0);
      expect(l.y).toBeGreaterThanOrEqual(0);
      expect(l.x + l.w).toBeLessThanOrEqual(2400);
      expect(l.y + l.h).toBeLessThanOrEqual(1600);
    }
    expect(layoutRooms([])).toEqual([]);
  });

  it('computes longest-path dependency layers', () => {
    const layers = dependencyLayers(sampleProject());
    expect(layers.get('n-director')).toBe(0);
    expect(layers.get('n-research-lead')).toBe(1);
    expect(layers.get('n-researcher')).toBe(2);
    expect(layers.get('n-reviewer')).toBe(2);
  });

  it('counts loop revision requeues per node from run events', () => {
    const requeues = loopRequeuesByNode(sampleEvents());
    expect(requeues.get('n-builder')).toBe(1);
    expect(requeues.get('n-director')).toBeUndefined();
  });
});

describe('office canvas + sitemap parity', () => {
  it('renders one desk per project node, in rooms matching the derivation', async () => {
    const { root, app } = bootApp();
    await app.show();
    await flush();

    const desks = root.querySelectorAll('#office-canvas-world .desk');
    expect(desks).toHaveLength(5);
    const rooms = root.querySelectorAll('#office-canvas-world .room');
    expect(rooms).toHaveLength(5);
    const fieldwork = root.querySelector('.room[data-room-id="room:fieldwork"]');
    expect(fieldwork?.querySelectorAll('.desk')).toHaveLength(1);

    // Live statuses come from the run: director succeeded, research lead running.
    expect(root.querySelector('.desk[data-node-id="n-director"]')?.className).toContain('status-succeeded');
    expect(root.querySelector('.desk[data-node-id="n-research-lead"]')?.className).toContain('status-running');
    expect(root.querySelector('.desk[data-node-id="n-builder"]')?.className).toContain('status-pending');
  });

  it('sitemap lists exactly the same rooms and nodes as the canvas', async () => {
    const { root, app } = bootApp();
    await app.show();
    await flush();

    root.querySelector<HTMLButtonElement>('#sitemap-toggle')?.click();
    await flush();

    const canvasNodeIds = Array.from(root.querySelectorAll('.desk')).map((d) => (d as HTMLElement).dataset.nodeId).sort();
    const sitemapNodeIds = Array.from(root.querySelectorAll('#office-sitemap .sitemap-node'))
      .map((d) => (d as HTMLElement).dataset.nodeId)
      .sort();
    expect(sitemapNodeIds).toEqual(canvasNodeIds);

    const canvasRooms = Array.from(root.querySelectorAll('.room')).map((r) => (r as HTMLElement).dataset.roomId).sort();
    const sitemapRoomNames = Array.from(root.querySelectorAll('#office-sitemap .sitemap-room')).length;
    expect(sitemapRoomNames).toBe(canvasRooms.length);
  });

  it('activating a desk (keyboard/click) selects it and opens the Node inspector', async () => {
    const { root, app } = bootApp();
    await app.show();
    await flush();

    const desk = root.querySelector<HTMLButtonElement>('.desk[data-node-id="n-builder"]');
    expect(desk?.getAttribute('aria-label')).toContain('Builder');
    desk?.click();
    await flush();

    expect(root.querySelector('#insp-tab-node')?.getAttribute('aria-selected')).toBe('true');
    expect(root.querySelector('#insp-panel-node')?.hasAttribute('hidden')).toBe(false);
    expect(root.querySelector('#insp-panel-node')?.textContent).toContain('Builder');
    expect(root.querySelector('#insp-panel-node')?.textContent).toContain('Build');
    expect(desk?.className).toContain('selected');
  });

  it('sitemap buttons mirror the same selection path', async () => {
    const { root, app } = bootApp();
    await app.show();
    await flush();
    root.querySelector<HTMLButtonElement>('#sitemap-toggle')?.click();
    await flush();

    root.querySelector<HTMLButtonElement>('#office-sitemap .sitemap-node[data-node-id="n-reviewer"]')?.click();
    await flush();
    expect(root.querySelector('#insp-panel-node')?.textContent).toContain('Reviewer');
    expect(root.querySelector('.desk[data-node-id="n-reviewer"]')?.className).toContain('selected');
  });

  it('uses the main-derived office snapshot rooms when the v3 bridge provides them', async () => {
    const { root, app } = bootApp(makeMockBridge({ v3: true }));
    await app.show();
    await flush();

    // Snapshot rooms come from getOfficeSnapshot (mocked from the same
    // project): parity invariant — every node appears exactly once.
    const desks = Array.from(root.querySelectorAll('#office-canvas-world .desk')).map(
      (d) => (d as HTMLElement).dataset.nodeId,
    );
    expect(desks.sort()).toEqual(['n-builder', 'n-director', 'n-research-lead', 'n-researcher', 'n-reviewer']);
    expect(app.state().snapshotRooms).not.toBeNull();
    const snapshotNodeCount = app.state().snapshotRooms?.reduce((n, r) => n + r.nodeIds.length, 0);
    expect(snapshotNodeCount).toBe(5);
    expect(root.querySelector('.room[data-room-id="room:fieldwork"]')).not.toBeNull();
  });

  it('shows an honest empty state without a project', async () => {
    const { root, app } = bootApp(makeMockBridge({ project: null, run: null }));
    await app.show();
    await flush();
    expect(root.querySelector('#office-canvas-world')?.textContent).toContain('No project selected');
    expect(root.querySelectorAll('.desk')).toHaveLength(0);
  });

  it('wires zoom/pan/reset controls to the panzoom instance', async () => {
    const mock = makeMockBridge();
    const root = mountChromeDom();
    const { factory, tracker } = makeFakePanzoom();
    const app = createOfficeApp({ root, adapter: new BridgeAdapter(mock.bridge), panzoomFactory: factory as never });
    await app.show();
    await flush();
    root.querySelector<HTMLButtonElement>('#canvas-zoom-in')?.click();
    root.querySelector<HTMLButtonElement>('#canvas-zoom-out')?.click();
    // Zoom controls drive the vendored panzoom smooth-zoom API.
    expect(tracker.smoothZoomCalls).toBe(2);
    // Directional pan controls are the non-drag alternative.
    root.querySelector<HTMLButtonElement>('#canvas-pan-left')?.click();
    root.querySelector<HTMLButtonElement>('#canvas-pan-down')?.click();
    expect(tracker.moveByCalls).toBe(2);
    // Reset always recovers the fitted view (viewport sized for the fit).
    const viewport = root.querySelector<HTMLElement>('#office-canvas-viewport');
    if (viewport) {
      Object.defineProperty(viewport, 'clientWidth', { value: 1440, configurable: true });
      Object.defineProperty(viewport, 'clientHeight', { value: 900, configurable: true });
    }
    root.querySelector<HTMLButtonElement>('#canvas-reset')?.click();
    expect(tracker.zoomAbsCalls).toBeGreaterThan(0);
    expect(tracker.moveToCalls).toBeGreaterThan(0);
    app.destroy();
    expect(tracker.disposeCount).toBe(1);
  });
});

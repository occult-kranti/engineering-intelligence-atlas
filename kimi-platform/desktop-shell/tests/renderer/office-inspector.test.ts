// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { BridgeAdapter } from '../../src/renderer/office/bridge';
import { createOfficeApp } from '../../src/renderer/office/app';
import { flush, makeFakePanzoom, makeMockBridge, mountChromeDom } from './helpers';

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

describe('tab and inspector interactions', () => {
  it('switches office tabs with aria-selected + hidden panel parity', async () => {
    const { root, app } = bootApp();
    await app.show();
    await flush();

    root.querySelector<HTMLButtonElement>('#tab-roadmap')?.click();
    await flush();
    expect(root.querySelector('#tab-roadmap')?.getAttribute('aria-selected')).toBe('true');
    expect(root.querySelector('#panel-roadmap')?.hasAttribute('hidden')).toBe(false);
    expect(root.querySelector('#panel-office')?.hasAttribute('hidden')).toBe(true);
    expect(root.querySelector('#tab-office')?.getAttribute('aria-selected')).toBe('false');
  });

  it('collapses and expands the inspector via its toggle', async () => {
    const { root, app } = bootApp();
    await app.show();
    await flush();

    const toggle = root.querySelector<HTMLButtonElement>('#inspector-toggle');
    expect(toggle?.getAttribute('aria-expanded')).toBe('true');
    toggle?.click();
    expect(toggle?.getAttribute('aria-expanded')).toBe('false');
    expect(root.querySelector('#inspector-body')?.className).toContain('collapsed');
    // Content stays in the DOM (no motion required for visibility).
    expect(root.querySelector('#insp-panel-timeline')).not.toBeNull();
    toggle?.click();
    expect(root.querySelector('#inspector-body')?.className).not.toContain('collapsed');
  });

  it('switches inspector tabs', async () => {
    const { root, app } = bootApp();
    await app.show();
    await flush();
    root.querySelector<HTMLButtonElement>('#insp-tab-artifacts')?.click();
    await flush();
    expect(root.querySelector('#insp-panel-artifacts')?.hasAttribute('hidden')).toBe(false);
    expect(root.querySelector('#insp-panel-timeline')?.hasAttribute('hidden')).toBe(true);
  });
});

describe('timeline', () => {
  it('renders persisted events with loop iteration markers', async () => {
    const mock = makeMockBridge({ v3: true });
    const { root, app } = bootApp(mock);
    await app.show();
    await flush();

    const timeline = root.querySelector('#insp-panel-timeline');
    expect(timeline?.querySelectorAll('.timeline-event')).toHaveLength(4);
    const markers = timeline?.querySelectorAll('.timeline-loop-marker');
    expect(markers).toHaveLength(1);
    expect(markers?.[0]?.textContent).toContain('Loop revision 1');
    expect(timeline?.textContent).toContain('revision requested by Reviewer');
    expect(timeline?.textContent).toContain('node-succeeded');
  });

  it('is honest when the runtime cannot provide events (v2 bridge)', async () => {
    const { root, app } = bootApp(makeMockBridge({ v3: false }));
    await app.show();
    await flush();
    expect(root.querySelector('#insp-panel-timeline')?.textContent).toContain('requires desktop 0.3 runtime');
  });
});

describe('artifacts', () => {
  it('lists run artifacts and reads them with provenance', async () => {
    const { root, app } = bootApp();
    await app.show();
    await flush();
    root.querySelector<HTMLButtonElement>('#insp-tab-artifacts')?.click();
    await flush();

    const panel = root.querySelector('#insp-panel-artifacts');
    expect(panel?.textContent).toContain('Director');
    panel?.querySelector<HTMLButtonElement>('button.secondary')?.click();
    await flush();
    expect(panel?.textContent).toContain('Artifact body text');
    expect(panel?.textContent).toContain('provenance: openai · gpt-5.2');
    expect(panel?.textContent).toContain('sha256 dddddddd');
  });
});

describe('roadmap parity', () => {
  it('canonical list contains every DAG node with deps, owner, loop attempts', async () => {
    const mock = makeMockBridge({ v3: true });
    const { root, app } = bootApp(mock);
    await app.show();
    await flush();
    root.querySelector<HTMLButtonElement>('#tab-roadmap')?.click();
    await flush();

    const rows = root.querySelectorAll('#roadmap-list-wrap tbody tr');
    expect(rows).toHaveLength(5);
    const svgNodes = root.querySelectorAll('#roadmap-svg-wrap .roadmap-node');
    expect(svgNodes).toHaveLength(5);

    const researcherRow = Array.from(rows).find((r) => (r as HTMLElement).dataset.nodeId === 'n-researcher');
    expect(researcherRow?.textContent).toContain('Researcher A');
    expect(researcherRow?.textContent).toContain('Research Lead'); // depends on
    expect(researcherRow?.textContent).toContain('Research Lead'); // owner (parent)
    // attempts: n-research-lead has persisted attempt 2
    const leadRow = Array.from(rows).find((r) => (r as HTMLElement).dataset.nodeId === 'n-research-lead');
    expect(leadRow?.textContent).toContain('2');
    // n-builder has one loop-requeued event → attempt 1 derived from events
    const builderRow = Array.from(rows).find((r) => (r as HTMLElement).dataset.nodeId === 'n-builder');
    expect(builderRow?.textContent).toContain('1');
  });
});

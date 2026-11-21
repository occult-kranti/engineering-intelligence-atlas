// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { BridgeAdapter } from '../../src/renderer/office/bridge';
import { createOfficeApp } from '../../src/renderer/office/app';
import { flush, makeFakePanzoom, makeMockBridge, mountChromeDom, sampleApprovals, sampleRun } from './helpers';

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

describe('approval inbox', () => {
  it('renders pending approvals with reviewed payload and a pending count badge', async () => {
    const mock = makeMockBridge({ v3: true, approvals: sampleApprovals() });
    const { root, app } = bootApp(mock);
    await app.show();
    await flush();

    root.querySelector<HTMLButtonElement>('#insp-tab-approvals')?.click();
    await flush();

    const panel = root.querySelector('#insp-panel-approvals');
    expect(panel?.textContent).toContain('hire approval');
    expect(panel?.textContent).toContain('skill:web-research'); // reviewed payload, verbatim
    expect(panel?.textContent).toContain('design-time');
    expect(panel?.textContent).toContain('Reviewer'); // node approval payload
    expect(root.querySelector('#approvals-count')?.textContent).toBe('1');

    const pendingCard = panel?.querySelector('.approval-card[data-approval-id="ap-1"]');
    expect(pendingCard?.querySelectorAll('button:not([disabled])')).toHaveLength(2);

    const decidedCard = panel?.querySelector('.approval-card[data-approval-id="ap-2"]');
    expect(decidedCard?.querySelectorAll('button')).toHaveLength(0);
    expect(decidedCard?.textContent).toContain('approved');
  });

  it('decides an approval exactly once and re-renders the decided state', async () => {
    const mock = makeMockBridge({ v3: true, approvals: sampleApprovals() });
    const { root, app } = bootApp(mock);
    await app.show();
    await flush();
    root.querySelector<HTMLButtonElement>('#insp-tab-approvals')?.click();
    await flush();

    const approveBtn = root.querySelector<HTMLButtonElement>(
      '.approval-card[data-approval-id="ap-1"] button:not(.danger)',
    );
    approveBtn?.click();
    // Buttons disabled synchronously after the first click: no double-decide.
    expect(approveBtn?.disabled).toBe(true);
    approveBtn?.click();
    await flush();

    // The decision presents the exact payload hash of the reviewed payload.
    expect(mock.calls.decideApproval).toEqual([
      {
        projectId: 'proj-1',
        runId: null,
        approvalId: 'ap-1',
        decision: 'approved',
        payloadHash: 'f'.repeat(64),
      },
    ]);
    const card = root.querySelector('.approval-card[data-approval-id="ap-1"]');
    expect(card?.textContent).toContain('approved');
    expect(card?.querySelectorAll('button')).toHaveLength(0);
    expect(root.querySelector('#approvals-count')?.textContent).toBe('');
  });

  it('is honest when approvals need the 0.3 runtime', async () => {
    const { root, app } = bootApp(makeMockBridge({ v3: false }));
    await app.show();
    await flush();
    root.querySelector<HTMLButtonElement>('#insp-tab-approvals')?.click();
    await flush();
    expect(root.querySelector('#insp-panel-approvals')?.textContent).toContain('requires desktop 0.3 runtime');
  });
});

describe('runs: controls, live state, recovery', () => {
  it('enables pause/cancel for a running run and disables start', async () => {
    const { root, app } = bootApp();
    await app.show();
    await flush();
    expect(root.querySelector<HTMLButtonElement>('#run-start')?.disabled).toBe(true);
    expect(root.querySelector<HTMLButtonElement>('#run-pause')?.disabled).toBe(false);
    expect(root.querySelector<HTMLButtonElement>('#run-resume')?.disabled).toBe(true);
    expect(root.querySelector<HTMLButtonElement>('#run-cancel')?.disabled).toBe(false);
    expect(root.querySelector('#run-live')?.textContent).toContain('running');
  });

  it('shows the waiting-approval banner for waiting runs', async () => {
    const mock = makeMockBridge({ run: sampleRun({ status: 'waiting-approval' }) });
    const { root, app } = bootApp(mock);
    await app.show();
    await flush();
    expect(root.querySelector('#run-live')?.textContent).toContain('waiting for an approval');
    expect(root.querySelector<HTMLButtonElement>('#run-start')?.disabled).toBe(true);
  });

  it('offers recovery for an interrupted run when the bridge supports it', async () => {
    const mock = makeMockBridge({ v3: true, run: sampleRun({ status: 'interrupted' }) });
    const { root, app } = bootApp(mock);
    await app.show();
    await flush();

    const recoverBtn = root.querySelector<HTMLButtonElement>('#run-recover');
    expect(recoverBtn?.classList.contains('hidden')).toBe(false);
    recoverBtn?.click();
    await flush();
    expect(mock.calls.recoverRun).toEqual(['run-1']);
    expect(root.querySelector('#run-status')?.textContent).toContain('recovered');
  });

  it('is honest about recovery when the runtime is too old', async () => {
    const mock = makeMockBridge({ v3: false, run: sampleRun({ status: 'interrupted' }) });
    const { root, app } = bootApp(mock);
    await app.show();
    await flush();

    expect(root.querySelector('#run-recover')?.classList.contains('hidden')).toBe(true);
    expect(root.querySelector('#run-recover-note')?.textContent).toContain('interrupted');
    expect(root.querySelector('#run-recover-note')?.textContent).toContain('requires desktop 0.3 runtime');
  });

  it('applies live project events to desks and run state', async () => {
    const mock = makeMockBridge();
    const { root, app } = bootApp(mock);
    await app.show();
    await flush();

    mock.projectEvents.forEach((listener) =>
      listener(sampleRun({ id: 'run-1', status: 'paused', nodeStates: { 'n-builder': { status: 'running', usage: { inputTokens: 1, outputTokens: 1, costUsd: 0 }, artifactId: null, error: null, startedAt: null, finishedAt: null } } })),
    );
    await flush();
    expect(root.querySelector('.desk[data-node-id="n-builder"]')?.className).toContain('status-running');
    expect(root.querySelector('#run-live')?.textContent).toContain('paused');
  });
});

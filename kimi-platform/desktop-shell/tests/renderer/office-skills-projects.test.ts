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

async function openTab(root: HTMLElement, tab: string) {
  root.querySelector<HTMLButtonElement>(`#tab-${tab}`)?.click();
  await flush();
}

describe('skills registry', () => {
  it('renders bundled skills with provenance and hash', async () => {
    const { root, app } = bootApp(makeMockBridge({ v3: true }));
    await app.show();
    await openTab(root, 'skills');

    const list = root.querySelector('#skills-list');
    expect(list?.textContent).toContain('Web Research');
    expect(list?.textContent).toContain('hash verified');
    expect(list?.textContent).toContain('hash mismatch'); // doc-review fixture is unverified
    expect(list?.textContent).toContain('room: research');
    expect(list?.textContent).toContain('research/web-research/SKILL.md');
    expect(list?.textContent).toContain('sha256 aaaaaaaaaaaaaaaa');
  });

  it('filters by search query', async () => {
    const { root, app } = bootApp(makeMockBridge({ v3: true }));
    await app.show();
    await openTab(root, 'skills');

    const search = root.querySelector<HTMLInputElement>('#skills-search');
    if (search) {
      search.value = 'review';
      search.dispatchEvent(new Event('input', { bubbles: true }));
    }
    await flush();
    const list = root.querySelector('#skills-list');
    expect(list?.textContent).toContain('Document Review');
    expect(list?.textContent).not.toContain('Web Research');
    expect(root.querySelector('#skills-status')?.textContent).toContain('1 of 2');
  });

  it('is honest when the registry needs the 0.3 runtime', async () => {
    const { root, app } = bootApp(makeMockBridge({ v3: false }));
    await app.show();
    await openTab(root, 'skills');
    expect(root.querySelector('#skills-status')?.textContent).toContain('requires desktop 0.3 runtime');
    expect(root.querySelector('#hire-note')?.textContent).toContain('requires desktop 0.3 runtime');
    expect(root.querySelector<HTMLButtonElement>('#hire-preview-btn')?.disabled).toBe(true);
    expect(root.querySelector<HTMLButtonElement>('#hire-apply-btn')?.disabled).toBe(true);
  });
});

describe('goal-based hiring', () => {
  it('previews hires and requires explicit approval before applying', async () => {
    const mock = makeMockBridge({ v3: true });
    const { root, app } = bootApp(mock);
    await app.show();
    await openTab(root, 'skills');

    root.querySelector<HTMLButtonElement>('#hire-preview-btn')?.click();
    await flush();
    expect(mock.calls.hirePreview).toEqual(['proj-1']);
    expect(root.querySelector('#hire-preview-list')?.textContent).toContain('Researcher A → Web Research');
    expect(root.querySelector('#hire-preview-list')?.textContent).toContain('matched: research');
    expect(root.querySelector('#hire-preview-list')?.textContent).toContain('Plan hash 99999999');

    // Apply stays disabled until the explicit approval checkbox is ticked.
    expect(root.querySelector<HTMLButtonElement>('#hire-apply-btn')?.disabled).toBe(true);
    const confirm = root.querySelector<HTMLInputElement>('#hire-confirm');
    if (confirm) {
      confirm.checked = true;
      confirm.dispatchEvent(new Event('change', { bubbles: true }));
    }
    await flush();
    const applyBtn = root.querySelector<HTMLButtonElement>('#hire-apply-btn');
    expect(applyBtn?.disabled).toBe(false);
    applyBtn?.click();
    await flush(14);
    // OCC: expectedVersion comes from the preview's projectVersion.
    expect(mock.calls.applyHires).toEqual([
      {
        projectId: 'proj-1',
        expectedVersion: 3,
        assignments: [{ nodeId: 'n-researcher', skillId: 'skill:web-research' }],
        confirmed: true,
      },
    ]);
    expect(root.querySelector('#hire-status')?.textContent).toContain('approval ap-hire-1');
    // The hire approval lands in the inbox for an explicit approve/reject.
    expect(root.querySelector('#insp-tab-approvals')?.getAttribute('aria-selected')).toBe('true');
    expect(root.querySelector('#insp-panel-approvals')?.textContent).toContain('hire approval');
  });
});

describe('room reassignment (expectedVersion)', () => {
  it('sends expectedVersion from the project object via reassignNode', async () => {
    const mock = makeMockBridge({ v3: true });
    const { root, app } = bootApp(mock);
    await app.show();
    await flush();

    root.querySelector<HTMLButtonElement>('.desk[data-node-id="n-builder"]')?.click();
    await flush();
    const select = root.querySelector<HTMLSelectElement>('#reassign-room-select');
    if (select) select.value = 'room:research';
    root.querySelector<HTMLButtonElement>('#insp-panel-node .reassign-box button')?.click();
    await flush();
    expect(mock.calls.reassignNode).toEqual([
      { projectId: 'proj-1', nodeId: 'n-builder', expectedVersion: 3, roomId: 'room:research' },
    ]);
  });

  it('shows an honest unavailable note on a v2 bridge', async () => {
    const { root, app } = bootApp(makeMockBridge({ v3: false }));
    await app.show();
    await flush();
    root.querySelector<HTMLButtonElement>('.desk[data-node-id="n-builder"]')?.click();
    await flush();
    expect(root.querySelector('#insp-panel-node .reassign-box')?.textContent).toContain(
      'requires desktop 0.3 runtime',
    );
  });
});

describe('new project flow', () => {
  it('opens the dialog, shows the hierarchy preview, and submits v3 fields', async () => {
    const mock = makeMockBridge({ v3: true });
    const { root, app } = bootApp(mock);
    await app.show();
    await flush();

    root.querySelector<HTMLButtonElement>('#project-new')?.click();
    await flush();
    const dialog = root.querySelector('#new-project-dialog');
    expect(dialog?.classList.contains('hidden')).toBe(false);
    expect(root.querySelector('#np-preview')?.textContent).toContain('Research Sub-Director');

    const created: unknown[] = [];
    mock.bridge.createProject = async (req) => {
      created.push(req);
      return { ok: true, project: undefined };
    };

    root.querySelector<HTMLInputElement>('#np-name')!.value = 'New Study';
    root.querySelector<HTMLTextAreaElement>('#np-goal')!.value = 'Study things';
    root.querySelector<HTMLTextAreaElement>('#np-success-criteria')!.value = 'Criterion A\nCriterion B';
    root.querySelector<HTMLInputElement>('#np-model')!.value = 'gpt-5.2';
    root.querySelector<HTMLFormElement>('#project-form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flush();

    const req = created[0] as {
      name: string;
      successCriteria?: string[];
      loopPolicy?: { maxIterations: number; noProgressLimit: number } | null;
      template?: string;
      nodes?: unknown[];
    };
    expect(req.name).toBe('New Study');
    expect(req.successCriteria).toEqual(['Criterion A', 'Criterion B']);
    expect(req.loopPolicy).toEqual({ maxIterations: 3, noProgressLimit: 2 });
    expect(req.template).toBe('office');
    // Nodes are generated by the runtime from the template — never hand-built here.
    expect(req.nodes).toBeUndefined();
  });
});

describe('connections tab', () => {
  it('renders key vault rows without exposing key material', async () => {
    const { root, app } = bootApp();
    await app.show();
    await openTab(root, 'connections');
    const rows = root.querySelector('#key-rows');
    expect(rows?.textContent).toContain('OpenAI');
    expect(rows?.textContent).toContain('configured');
    expect(rows?.textContent).toContain('not configured');
    expect(rows?.querySelectorAll('input[type="password"]')).toHaveLength(2);
  });
});

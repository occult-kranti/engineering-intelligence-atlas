// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installDom, type FreeflowDom } from './fixtures/freeflow-dom.js';
import { DEFAULT_CAMERA, worldToScreen, type Camera } from '../src/renderer/freeflow/camera.js';
import { CANVAS_LAYOUT_KEY, mountCanvasWorkspace, type CanvasWorkspace, type CanvasWorkspacePanel } from '../src/renderer/freeflow/canvas-workspace.js';

let dom: FreeflowDom;
const cleanup: (() => void)[] = [];
beforeEach(() => { dom = installDom(); });
afterEach(() => { for (const c of cleanup.splice(0)) c(); dom.restore(); });

function store() {
  const values = new Map<string, string>(); let writes = 0;
  return {
    storage: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); writes++; } } as Storage,
    values, writes: () => writes,
  };
}
function mount(settings: { storage?: Storage | null; specs?: CanvasWorkspacePanel[]; camera?: Camera; measure?: boolean; viewport?: {width:number;height:number}; insets?: {top:number;bottom:number;left:number;right:number} } = {}) {
  const origin = document.createElement('main'), host = document.createElement('div'), viewport = document.createElement('div'), world = document.createElement('div');
  viewport.tabIndex = 0; viewport.append(world); document.body.append(origin, host, viewport);
  const first = document.createElement('section'), second = document.createElement('section');
  first.id = 'original-first'; second.id = 'original-second'; second.classList.add('hidden'); second.hidden = true;
  const input = document.createElement('textarea'); input.id = 'live-draft'; input.value = 'Keep this draft'; first.append(input); origin.append(first, second);
  const specs: CanvasWorkspacePanel[] = settings.specs ?? [
    { id: 'donna', title: 'Donna', element: first, rect: { x: 20, y: 30, width: 800, height: 600 }, initiallyOpen: true, group: 'People' },
    { id: 'models', title: 'Models & system', element: second, rect: { x: 4000, y: 5000, width: 900, height: 700 }, group: 'System' },
  ];
  let camera = settings.camera ?? { ...DEFAULT_CAMERA }, stops = 0, shows = 0, homes = 0;
  const cameras: Camera[] = [], changes: Array<[string, boolean]> = [];
  if (settings.measure !== false) dom.setGeometry(viewport, settings.viewport ?? { width: 1280, height: 800 });
  const workspace = mountCanvasWorkspace(host, { world, viewport, panels: specs, storage: settings.storage === undefined ? null : settings.storage, getCamera: () => camera, setCamera: (c) => { camera = c; cameras.push(c); }, stopMotion: () => { stops++; }, showCanvas: () => { shows++; }, ...(settings.insets ? {getFrameInsets:()=>settings.insets!} : {}), onHome: () => { homes++; }, onPanelChange: (id, open) => changes.push([id, open]) });
  cleanup.push(() => workspace.destroy());
  const panel = (id: string) => workspace.elements.layer.querySelector(`[data-panel-id="${id}"]`) as HTMLElement;
  const control = (id: string, cls: string) => panel(id).querySelector(cls) as HTMLButtonElement;
  return { workspace, host, viewport, world, origin, first, second, input, panel, control, cameras, changes, getCamera: () => camera, setCamera: (next: Camera) => { camera = next; }, stops: () => stops, shows: () => shows, homes: () => homes };
}

describe('one live DOM canvas workspace', () => {
  it('reparents the exact elements, keeps drafts/listeners and permits multiple open surfaces', () => {
    const m = mount(); let inputEvents = 0; m.input.addEventListener('input', () => inputEvents++);
    expect(m.panel('donna').contains(m.first)).toBe(true);
    expect(document.querySelectorAll('#live-draft')).toHaveLength(1);
    m.workspace.open('models', { frame: false });
    m.workspace.open('donna', { frame: false });
    m.input.value = 'Updated but unsent'; m.input.dispatchEvent(new Event('input', { bubbles: true }));
    m.workspace.close('donna'); m.workspace.open('donna', { frame: false });
    expect(m.workspace.isOpen('models')).toBe(true);
    expect(m.input.value).toBe('Updated but unsent'); expect(inputEvents).toBe(1);
    expect(document.querySelectorAll('#live-draft')).toHaveLength(1);
    expect(m.second.hidden).toBe(false); expect(m.second.classList.contains('hidden')).toBe(false);
  });

  it('only emits real open transitions and reveals deeply nested live controls', () => {
    const m = mount(); const child = document.createElement('input'); m.second.append(child);
    expect(m.workspace.revealElement(child)).toBe(true);
    expect(m.changes).toEqual([['models', true]]);
    m.workspace.open('models', { frame: false }); m.workspace.close('models'); m.workspace.close('models');
    expect(m.changes).toEqual([['models', true], ['models', false]]);
    expect(m.workspace.revealElement(document.createElement('p'))).toBe(false);
    m.workspace.open('missing'); expect(m.changes).toHaveLength(2);
  });

  it('searches registered titles/groups with literal text and shows a recoverable empty state', () => {
    const m = mount(); (m.host.querySelector('.canvas-find') as HTMLButtonElement).click();
    const search = m.host.querySelector('.canvas-search') as HTMLInputElement;
    search.value = 'System'; search.dispatchEvent(new Event('input'));
    expect(m.host.querySelectorAll('.canvas-search-result')).toHaveLength(1);
    expect(m.host.querySelector('.canvas-search-result')!.textContent).toContain('Models & system');
    (m.host.querySelector('.canvas-search-result') as HTMLButtonElement).click();
    expect(m.workspace.isOpen('models')).toBe(true);
    expect((m.host.querySelector('.canvas-palette') as HTMLElement).hidden).toBe(true);
    (m.host.querySelector('.canvas-find') as HTMLButtonElement).click();
    search.value = '<img onerror=alert(1)>'; search.dispatchEvent(new Event('input'));
    expect(m.host.querySelector('.canvas-search-empty')!.textContent).toContain('No surfaces match');
    expect(m.host.querySelector('img')).toBeNull();
    dom.key(search, 'Escape'); expect((m.host.querySelector('.canvas-palette') as HTMLElement).hidden).toBe(true);
  });

  it('positions a new panel near the camera only once and preserves later parking', () => {
    const saved = store(); const m = mount({ storage: saved.storage, camera: { ...DEFAULT_CAMERA, x: 2000, y: 1000 } });
    m.workspace.open('models', { frame: false });
    const firstPosition = m.panel('models').style.transform;
    expect(firstPosition.replaceAll(' ', '')).toContain('1550px,650px');
    m.workspace.close('models'); m.setCamera({ ...DEFAULT_CAMERA, x: -9000, y: 8000 });
    m.workspace.open('models', { frame: false, nearCamera: true });
    expect(m.panel('models').style.transform).toBe(firstPosition);
    const json = saved.values.get(CANVAS_LAYOUT_KEY)!;
    expect(json).not.toMatch(/Keep this draft|live-draft|Models & system/);
  });

  it('survives blocked and exhausted storage while all surfaces remain usable', () => {
    const blocked = { getItem() { throw Error('blocked'); }, setItem() { throw Error('quota'); } } as unknown as Storage;
    const m = mount({ storage: blocked });
    m.workspace.open('models', { frame: false }); m.workspace.close('models');
    expect(m.workspace.isOpen('donna')).toBe(true);
    expect(m.host.querySelector('.canvas-layout-status')!.textContent).toContain('this session');
  });

  it('closing an active focused surface restores a reachable focus target', () => {
    const m = mount(); m.workspace.open('models', { frame: false });
    m.workspace.close('models');
    expect(document.activeElement).toBe(m.control('donna', '.canvas-panel-grip'));
    m.workspace.close('donna');
    expect(document.activeElement?.getAttribute('data-canvas-open')).toBe('donna');
    expect(m.panel('donna').hidden).toBe(true); expect(m.first.hidden).toBe(true);
  });

  it('reasserts open presentation after legacy renderers change hidden classes', () => {
    const m = mount(); m.first.hidden = true; m.first.classList.add('hidden'); m.workspace.refresh();
    expect(m.first.hidden).toBe(false); expect(m.first.classList.contains('hidden')).toBe(false);
  });

  it('restores original DOM order, hidden state, listeners and drafts on destroy', () => {
    const m = mount(); const value = m.input.value; let clicks = 0; m.first.addEventListener('click', () => clicks++);
    m.workspace.open('models'); m.workspace.destroy(); m.workspace.destroy();
    expect([...m.origin.children]).toEqual([m.first, m.second]);
    expect(m.second.hidden).toBe(true); expect(m.second.classList.contains('hidden')).toBe(true);
    expect(m.input.value).toBe(value); m.first.click(); expect(clicks).toBe(1);
    expect(m.host.children).toHaveLength(0); expect(m.world.children).toHaveLength(0);
    expect(dom.raf.pending()).toBe(0);
    m.workspace.open('donna'); expect(m.workspace.isOpen('donna')).toBe(false);
  });

  it('rejects DOM aliasing and ancestor panels that would contain the world', () => {
    const element = document.createElement('section'); document.body.append(element);
    const m = mount({ specs: [
      { id: 'a', element, rect: { x: 0, y: 0, width: 800, height: 600 } },
      { id: 'b', element, rect: { x: 0, y: 0, width: 800, height: 600 } },
      { id: 'ancestor', element: document.body, rect: { x: 0, y: 0, width: 800, height: 600 } },
    ] });
    expect(m.workspace.elements.layer.children).toHaveLength(1);
    expect(m.workspace.isOpen('b')).toBe(false); m.workspace.open('ancestor');
    expect(document.body.contains(m.viewport)).toBe(true);
  });
});

describe('single-pointer surface arrangement', () => {
  const step = (m: ReturnType<typeof mount>, name: string, id = 'donna') => m.control(id, `[data-arrange-action="${name}"]`);
  const popup = (m: ReturnType<typeof mount>, id = 'donna') => m.panel(id).querySelector('.canvas-arrange-popup') as HTMLElement;

  it('moves and resizes in 20-unit click steps while preserving exact live forms and avoiding authority calls', () => {
    const saved = store(), m = mount({ storage: saved.storage });
    const authority = vi.fn(); Object.assign(window, { desktopBridge: { officeCommand: authority, hostSubmit: authority, setOfficeWorker: authority } });
    const form = document.createElement('form'), submitted = vi.fn(), inputEvents = vi.fn();
    form.append(m.input); m.first.append(form); form.addEventListener('submit', submitted); m.input.addEventListener('input', inputEvents);
    m.input.value = 'An unsent scoped Donna draft';
    m.control('donna', '.canvas-panel-arrange').click();
    expect(popup(m).hidden).toBe(false);
    expect(m.control('donna', '.canvas-panel-arrange').getAttribute('aria-expanded')).toBe('true');
    expect(popup(m).querySelectorAll('[data-arrange-action]')).toHaveLength(8);
    expect(step(m, 'left').getAttribute('aria-label')).toBe('Move left: Donna');
    step(m, 'left').click(); expect(m.panel('donna').style.transform.replaceAll(' ', '')).toContain('0px,30px');
    step(m, 'right').click(); expect(m.panel('donna').style.transform.replaceAll(' ', '')).toContain('20px,30px');
    step(m, 'up').click(); expect(m.panel('donna').style.transform.replaceAll(' ', '')).toContain('20px,10px');
    step(m, 'down').click(); expect(m.panel('donna').style.transform.replaceAll(' ', '')).toContain('20px,30px');
    step(m, 'narrower').click(); expect(m.panel('donna').style.width).toBe('780px');
    step(m, 'wider').click(); expect(m.panel('donna').style.width).toBe('800px');
    step(m, 'shorter').click(); expect(m.panel('donna').style.height).toBe('580px');
    step(m, 'taller').click(); expect(m.panel('donna').style.height).toBe('600px');
    expect(m.first.querySelector('form')).toBe(form); expect(form.firstElementChild).toBe(m.input);
    expect(m.input.value).toBe('An unsent scoped Donna draft');
    m.input.dispatchEvent(new Event('input', { bubbles: true })); expect(inputEvents).toHaveBeenCalledTimes(1);
    expect(submitted).not.toHaveBeenCalled(); expect(authority).not.toHaveBeenCalled(); expect(m.changes).toEqual([]);
    expect(saved.values.get(CANVAS_LAYOUT_KEY)).not.toContain('unsent scoped Donna draft');
    expect(dom.capture.set.size).toBe(0);
  });

  it('clamps repeated size clicks at registered panel limits and reports the limit', () => {
    const element = document.createElement('section'); document.body.append(element);
    const saved = store(), m = mount({ storage: saved.storage, specs: [{ id: 'donna', title: 'Donna', element, initiallyOpen: true,
      rect: { x: 0, y: 0, width: 440, height: 480 }, minWidth: 400, maxWidth: 460, minHeight: 440, maxHeight: 500 }] });
    m.control('donna', '.canvas-panel-arrange').click();
    for (let n = 0; n < 4; n++) step(m, 'narrower').click();
    expect(m.panel('donna').style.width).toBe('400px');
    expect(popup(m).querySelector('[role="status"]')!.textContent).toContain('layout limit');
    const writes = saved.writes(); step(m, 'narrower').click(); expect(saved.writes()).toBe(writes);
    for (let n = 0; n < 4; n++) step(m, 'wider').click();
    expect(m.panel('donna').style.width).toBe('460px');
    for (let n = 0; n < 4; n++) step(m, 'shorter').click();
    expect(m.panel('donna').style.height).toBe('440px');
    for (let n = 0; n < 4; n++) step(m, 'taller').click();
    expect(m.panel('donna').style.height).toBe('500px');
  });

  it('blocks pinned and collapsed panels, closes controls and restores a usable focus target', () => {
    const saved = store(), m = mount({ storage: saved.storage });
    m.control('donna', '.canvas-panel-arrange').click();
    const before = m.panel('donna').style.cssText;
    m.control('donna', '.canvas-panel-pin').click();
    expect(popup(m).hidden).toBe(true); expect(m.control('donna', '.canvas-panel-arrange').disabled).toBe(true);
    expect(document.activeElement).toBe(m.control('donna', '.canvas-panel-grip'));
    const writes = saved.writes();
    step(m, 'right').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    m.control('donna', '.canvas-panel-arrange').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(m.panel('donna').style.cssText).toBe(before); expect(saved.writes()).toBe(writes);
    m.control('donna', '.canvas-panel-pin').click(); m.control('donna', '.canvas-panel-arrange').click();
    expect(popup(m).hidden).toBe(false);
    m.control('donna', '.canvas-panel-collapse').click(); expect(popup(m).hidden).toBe(true);
    expect(m.control('donna', '.canvas-panel-arrange').disabled).toBe(true);
    expect(m.input.value).toBe('Keep this draft');
  });

  it('Escape or the popup close button returns focus to Arrange without closing the work panel', () => {
    const m = mount(), trigger = m.control('donna', '.canvas-panel-arrange'); trigger.click();
    step(m, 'right').click();
    const event = dom.key(step(m, 'left'), 'Escape');
    expect(event.defaultPrevented).toBe(true); expect(popup(m).hidden).toBe(true);
    expect(document.activeElement).toBe(trigger); expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(m.workspace.isOpen('donna')).toBe(true); expect(m.input.value).toBe('Keep this draft');
    expect(m.panel('donna').style.transform.replaceAll(' ', '')).toContain('40px,30px');
    trigger.click(); m.control('donna', '.canvas-arrange-close').click();
    expect(document.activeElement).toBe(trigger); expect(popup(m).hidden).toBe(true); expect(m.workspace.isOpen('donna')).toBe(true);
  });

  it('keeps one arrangement popup and dismisses it on an outside pointer without altering drafts', () => {
    const m = mount(); m.workspace.open('models', { frame: false });
    m.control('donna', '.canvas-panel-arrange').click(); m.control('models', '.canvas-panel-arrange').click();
    expect(popup(m).hidden).toBe(true); expect(popup(m, 'models').hidden).toBe(false);
    expect(m.workspace.elements.layer.querySelectorAll('.canvas-arrange-popup:not([hidden])')).toHaveLength(1);
    dom.pointer(m.input, 'pointerdown', { x: 10, y: 10 });
    expect(popup(m, 'models').hidden).toBe(true); expect(m.workspace.isOpen('models')).toBe(true);
    expect(m.input.value).toBe('Keep this draft');
  });

  it('ignores retained arrangement controls after the surface closes or the workspace is destroyed', () => {
    const saved = store(), m = mount({ storage: saved.storage });
    const trigger = m.control('donna', '.canvas-panel-arrange'), action = step(m, 'down'); trigger.click();
    m.workspace.close('donna'); const writes = saved.writes(), before = m.panel('donna').style.cssText;
    action.dispatchEvent(new MouseEvent('click', { bubbles: true })); trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(m.panel('donna').style.cssText).toBe(before); expect(saved.writes()).toBe(writes); expect(popup(m).hidden).toBe(true);
    m.workspace.open('donna', { frame: false }); trigger.click(); m.workspace.destroy(); const finalWrites = saved.writes();
    action.dispatchEvent(new MouseEvent('click', { bubbles: true })); trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(saved.writes()).toBe(finalWrites); expect(m.input.value).toBe('Keep this draft'); expect(m.first.parentElement).toBe(m.origin);
    expect(dom.raf.pending()).toBe(0); expect(m.world.children).toHaveLength(0);
  });
});

describe('popup placement and viewport changes', () => {
  function rect(panel: HTMLElement) {
    const position = /translate3d\((-?[\d.]+)px,\s*(-?[\d.]+)px,\s*0(?:px)?\)/.exec(panel.style.transform)!;
    expect(position).not.toBeNull();
    return { x: Number(position[1]), y: Number(position[2]), width: parseFloat(panel.style.width), height: parseFloat(panel.style.height) };
  }
  function smallPopup(camera = { ...DEFAULT_CAMERA, x: 560, y: 380, zoom: .8 }) {
    const element = document.createElement('section'), draft = document.createElement('textarea');
    draft.value = 'Unsent company plan'; element.append(draft); document.body.append(element);
    const insets = { top: 150, bottom: 150, left: 16, right: 16 }, saved = store();
    const m = mount({ camera, viewport: { width: 1440, height: 900 }, insets, storage: saved.storage,
      specs: [{ id: 'donna', title: 'Donna', element, rect: { x: -1000, y: 1100, width: 440, height: 480 } }] });
    return { ...m, draft, insets, saved };
  }
  function expectTitleVisible(m: ReturnType<typeof smallPopup>, viewport: { width: number; height: number }) {
    const r = rect(m.panel('donna'));
    for (const x of [r.x, r.x + r.width]) for (const y of [r.y, r.y + 48]) {
      const p = worldToScreen(m.getCamera(), viewport, { x, y });
      expect(p.x).toBeGreaterThanOrEqual(m.insets.left - 1e-5);
      expect(p.x).toBeLessThanOrEqual(viewport.width - m.insets.right + 1e-5);
      expect(p.y).toBeGreaterThanOrEqual(m.insets.top - 1e-5);
      expect(p.y).toBeLessThanOrEqual(viewport.height - m.insets.bottom + 1e-5);
    }
  }

  it('opens a first Donna popup through the launcher near the office without zooming away from context', () => {
    const m = smallPopup(); let edits = 0;
    m.draft.addEventListener('input', () => edits++);
    (m.host.querySelector('[data-canvas-open="donna"]') as HTMLButtonElement).click(); dom.raf.drain();
    expect(rect(m.panel('donna'))).toEqual({ x: 340, y: 140, width: 440, height: 480 });
    expect(m.getCamera().x).toBeCloseTo(560, 5); expect(m.getCamera().y).toBeCloseTo(380, 5);
    expect(m.getCamera().zoom).toBeCloseTo(.8, 7);
    expectTitleVisible(m, { width: 1440, height: 900 });
    expect(m.panel('donna').querySelector('textarea')).toBe(m.draft);
    m.draft.value = 'Still the same company draft'; m.draft.dispatchEvent(new Event('input'));
    expect(edits).toBe(1); expect(m.saved.values.get(CANVAS_LAYOUT_KEY)).not.toContain('company draft');
  });

  it('respects explicit original placement and never teleports a seen, restored or pinned popup', () => {
    const m = smallPopup();
    m.workspace.open('donna', { frame: false, nearCamera: false });
    const original = rect(m.panel('donna'));
    expect(original.x).toBe(-1000); expect(original.y).toBe(1100);
    m.control('donna', '.canvas-panel-pin').click(); m.workspace.close('donna');
    m.setCamera({ ...DEFAULT_CAMERA, x: 7000, y: -5000 }); m.workspace.open('donna', { frame: false });
    expect(rect(m.panel('donna'))).toEqual(original);
    m.workspace.close('donna'); m.workspace.destroy();
    const element = document.createElement('section'); element.append(m.draft); document.body.append(element);
    const restored = mount({ storage: m.saved.storage, camera: { ...DEFAULT_CAMERA, x: 12000, y: 3000 },
      specs: [{ id: 'donna', element, rect: { x: 0, y: 0, width: 440, height: 480 } }] });
    restored.workspace.open('donna', { frame: false });
    expect(rect(restored.panel('donna'))).toEqual(original);
    expect(restored.panel('donna').classList.contains('is-pinned')).toBe(true);
    expect(m.draft.value).toBe('Unsent company plan');
  });

  it('reframes a pinned active title after viewport shrink and inset changes without altering geometry, focus or drafts', () => {
    const m = smallPopup({ ...DEFAULT_CAMERA, x: 560, y: 380, zoom: 1.2 });
    m.workspace.open('donna'); dom.raf.drain(); m.control('donna', '.canvas-panel-pin').click();
    m.draft.focus(); m.draft.value = 'Keep typing across resize';
    const geometry = rect(m.panel('donna')), writes = m.saved.writes();
    const viewport = { width: 1366, height: 768 };
    dom.setGeometry(m.viewport, viewport); dom.fireResize(); dom.raf.drain();
    expectTitleVisible(m, viewport);
    expect(rect(m.panel('donna'))).toEqual(geometry); expect(m.saved.writes()).toBe(writes);
    expect(document.activeElement).toBe(m.draft); expect(m.draft.value).toBe('Keep typing across resize');
    m.insets.top = 220; m.workspace.refresh(); dom.raf.drain();
    expectTitleVisible(m, viewport); expect(rect(m.panel('donna'))).toEqual(geometry);
    const cameraWrites = m.cameras.length;
    dom.fireResize(); m.workspace.refresh(); dom.raf.drain(); expect(m.cameras).toHaveLength(cameraWrites);
    m.workspace.destroy(); dom.setGeometry(m.viewport, { width: 800, height: 600 }); dom.fireResize(); m.workspace.refresh(); dom.raf.drain();
    expect(m.cameras).toHaveLength(cameraWrites); expect(dom.raf.pending()).toBe(0);
  });

  it('does not move the camera when a resized viewport leaves the active title reachable', () => {
    const m = smallPopup(); m.workspace.open('donna'); dom.raf.drain();
    const camera = m.getCamera(), writes = m.cameras.length, geometry = rect(m.panel('donna'));
    dom.setGeometry(m.viewport, { width: 1600, height: 1000 }); dom.fireResize(); m.workspace.refresh(); dom.raf.drain();
    expect(m.getCamera()).toEqual(camera); expect(m.cameras).toHaveLength(writes);
    expect(rect(m.panel('donna'))).toEqual(geometry);
  });

  it('keeps an Ownership-size popup inside host insets after subsequent surface refreshes', () => {
    const element = document.createElement('section'); document.body.append(element);
    const viewport = { width: 1440, height: 900 }, insets = { top: 150, bottom: 150, left: 16, right: 16 };
    const m = mount({ viewport, insets, camera: { ...DEFAULT_CAMERA, x: 560, y: 380, zoom: 1 },
      specs: [{ id: 'workspace-softboard', title: 'People & ownership', element,
        rect: { x: 2120, y: 3500, width: 1040, height: 720 } }] });
    m.workspace.open('workspace-softboard'); m.workspace.refresh(); dom.raf.drain();
    const geometry = rect(m.panel('workspace-softboard')), camera = m.getCamera();
    expect(geometry).toEqual({ x: 40, y: 20, width: 1040, height: 720 });
    for (let i = 0; i < 5; i++) { m.workspace.refresh(); dom.fireResize(); dom.raf.drain(); }
    expect(m.getCamera()).toEqual(camera); expect(rect(m.panel('workspace-softboard'))).toEqual(geometry);
    for (const x of [geometry.x, geometry.x + geometry.width]) for (const y of [geometry.y, geometry.y + geometry.height]) {
      const screen = worldToScreen(camera, viewport, { x, y });
      expect(screen.x).toBeGreaterThanOrEqual(insets.left - 1e-5);
      expect(screen.x).toBeLessThanOrEqual(viewport.width - insets.right + 1e-5);
      expect(screen.y).toBeGreaterThanOrEqual(insets.top - 1e-5);
      expect(screen.y).toBeLessThanOrEqual(viewport.height - insets.bottom + 1e-5);
    }
  });
});

describe('canvas gestures and camera ownership', () => {
  it('frames the title and resize controls between the host navigation instruments', () => {
    const vp={width:1280,height:900}, inset={top:150,bottom:170,left:16,right:16};
    const m=mount({viewport:vp,insets:inset});m.workspace.open('models',{nearCamera:false});dom.raf.drain();
    const camera=m.getCamera();
    const a=worldToScreen(camera,vp,{x:4000,y:5000}),b=worldToScreen(camera,vp,{x:4900,y:5700});
    expect(a.y).toBeGreaterThanOrEqual(inset.top);expect(b.y).toBeLessThanOrEqual(vp.height-inset.bottom);
    expect(a.x).toBeGreaterThanOrEqual(inset.left);expect(b.x).toBeLessThanOrEqual(vp.width-inset.right);
  });

  it('gives a fresh phone surface a readable width and keeps saved or pinned geometry', () => {
    const saved=store();const vp={width:390,height:844};
    const m=mount({storage:saved.storage,viewport:vp,insets:{top:142,bottom:210,left:16,right:16}});
    m.workspace.open('models');dom.raf.drain();
    expect(parseFloat(m.panel('models').style.width)).toBe(358);
    expect(m.getCamera().zoom).toBeGreaterThan(.9);
    const width=m.panel('models').style.width;m.control('models','.canvas-panel-pin').click();
    dom.setGeometry(m.viewport,{width:330,height:620});m.workspace.close('models');m.workspace.open('models');
    expect(m.panel('models').style.width).toBe(width);
    const restored=mount({storage:saved.storage,viewport:{width:330,height:620}});restored.workspace.open('models');
    expect(restored.panel('models').style.width).toBe(width);
  });

  it('commits drag once on release, captures the pointer and preserves form contents', () => {
    const saved = store(); const m = mount({ storage: saved.storage });
    const grip = m.control('donna', '.canvas-panel-grip');
    dom.pointer(grip, 'pointerdown', { x: 100, y: 100 }); const writes = saved.writes();
    dom.pointer(grip, 'pointermove', { x: 180, y: 150 }); dom.pointer(grip, 'pointermove', { x: 200, y: 160 });
    expect(m.panel('donna').style.transform.replaceAll(' ', '')).toContain('120px,90px');
    expect(saved.writes()).toBe(writes);
    dom.pointer(grip, 'pointerup', { x: 200, y: 160 });
    expect(saved.writes()).toBe(writes + 1); expect(dom.capture.set.size).toBe(0);
    expect(m.input.value).toBe('Keep this draft');
  });

  it('cancels drag on Escape, lost capture and hidden tab without persisting temporary geometry', () => {
    for (const reason of ['escape', 'lost', 'hidden']) {
      const saved = store(); const m = mount({ storage: saved.storage });
      const grip = m.control('donna', '.canvas-panel-grip'), before = m.panel('donna').style.transform;
      dom.pointer(grip, 'pointerdown', { x: 100, y: 100 }); const writes = saved.writes();
      dom.pointer(grip, 'pointermove', { x: 500, y: 400 });
      if (reason === 'escape') dom.key(grip, 'Escape');
      else if (reason === 'lost') dom.pointer(grip, 'lostpointercapture', { x: 500, y: 400 });
      else dom.setHidden(true);
      expect(m.panel('donna').style.transform).toBe(before); expect(saved.writes()).toBe(writes);
      expect(dom.capture.set.size).toBe(0);
      dom.setHidden(false); m.workspace.destroy();
    }
  });

  it('does not swallow an unrelated close click after pointer cancellation or drag release', () => {
    const m = mount(); const grip = m.control('donna', '.canvas-panel-grip');
    dom.pointer(grip, 'pointerdown', { x: 100, y: 100 }); dom.pointer(grip, 'pointermove', { x: 150, y: 150 }); dom.pointer(grip, 'pointercancel', { x: 150, y: 150 });
    m.control('donna', '.canvas-panel-close').click(); expect(m.workspace.isOpen('donna')).toBe(false);
    m.workspace.open('donna', { frame: false });
    dom.pointer(grip, 'pointerdown', { x: 100, y: 100 }); dom.pointer(grip, 'pointermove', { x: 150, y: 150 }); dom.pointer(grip, 'pointerup', { x: 150, y: 150 });
    m.control('donna', '.canvas-panel-close').click(); expect(m.workspace.isOpen('donna')).toBe(false);
  });

  it('locks movement and resize while still allowing collapse, expansion and close', () => {
    const m = mount(); const grip = m.control('donna', '.canvas-panel-grip'); const before = m.panel('donna').style.transform;
    m.control('donna', '.canvas-panel-pin').click();
    dom.pointer(grip, 'pointerdown', { x: 100, y: 100 }); dom.pointer(grip, 'pointermove', { x: 500, y: 400 }); dom.pointer(grip, 'pointerup', { x: 500, y: 400 });
    dom.key(grip, 'ArrowRight', { shiftKey: true });
    expect(m.panel('donna').style.transform).toBe(before);
    expect(m.panel('donna').style.width).toBe('800px'); expect(m.panel('donna').style.height).toBe('600px');
    expect(m.control('donna', '.canvas-panel-resize').disabled).toBe(true);
    m.control('donna', '.canvas-panel-collapse').click(); expect(m.panel('donna').style.height).toBe('48px');
    m.workspace.open('donna', { frame: false }); expect(m.panel('donna').style.height).toBe('600px');
    m.control('donna', '.canvas-panel-close').click(); expect(m.workspace.isOpen('donna')).toBe(false);
  });

  it('supports keyboard move/resize and pointer resize without changing the live draft', () => {
    const m = mount(); dom.key(m.control('donna', '.canvas-panel-grip'), 'ArrowRight', { shiftKey: true });
    expect(m.panel('donna').style.transform.replaceAll(' ', '')).toContain('120px,30px');
    const resize = m.control('donna', '.canvas-panel-resize'); dom.key(resize, 'ArrowDown');
    expect(m.panel('donna').style.height).toBe('620px');
    dom.pointer(resize, 'pointerdown', { x: 100, y: 100 }); dom.pointer(resize, 'pointermove', { x: 200, y: 180 }); dom.pointer(resize, 'pointerup', { x: 200, y: 180 });
    expect(m.panel('donna').style.width).toBe('900px'); expect(m.panel('donna').style.height).toBe('700px');
    expect(m.input.value).toBe('Keep this draft');
  });

  it('does not steal keyboard or wheel events from editable surface content', () => {
    const m = mount(); m.input.focus(); const before = m.panel('donna').style.transform;
    const event = dom.key(m.input, 'ArrowRight');
    expect(event.defaultPrevented).toBe(false); expect(m.panel('donna').style.transform).toBe(before);
    m.workspace.open('models'); expect(dom.raf.pending()).toBe(1);
    dom.wheel(m.input, { x: 200, y: 200, deltaY: 100 }); expect(dom.raf.pending()).toBe(0);
  });

  it('uses one cancellable flight, caps readable zoom and settles at top view', () => {
    const m = mount({ camera: { ...DEFAULT_CAMERA, yaw: 45, pitch: 35 } });
    m.workspace.open('models'); m.workspace.open('donna');
    expect(dom.raf.pending()).toBe(1); dom.raf.drain();
    expect(dom.raf.pending()).toBe(0); expect(m.getCamera().pitch).toBe(0); expect(m.getCamera().yaw).toBe(0);
    expect(m.getCamera().zoom).toBeLessThanOrEqual(1.25); expect(m.stops()).toBeGreaterThan(0);
  });

  it('stops flight on pointer interaction, Escape, blur and hidden tab', () => {
    const m = mount();
    for (const reason of ['pointer', 'escape', 'blur', 'hidden']) {
      m.workspace.open('models'); expect(dom.raf.pending()).toBe(1);
      if (reason === 'pointer') dom.pointer(m.viewport, 'pointerdown', { x: 20, y: 20 });
      if (reason === 'escape') dom.key(m.viewport, 'Escape');
      if (reason === 'blur') window.dispatchEvent(new Event('blur'));
      if (reason === 'hidden') dom.setHidden(true);
      expect(dom.raf.pending()).toBe(0); dom.setHidden(false);
    }
  });

  it('respects reduced motion and defers framing until viewport measurement exists', () => {
    dom.setReducedMotion(true); const m = mount({ measure: false });
    m.workspace.open('models', {nearCamera:false}); expect(m.cameras).toHaveLength(0); expect(dom.raf.pending()).toBe(0);
    dom.setGeometry(m.viewport, { width: 390, height: 680 }); m.workspace.refresh();
    expect(m.cameras).toHaveLength(1); expect(m.getCamera().x).toBe(4450); expect(dom.raf.pending()).toBe(0);
  });

  it('reveals an offscreen keyboard-focused surface while pointer focus does not fight the camera', () => {
    const m = mount(); const input = document.createElement('input'); m.second.append(input);
    m.workspace.open('models', { frame: false, nearCamera: false }); dom.pointer(input, 'pointerdown', { x: 20, y: 20 }); input.focus();
    expect(dom.raf.pending()).toBe(0);
    m.input.focus(); dom.advanceTime(400); dom.key(m.input, 'Tab'); input.focus();
    expect(dom.raf.pending()).toBe(1);
  });

  it('Home returns to the canvas without closing surfaces or discarding forms', () => {
    const m = mount(); m.workspace.open('models'); (m.host.querySelector('.canvas-home') as HTMLButtonElement).click();
    expect(m.homes()).toBe(1); expect(m.shows()).toBeGreaterThan(0); expect(dom.raf.pending()).toBe(0);
    expect(m.workspace.isOpen('models')).toBe(true); expect(m.input.value).toBe('Keep this draft');
  });
});

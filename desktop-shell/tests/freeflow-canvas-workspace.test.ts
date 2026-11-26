// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
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
  return { workspace, host, viewport, world, origin, first, second, input, panel, control, cameras, changes, getCamera: () => camera, stops: () => stops, shows: () => shows, homes: () => homes };
}

describe('one live DOM canvas workspace', () => {
  it('expands only on an explicit size request, preserves the live draft and respects the lock', () => {
    const m = mount();
    m.workspace.open('donna', { frame: false, size: { width: 1120, height: 820 } });
    expect(m.panel('donna').style.width).toBe('1120px');
    expect(m.panel('donna').style.height).toBe('820px');
    expect(m.input.value).toBe('Keep this draft');
    m.control('donna', '.canvas-panel-pin').click();
    m.workspace.open('donna', { frame: false, size: { width: 1200, height: 900 } });
    expect(m.panel('donna').style.width).toBe('1120px');
    expect(m.host.querySelector('.canvas-layout-status')!.textContent).toContain('Unlock this surface');
  });

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

  it('keeps lock and storage notices passive beneath the surface finder without discarding live feedback', () => {
    const style = document.createElement('style');
    style.textContent = ['freeflow.css', 'canvas-craft.css'].map(name => readFileSync(path.resolve(__dirname, '../src/renderer', name), 'utf8')).join('\n');
    document.head.append(style); document.documentElement.dataset.theme = 'blueprint'; document.body.classList.add('endless-canvas');
    const blocked = { getItem() { return null; }, setItem() { throw Error('quota'); } } as unknown as Storage;
    for (const storage of [null, blocked]) {
      const m = mount({ storage });
      if (!storage) {
        m.control('donna', '.canvas-panel-pin').click();
        dom.key(m.control('donna', '.canvas-panel-grip'), 'ArrowRight');
      } else m.workspace.open('models', { frame: false });
      const status = m.host.querySelector('.canvas-layout-status') as HTMLElement;
      const feedback = status.textContent;
      expect(feedback).toContain(storage ? 'this session' : 'Unlock this surface');
      (m.host.querySelector('.canvas-find') as HTMLButtonElement).click();
      const palette = m.host.querySelector('.canvas-palette') as HTMLElement;
      const statusStyle = dom.window.getComputedStyle(status), paletteStyle = dom.window.getComputedStyle(palette);
      expect(palette.hidden).toBe(false);
      expect(statusStyle.pointerEvents).toBe('none');
      expect(Number(paletteStyle.zIndex)).toBeGreaterThan(Number(statusStyle.zIndex));
      expect(status.getAttribute('role')).toBe('status'); expect(status.getAttribute('aria-live')).toBe('polite');
      expect(status.textContent).toBe(feedback);
      const search = palette.querySelector('input')!; search.value = 'models'; search.dispatchEvent(new Event('input'));
      (palette.querySelector('[data-canvas-open="models"]') as HTMLButtonElement).click();
      expect(m.workspace.isOpen('models')).toBe(true); expect(palette.hidden).toBe(true);
      m.workspace.destroy();
    }
  });

  it('positions a new panel near the camera only once and preserves later parking', () => {
    const saved = store(); const m = mount({ storage: saved.storage, camera: { ...DEFAULT_CAMERA, x: 2000, y: 1000 } });
    m.workspace.open('models', { frame: false, nearCamera: true });
    const firstPosition = m.panel('models').style.transform;
    expect(firstPosition.replaceAll(' ', '')).toContain('1550px,650px');
    m.workspace.close('models'); m.workspace.open('models', { frame: false, nearCamera: true });
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

describe('canvas gestures and camera ownership', () => {
  it('frames the title and resize controls between the host navigation instruments', () => {
    const vp={width:1280,height:900}, inset={top:150,bottom:170,left:16,right:16};
    const m=mount({viewport:vp,insets:inset});m.workspace.open('models');dom.raf.drain();
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
    m.workspace.open('models'); expect(m.cameras).toHaveLength(0); expect(dom.raf.pending()).toBe(0);
    dom.setGeometry(m.viewport, { width: 390, height: 680 }); m.workspace.refresh();
    expect(m.cameras).toHaveLength(1); expect(m.getCamera().x).toBe(4450); expect(dom.raf.pending()).toBe(0);
  });

  it('reveals an offscreen keyboard-focused surface while pointer focus does not fight the camera', () => {
    const m = mount(); const input = document.createElement('input'); m.second.append(input);
    m.workspace.open('models', { frame: false }); dom.pointer(input, 'pointerdown', { x: 20, y: 20 }); input.focus();
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

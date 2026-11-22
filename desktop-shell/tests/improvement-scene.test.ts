import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { installDom, type FreeflowDom } from './fixtures/freeflow-dom.js';
import { mountStudio, type Studio } from '../src/renderer/freeflow/studio.js';
import type { FreeflowSnapshot } from '../src/renderer/freeflow/model.js';
import type { StickyNote } from '../src/renderer/improvement/model.js';
let dom: FreeflowDom, studio: Studio | null;
beforeEach(() => { dom = installDom(); studio = null; });
afterEach(() => { studio?.destroy(); dom.restore(); });
const note: StickyNote = { id: 'native-note', revision: 0, companyId: 'a', officeId: 'o', departmentId: null, text: '<b>Saved comment</b>', kind: 'comment', color: 'pink', status: 'open', ownerEmployeeId: 'e', goalIds: [], x: .8, y: .2, createdAt: '', updatedAt: '' };
const snapshot: FreeflowSnapshot = { companies: [{ id: 'a', name: 'Company', status: 'active' }], offices: [{ id: 'o', companyId: 'a', name: 'Office', status: 'active' }],
  departments: [{ id: 'd', companyId: 'a', officeId: 'o', name: 'Department', status: 'active' }], employees: [{ id: 'e', companyId: 'a', officeId: 'o', departmentId: 'd', name: 'Employee', role: 'Engineer', kind: 'specialist', status: 'active' }],
  jobs: [], stickyNotes: [note], blueprints: [{ id: 'bp', companyId: 'a', officeId: 'o', rooms: [{ id: 'r', name: 'Room', departmentId: 'd', x: .1, y: .1, width: .5, height: .5 }], desks: [{ id: 'desk', roomId: 'r', employeeId: 'e', x: .3, y: .5 }], whiteboards: [] }] };
function mount(activity: () => { state: string; label: string; executing: number | null }, heat?: Parameters<typeof mountStudio>[1]['heat']) {
  const host = document.createElement('div'); document.body.append(host); const actions: unknown[] = [];
  studio = mountStudio(host, { continuousCanvas: true, storage: null, onNavigate: () => {}, onAction: (action, context) => actions.push({ action, context }), activity, heat });
  dom.setGeometry(studio.elements.canvasHost, { width: 1440, height: 900, top: 0, left: 0 }); dom.fireResize();
  studio.update(snapshot, { kind: 'company', companyId: 'a' }); dom.raf.drain(); return { host, actions };
}
describe('saved notes and truthful activity in the mounted shared world', () => {
  it('keeps the native work count visible with full details in accessible evidence instead of a room-sized ribbon', () => {
    const label='4 unresolved jobs',metric='4 queued · 0 recorded running. Counts describe saved work, not worker capacity or CPU use.';
    const before=JSON.stringify(snapshot);
    const {host}=mount(()=>({state:'queued',label:'4 queued',executing:0}),()=>({level:2,label,metric}));
    for(const kind of ['office','room']) {
      const node=host.querySelector<HTMLElement>(`.ff-node--${kind}`)!,badge=node.querySelector<HTMLElement>('.ff-node-heat')!;
      expect(badge.textContent).toBe(label);expect(badge.title).toBe(`${label} · ${metric}`);expect(badge.getAttribute('aria-label')).toBe(badge.title);
      expect(node.getAttribute('aria-label')).toContain(metric);expect(node.dataset.heatPlacement).toBe('footer');
      expect(node.querySelector('.ff-node-title')?.textContent).toBe(kind==='office'?'Office':'Room');
    }
    expect(JSON.stringify(snapshot)).toBe(before);expect(host.querySelector('.ff-node--employee .ff-node-monogram')).not.toBeNull();
  });
  it('keeps count-based live floor light contained, bounded, and absent for zero or stale activity', () => {
    let evidence = { state: 'quiet', label: 'No recorded leased work', executing: 0 as number | null };
    const {host}=mount(()=>evidence),room=host.querySelector<HTMLElement>('.ff-node--room')!;
    const bounds=room.style.cssText.replace(/--activity-light:[^;]+;/,'');
    expect(room.style.getPropertyValue('--activity-light')).toBe('0');
    expect(room.querySelector('.ff-node-paper > .ff-activity-floor')).not.toBeNull();
    evidence={state:'running',label:'1 active provider call · fresh runtime evidence',executing:1};studio!.update(snapshot);dom.raf.drain();
    const one=Number(room.style.getPropertyValue('--activity-light'));expect(one).toBeGreaterThan(0);expect(room.textContent).toContain('1 live call');
    evidence={state:'running',label:'1000 active provider calls · fresh runtime evidence',executing:1000};studio!.update(snapshot);dom.raf.drain();
    const many=Number(room.style.getPropertyValue('--activity-light'));expect(many).toBeGreaterThan(one);expect(many).toBeLessThanOrEqual(.30);expect(room.textContent).toContain('1000 live calls');
    expect(room.style.cssText.replace(/--activity-light:[^;]+;/,'')).toBe(bounds);
    evidence={state:'unknown',label:'Stale execution evidence',executing:null};studio!.update(snapshot);dom.raf.drain();
    expect(room.style.getPropertyValue('--activity-light')).toBe('0');expect(room.querySelector('.ff-activity-count')).toBeNull();
    dom.setReducedMotion(true);dom.setHidden(true);expect(dom.raf.pending()).toBe(0);
  });
  it('renders a literal colored note with its native identity and routes keyboard open to the same scoped editor', () => {
    const { host, actions } = mount(() => ({ state: 'quiet', label: 'No recorded leased work', executing: null }));
    const card = host.querySelector<HTMLElement>('.ff-node--sticky')!; expect(card).not.toBeNull();
    expect(card.dataset.nodeId).toBe('sticky:native-note'); expect(card.textContent).toContain('<b>Saved comment</b>'); expect(card.querySelector('b')).toBeNull();
    expect(card.style.getPropertyValue('--sticky-color')).toBe('#f1ccda');
    dom.key(card, 'Enter'); expect(actions).toEqual([{ action: 'notes', context: { companyId: 'a', officeId: 'o', departmentId: undefined, noteId: 'native-note', nodeId: 'sticky:native-note' } }]);
    studio!.update({ ...snapshot, stickyNotes: [{ ...note, color: 'blue', revision: 1 }] }, { kind: 'company', companyId: 'a' }); dom.raf.drain();
    expect(host.querySelector<HTMLElement>('.ff-node--sticky')!.style.getPropertyValue('--sticky-color')).toBe('#c9e0f1');
  });
  it('keeps one flat person identity while fresh execution state changes, and stops scheduled work when hidden', () => {
    let evidence = { state: 'preparing', label: '1 leased / preparing · execution not confirmed', executing: null as number | null };
    const { host } = mount(() => evidence); const person = host.querySelector<HTMLElement>('.ff-node--employee')!;
    expect(person).not.toBeNull(); expect(person.dataset.activity).toBe('preparing'); expect(person.querySelector('.ff-node-monogram')).not.toBeNull();
    evidence = { state: 'running', label: '1 active provider calls · fresh runtime evidence', executing: 1 }; studio!.update(snapshot); dom.raf.drain();
    expect(host.querySelector('.ff-node--employee')).toBe(person); expect(person.dataset.activity).toBe('running'); expect(person.getAttribute('aria-label')).toContain('fresh runtime evidence');
    evidence = { state: 'unknown', label: 'Snapshot stale · current activity unknown', executing: null }; studio!.update(snapshot); dom.raf.drain();
    expect(person.dataset.activity).toBe('unknown'); dom.setHidden(true); expect(dom.raf.pending()).toBe(0);
  });
});

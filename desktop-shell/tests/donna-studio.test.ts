// @vitest-environment node
import { afterEach, beforeEach, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { installDom, type FreeflowDom } from './fixtures/freeflow-dom.js';
import { mountDonnaStudio, type DonnaStudioState } from '../src/renderer/donna-studio.js';
import { appendDonnaDraft } from '../src/renderer/resource-library/model.js';

let dom: FreeflowDom;
beforeEach(() => { dom = installDom(); });
afterEach(() => dom.restore());
function mount() {
  const template = document.createElement('template');
  template.innerHTML = readFileSync(path.resolve(__dirname, '../src/renderer/chrome.html'), 'utf8');
  const host = template.content.querySelector<HTMLElement>('#donna-conversation')!;
  document.body.append(host);
  const input = host.querySelector<HTMLTextAreaElement>('#chat-message')!;
  let submits = 0;
  host.querySelector('form')!.addEventListener('submit', event => { event.preventDefault(); submits++; });
  const surfaces: string[] = [];
  const panel = mountDonnaStudio(host, {
    addDraft: text => { const next = appendDonnaDraft(input.value, text); if (next === null) throw Error('Draft is full.'); input.value = next; },
    openSurface: name => surfaces.push(name), expand: () => surfaces.push('expand'),
  });
  const click = (selector: string) => host.querySelector<HTMLButtonElement>(selector)!.click();
  return { host, input, panel, click, surfaces, submits: () => submits };
}
const empty: DonnaStudioState = { scope: 'Select a company', available: false, transport: 'cloud-browser', employeeCount: null, openGoals: null, recordedRunning: null, messageCount: null, runtime: null, recentGoals: [] };

it('keeps the exact draft and one conversation through view changes and DOM reparenting', () => {
  const m = mount(); m.input.value = 'Keep my unsent design constraints.';
  m.click('[data-donna-view="thread"]');
  expect(m.host.querySelector<HTMLElement>('#donna-brief-view')!.hidden).toBe(true);
  const dock = document.createElement('aside'); document.body.append(dock); dock.append(m.host);
  m.click('[data-donna-view="studio"]'); m.click('[data-donna-preset="blender"]');
  expect(m.input.value).toContain('Keep my unsent design constraints.');
  expect(m.input.value).toContain('Blender');
  expect(m.host.querySelector<HTMLElement>('#donna-brief-view')!.hidden).toBe(false);
  expect(document.querySelectorAll('#chat-message')).toHaveLength(1);
  expect(document.querySelectorAll('#donna-conversation')).toHaveLength(1);
  expect(document.activeElement).toBe(m.input); expect(m.submits()).toBe(0);
});

it('prepares bounded briefs without granting execution or replacing a full draft', () => {
  const m = mount();
  const authorized = m.host.querySelector<HTMLInputElement>('#chat-authorized')!;
  const mode = m.host.querySelector<HTMLSelectElement>('#chat-goal-mode')!;
  m.click('[data-donna-preset="moe"]');
  expect(m.input.value).toContain('8,192-token context');
  expect(authorized.checked).toBe(false); expect(mode.value).toBe('manual'); expect(m.submits()).toBe(0);
  m.input.value = 'x'.repeat(10000); m.click('[data-donna-preset="unreal"]');
  expect(m.input.value).toBe('x'.repeat(10000));
  expect(m.host.querySelector('#chat-status')!.textContent).toContain('Draft is full');
});

it('uses accessible keyboard tabs and leaves model setup as navigation only', () => {
  const m = mount(), brief = m.host.querySelector<HTMLButtonElement>('#donna-tab-brief')!;
  dom.key(brief, 'End');
  expect(m.host.querySelector('#donna-tab-studio')!.getAttribute('aria-selected')).toBe('true');
  expect(document.activeElement?.id).toBe('donna-tab-studio');
  m.click('[data-donna-surface="models"]');
  expect(m.surfaces).toEqual(['models']); expect(m.submits()).toBe(0);
  dom.key(document.activeElement!, 'Home');
  expect(document.activeElement).toBe(brief);
  expect(brief.tabIndex).toBe(0);
});

it('preserves a newer draft while a reply arrives, and restores visible focus for a completed send', () => {
  const m = mount(); m.input.value = 'First brief';
  const submitted = m.input.value;
  m.click('[data-donna-preset="blender"]');
  expect(m.panel.completeDraft(submitted)).toBe(false);
  expect(m.input.value).toContain('Blender');
  expect(m.host.dataset.donnaView).toBe('brief');
  const next = m.input.value; m.input.focus();
  expect(m.panel.completeDraft(next)).toBe(true);
  expect(m.input.value).toBe(''); expect(m.host.dataset.donnaView).toBe('thread');
  expect(document.activeElement?.id).toBe('donna-tab-thread');
  m.input.value = 'Later brief'; m.panel.show('studio');
  m.panel.completeDraft('Later brief');
  expect(m.host.dataset.donnaView).toBe('studio');
});

it('distinguishes missing records, saved definitions and actual worker reports, and treats goal text as text', () => {
  const m = mount(); m.panel.refresh(empty);
  expect(m.host.querySelector('#donna-crew-count')!.textContent).toBe('—');
  expect(m.host.querySelector('#donna-runtime-label')!.textContent).toBe('Runtime status unavailable');
  m.panel.refresh({ ...empty, available: true, scope: 'Design · company', employeeCount: 8, openGoals: 1, recordedRunning: 0, messageCount: 2,
    runtime: { enabled: false, running: false }, recentGoals: [{ title: '<img src=x onerror=alert(1)>', status: 'planned' }] });
  expect(m.host.querySelector('#donna-crew-count')!.textContent).toBe('8');
  expect(m.host.querySelector('#donna-running-count')!.textContent).toBe('0');
  expect(m.host.querySelector('#donna-runtime-label')!.textContent).toBe('Dispatcher paused');
  expect(m.host.querySelector('#donna-recent-goals img')).toBeNull();
  expect(m.host.querySelector('#donna-recent-goals')!.textContent).toContain('<img');
  expect(m.host.textContent).not.toMatch(/GPU online|MoE running|Unreal ready/);
  m.panel.refresh({ ...empty, available: true, transport: 'public-preview' });
  expect(m.host.querySelector('#donna-connection-label')!.textContent).toBe('Example · read only');
});

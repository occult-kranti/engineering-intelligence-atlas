// Accessible, searchable navigator list covering ALL scene nodes (paginated, no reachability cap).
// Constructs everything with textContent; no bridge or network access; no animation.
//
// DOM CLASS CONTRACT:
//   .ff-list                 root; .ff-list-search (input type=search, labelled)
//   .ff-list-count          live region (role=status) with result count
//   .ff-list-items          <ul>; .ff-list-item <li> containing button.ff-list-button[data-node-id]
//   .ff-list-button.is-selected  aria-pressed reflects selection; .ff-list-kind .ff-list-name .ff-list-meta
//   .ff-list-pager          nav with .ff-list-prev .ff-list-next buttons and .ff-list-page text
//   .ff-list-empty          shown when no matches

import type { FreeflowScene, SceneNode } from './model.js';

export const LIST_PAGE_SIZE = 50;

export interface ListCallbacks {
  onSelect?(nodeId: string | null, node: SceneNode | null): void;
  onOpen?(node: SceneNode): void;
}

export interface A11yList {
  update(scene: FreeflowScene | null): void;
  setSelected(nodeId: string | null): void;
  setQuery(q: string): void;
  destroy(): void;
  elements: { root: HTMLElement; search: HTMLInputElement; count: HTMLElement; list: HTMLUListElement };
  resultCount(): number;
}

function searchText(n: SceneNode): string {
  return `${n.label} ${n.subtitle} ${n.kind} ${n.status}`.toLowerCase();
}

export function filterNodes(nodes: readonly SceneNode[], query: string): SceneNode[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [...nodes];
  return nodes.filter((n) => { const t = searchText(n); return terms.every((x) => t.includes(x)); });
}

export function mountA11yList(host: HTMLElement, callbacks: ListCallbacks = {}, pageSize = LIST_PAGE_SIZE): A11yList {
  const root = document.createElement('section');
  root.className = 'ff-list';
  root.setAttribute('aria-label', 'Office navigator');
  const search = document.createElement('input');
  search.type = 'search';
  search.className = 'ff-list-search';
  search.setAttribute('aria-label', 'Search by name, role or kind');
  search.placeholder = 'Search name, role or kind';
  const count = document.createElement('div');
  count.className = 'ff-list-count';
  count.setAttribute('role', 'status');
  const list = document.createElement('ul');
  list.className = 'ff-list-items';
  const empty = document.createElement('p');
  empty.className = 'ff-list-empty';
  empty.hidden = true;
  const pager = document.createElement('nav');
  pager.className = 'ff-list-pager';
  pager.setAttribute('aria-label', 'Result pages');
  const prev = document.createElement('button');
  prev.type = 'button'; prev.className = 'ff-list-prev'; prev.textContent = 'Previous';
  const next = document.createElement('button');
  next.type = 'button'; next.className = 'ff-list-next'; next.textContent = 'Next';
  const pageLabel = document.createElement('span');
  pageLabel.className = 'ff-list-page';
  pager.append(prev, pageLabel, next);
  root.append(search, count, list, empty, pager);
  host.appendChild(root);

  let nodes: SceneNode[] = [];
  let results: SceneNode[] = [];
  let page = 0;
  let selected: string | null = null;
  let destroyed = false;
  let lastFocus: FreeflowScene['focus'] | null = null; // per-mount scope memory
  const size = Math.max(1, Math.floor(pageSize));

  function render(): void {
    if (destroyed) return;
    const pages = Math.max(1, Math.ceil(results.length / size));
    page = Math.min(Math.max(0, page), pages - 1);
    const slice = results.slice(page * size, page * size + size);
    const activeId = (document.activeElement as HTMLElement | null)?.dataset?.nodeId ?? null;
    list.replaceChildren();
    for (const n of slice) {
      const li = document.createElement('li');
      li.className = 'ff-list-item';
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `ff-list-button${n.id === selected ? ' is-selected' : ''}`;
      b.dataset.nodeId = n.id;
      b.setAttribute('aria-pressed', String(n.id === selected));
      b.setAttribute('aria-label', `${n.kind} ${n.label}${n.subtitle ? `, ${n.subtitle}` : ''}, status ${n.status}. Enter to open.`);
      const kind = document.createElement('span'); kind.className = 'ff-list-kind'; kind.textContent = n.kind;
      const name = document.createElement('span'); name.className = 'ff-list-name'; name.textContent = n.label;
      const meta = document.createElement('span'); meta.className = 'ff-list-meta'; meta.textContent = [n.subtitle, n.status].filter(Boolean).join(' · ');
      b.append(kind, name, meta);
      li.appendChild(b);
      list.appendChild(li);
    }
    const from = results.length ? page * size + 1 : 0;
    const to = Math.min(results.length, page * size + slice.length);
    count.textContent = results.length === nodes.length
      ? `${nodes.length} records${results.length > size ? `, showing ${from}–${to}` : ''}`
      : `${results.length} of ${nodes.length} records match${results.length > size ? `, showing ${from}–${to}` : ''}`;
    empty.hidden = results.length > 0;
    empty.textContent = nodes.length ? 'No records match this search.' : 'No records in this scope.';
    pager.hidden = pages <= 1;
    pageLabel.textContent = `Page ${page + 1} of ${pages}`;
    prev.disabled = page <= 0;
    next.disabled = page >= pages - 1;
    if (activeId) (list.querySelector(`[data-node-id="${CSS.escape ? CSS.escape(activeId) : activeId}"]`) as HTMLElement | null)?.focus?.({ preventScroll: true });
  }

  function refilter(): void { results = filterNodes(nodes, search.value); render(); }

  const onInput = () => { page = 0; refilter(); };
  const onSearchKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { if (search.value) { search.value = ''; page = 0; refilter(); } else { selected = null; render(); callbacks.onSelect?.(null, null); } }
  };
  const find = (t: EventTarget | null) => {
    const id = (t as HTMLElement | null)?.closest?.('.ff-list-button')?.getAttribute('data-node-id') ?? null;
    return id ? nodes.find((n) => n.id === id) ?? null : null;
  };
  const onClick = (e: MouseEvent) => {
    const n = find(e.target);
    if (!n) return;
    selected = n.id; render(); callbacks.onSelect?.(n.id, n);
  };
  const onKey = (e: KeyboardEvent) => {
    const n = find(e.target);
    if (!n) return;
    if (e.key === 'Enter') { e.preventDefault(); callbacks.onOpen?.(n); }
    else if (e.key === 'Escape') { selected = null; render(); callbacks.onSelect?.(null, null); }
  };
  const onPrev = () => { page--; render(); };
  const onNext = () => { page++; render(); };
  search.addEventListener('input', onInput);
  search.addEventListener('keydown', onSearchKey);
  list.addEventListener('click', onClick);
  list.addEventListener('keydown', onKey);
  prev.addEventListener('click', onPrev);
  next.addEventListener('click', onNext);
  render();

  return {
    elements: { root, search, count, list },
    update(scene) {
      if (destroyed) return;
      const sameScope = scene && nodes.length && scene.focus && JSON.stringify(scene.focus) === JSON.stringify(lastFocus);
      if (!sameScope) { search.value = ''; selected = null; page = 0; }
      lastFocus = scene ? scene.focus : null;
      nodes = scene ? [...scene.nodes].sort((a, b) => (a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : a.label.localeCompare(b.label) || (a.id < b.id ? -1 : 1))) : [];
      if (selected && !nodes.some((n) => n.id === selected)) selected = null;
      refilter();
    },
    setSelected(id) { selected = id; render(); },
    setQuery(q) { search.value = q; page = 0; refilter(); },
    resultCount: () => results.length,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      search.removeEventListener('input', onInput);
      search.removeEventListener('keydown', onSearchKey);
      list.removeEventListener('click', onClick);
      list.removeEventListener('keydown', onKey);
      prev.removeEventListener('click', onPrev);
      next.removeEventListener('click', onNext);
      nodes = []; results = []; root.remove();
    },
  };
}

export const mountList = mountA11yList;

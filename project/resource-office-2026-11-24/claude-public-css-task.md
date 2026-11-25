Continue the original public generic blueprint resource-room component you authored. Your prior response completed model.ts and panel.ts but hit the output limit at CSS. This is a new bounded CSS-only request. No repository/private context is included. Return ONLY complete CSS, no fences, max4500tokens. Use these exact class names from your own prior output: rl-actions, rl-body, rl-btn, rl-check, rl-checkbox, rl-close, rl-detail, rl-detail-title, rl-draft, rl-empty, rl-fact, rl-fact-k, rl-fact-v, rl-facts, rl-field, rl-head, rl-input, rl-label, rl-link, rl-list, rl-listregion, rl-nolink, rl-open, rl-pageinfo, rl-pager, rl-pin, rl-purpose, rl-root, rl-row, rl-row-meta, rl-row-title, rl-select, rl-spine, rl-status, rl-summary, rl-title, rl-toolbar.
Design a premium architectural reference room nested in an infinite company-office canvas: clear readable 16px text,14px labels,12px metadata,40px buttons. Semantic variables available: --canvas,--surface,--surface-soft,--elevated,--ink,--muted,--line,--line-strong,--accent,--accent-ink,--accent-soft,--brand-gold,--focus,--shadow-panel. No global style/palette overrides. Root container-type inline-size. Resource list + details split at >780px containerwidth and stack smaller. Small genre book-spine treatments using data-kind values books,papers,repositories,software,documentation,courses (check classdata from code below). Preserve [hidden] displaynone. Keyboard focus, status, pin states, mobile/laptop overflow, prefers-reduced-motion, forced-colors. No animations beyond subtle backgroundopacity. No remoteassets. Never use position:fixed or change parent camera. Do not claim tests. Here is only the markup builder you previously generated (public component proposal):
import {
 KINDS,
 MAX_PINS,
 PAGE_SIZE,
 PINS_KEY,
 buildDonnaDraft,
 collectSkills,
 countByKind,
 filterResources,
 normalizeCatalog,
 normalizePins,
 paginate,
} from "./model.js";
import type { Resource, ResourceKind } from "./model.js";

let instanceCounter = 0;

interface Options {
 onDraft: (text: string) => void;
 storage?: Storage;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
 const e = document.createElement(tag);
 if (cls) e.className = cls;
 if (text !== undefined) e.textContent = text;
 return e;
}

export function mountResourceLibrary(host: HTMLElement, input: unknown, options: Options): { destroy(): void } {
 const uid = "rl" + ++instanceCounter;
 const items = normalizeCatalog(input);
 const skills = collectSkills(items);
 const counts = countByKind(items);
 const storage = options && options.storage;

 let pins = new Set<string>();
 let pinNote = "";
 try {
 if (storage) {
 const raw = storage.getItem(PINS_KEY);
 pins = new Set(normalizePins(raw ? JSON.parse(raw) : []));
 } else {
 pinNote = "Storage unavailable: pins remain temporary for this session.";
 }
 } catch {
 pinNote = "Could not read saved pins: pins remain temporary for this session.";
 }

 const state = { search: "", kind: "all" as ResourceKind | "all", skill: "", pinnedOnly: false, page: 1, selected: null as string | null };
 let lastTrigger: HTMLElement | null = null;

 const root = el("section", "rl-root");
 root.setAttribute("aria-labelledby", uid + "-title");
 const head = el("header", "rl-head");
 const title = el("h2", "rl-title", "The reference room.");
 title.id = uid + "-title";
 const summary = el("p", "rl-summary");
 summary.id = uid + "-summary";
 summary.textContent = items.length
 ? items.length + " resources: " + KINDS.filter((k) => counts[k]).map((k) => counts[k] + " " + k).join(", ") + "."
 : "No resources loaded.";
 head.append(title, summary);

 const form = el("form", "rl-toolbar");
 form.setAttribute("role", "search");
 form.setAttribute("aria-label", "Filter resources");
 form.noValidate = true;

 const mkField = (label: string, control: HTMLElement, id: string) => {
 const w = el("div", "rl-field");
 const l = el("label", "rl-label", label);
 l.htmlFor = id;
 control.id = id;
 w.append(l, control);
 return w;
 };
 const search = el("input", "rl-input");
 search.type = "search";
 search.maxLength = 200;
 search.autocomplete = "off";
 search.placeholder = "Title, domain, tag, skill…";
 const kindSel = el("select", "rl-select");
 kindSel.append(new Option("All kinds", "all"));
 for (const k of KINDS) if (counts[k]) kindSel.append(new Option(k + " (" + counts[k] + ")", k));
 const skillSel = el("select", "rl-select");
 skillSel.append(new Option("All skills", ""));
 for (const s of skills) skillSel.append(new Option(s, s));
 const pinWrap = el("label", "rl-check");
 const pinBox = el("input", "rl-checkbox");
 pinBox.type = "checkbox";
 pinWrap.append(pinBox, el("span", "", "Pinned only"));
 form.append(
 mkField("Search", search, uid + "-q"),
 mkField("Category", kindSel, uid + "-k"),
 mkField("Skill", skillSel, uid + "-s"),
 pinWrap,
 );

 const status = el("p", "rl-status");
 status.setAttribute("role", "status");
 status.setAttribute("aria-live", "polite");
 const body = el("div", "rl-body");
 const listRegion = el("div", "rl-listregion");
 const detail = el("aside", "rl-detail");
 detail.setAttribute("aria-label", "Selected resource");
 body.append(listRegion, detail);
 root.append(head, form, status, body);
 host.append(root);

 function persistPins(): void {
 try {
 if (!storage) throw new Error("none");
 storage.setItem(PINS_KEY, JSON.stringify([...pins].slice(0, MAX_PINS)));
 pinNote = "";
 } catch {
 pinNote = "Could not save pins: they remain temporary for this session.";
 }
 }

 function togglePin(id: string): void {
 if (pins.has(id)) pins.delete(id);
 else if (pins.size < MAX_PINS) pins.add(id);
 else pinNote = "Pin limit of " + MAX_PINS + " reached.";
 persistPins();
 render();
 }

 function pinButton(r: Resource): HTMLButtonElement {
 const on = pins.has(r.id);
 const b = el("button", "rl-btn rl-pin", on ? "Unpin" : "Pin");
 b.type = "button";
 b.setAttribute("aria-pressed", String(on));
 b.setAttribute("aria-label", (on ? "Unpin " : "Pin ") + r.title);
 b.dataset.rlPin = r.id;
 return b;
 }

 function renderList(): void {
 listRegion.textContent = "";
 const filtered = filterResources(items, { search: state.search, kind: state.kind, skill: state.skill, pinnedOnly: state.pinnedOnly, pins });
 const pg = paginate(filtered, state.page, PAGE_SIZE);
 state.page = pg.page;
 status.textContent = (items.length ? pg.total + " of " + items.length + " resources shown." : "") + (pinNote ? " " + pinNote : "");
 if (!items.length) {
 listRegion.append(el("p", "rl-empty", "No usable resources were provided. The catalog is empty or malformed."));
 return;
 }
 if (!pg.total) {
 listRegion.append(el("p", "rl-empty", state.pinnedOnly && pins.size === 0 ? "Nothing pinned yet. Pin a resource to keep it here." : "No resources match these filters."));
 return;
 }
 const ul = el("ul", "rl-list");
 for (const r of pg.items) {
 const li = el("li", "rl-row");
 if (r.id === state.selected) li.classList.add("is-selected");
 li.dataset.kind = r.kind;
 li.append(el("span", "rl-spine"));
 const open = el("button", "rl-open");
 open.type = "button";
 open.dataset.rlOpen = r.id;
 open.setAttribute("aria-label", "Open details for " + r.title);
 open.setAttribute("aria-expanded", String(r.id === state.selected));
 open.append(el("span", "rl-row-title", r.title), el("span", "rl-row-meta", r.kind + " · " + r.domain + " · " + r.level));
 li.append(open, pinButton(r));
 ul.append(li);
 }
 const nav = el("nav", "rl-pager");
 nav.setAttribute("aria-label", "Resource pages");
 const prev = el("button", "rl-btn", "Previous");
 prev.type = "button";
 prev.disabled = pg.page <= 1;
 prev.dataset.rlPage = String(pg.page - 1);
 const next = el("button", "rl-btn", "Next");
 next.type = "button";
 next.disabled = pg.page >= pg.pageCount;
 next.dataset.rlPage = String(pg.page + 1);
 nav.append(prev, el("span", "rl-pageinfo", "Page " + pg.page + " of " + pg.pageCount), next);
 listRegion.append(ul, nav);
 }

 function field(dl: HTMLElement, k: string, v: string): void {
 const row = el("div", "rl-fact");
 row.append(el("dt", "rl-fact-k", k), el("dd", "rl-fact-v", v));
 dl.append(row);
 }

 function renderDetail(): void {
 detail.textContent = "";
 const r = items.find((x) => x.id === state.selected);
 detail.hidden = !r;
 if (!r) return;
 const h = el("h3", "rl-detail-title", r.title);
 h.id = uid + "-dt";
 h.tabIndex = -1;
 detail.setAttribute("aria-labelledby", h.id);
 const close = el("button", "rl-btn rl-close", "Close details");
 close.type = "button";
 close.dataset.rlClose = "1";
 close.setAttribute("aria-label", "Close details for " + r.title);
 detail.append(close, h, el("p", "rl-purpose", r.purpose));
 const dl = el("dl", "rl-facts");
 field(dl, "Domain", r.domain);
 field(dl, "Type", r.type + " (" + r.kind + ")");
 field(dl, "Prerequisites", r.prereqs);
 field(dl, "Version", r.version);
 field(dl, "Access", r.access);
 field(dl, "License", r.license);
 field(dl, "Review status", r.reviewStatus);
 field(dl, "Review date", r.reviewVerifiedAt);
 field(dl, "Catalog verified", r.verified);
 field(dl, "Caveat", r.caveat || "None recorded");
 if (r.skills.length) field(dl, "Skills", r.skills.join(", "));
 if (r.tags.length) field(dl, "Tags", r.tags.join(", "));
 detail.append(dl);
 const actions = el("div", "rl-actions");
 if (r.safeUrl) {
 const a = el("a", "rl-link", "Open source");
 a.href = r.safeUrl;
 a.target = "_blank";
 a.rel = "noopener noreferrer";
 a.setAttribute("aria-label", "Open source for " + r.title + " in a new tab");
 actions.append(a);
 } else {
 actions.append(el("span", "rl-nolink", r.url ? "Source is not a safe HTTPS link and is not active." : "No source link provided."));
 }
 const draft = el("button", "rl-btn rl-draft", "Draft with Donna");
 draft.type = "button";
 draft.dataset.rlDraft = r.id;
 draft.setAttribute("aria-label", "Draft with Donna about " + r.title);
 actions.append(draft, pinButton(r));
 detail.append(actions);
 }

 function render(): void {
 renderList();
 renderDetail();
 }

 function onClick(e: Event): void {
 const t = e.target instanceof Element ? e.target : null;
 if (!t) return;
 const btn = t.closest<HTMLElement>("button");
 if (!btn || !root.contains(btn)) return;
 const d = btn.dataset;
 if (d.rlOpen) {
 state.selected = d.rlOpen;
 lastTrigger = btn;
 render();
 const h = detail.querySelector<HTMLElement>("h3");
 if (h) h.focus();
 } else if (d.rlClose) {
 const id = state.selected;
 state.selected = null;
 render();
 const back = id ? listRegion.querySelector<HTMLElement>('[data-rl-open="' + CSS.escape(id) + '"]') : null;
 (back || (lastTrigger && lastTrigger.isConnected ? lastTrigger : search)).focus();
 } else if (d.rlPin) {
 const id = d.rlPin;
 const inDetail = detail.contains(btn);
 togglePin(id);
 const sel = inDetail ? detail : listRegion;
 const again = sel.querySelector<HTMLElement>('[data-rl-pin="' + CSS.escape(id) + '"]');
 if (again) again.focus();
 } else if (d.rlPage) {
 state.page = Number(d.rlPage) || 1;
 renderList();
 } else if (d.rlDraft) {
 const r = items.find((x) => x.id === d.rlDraft);
 if (r && options && typeof options.onDraft === "function") options.onDraft(buildDonnaDraft(r));
 }
 }

 function onFilter(): void {
 state.search = search.value;
 state.kind = (kindSel.value as ResourceKind | "all") || "all";
 state.skill = skillSel.value;
 state.pinnedOnly = pinBox.checked;
 state.page = 1;
 renderList();
 }
 function onSubmit(e: Event): void {
 e.preventDefault();
 }

 form.addEventListener("submit", onSubmit);
 form.addEventListener("input", onFilter);
 form.addEventListener("change", onFilter);
 root.addEventListener("click", onClick);
 render();

 return {
 destroy(): void {
 form.removeEventListener("submit", onSubmit);
 form.removeEventListener("input", onFilter);
 form.removeEventListener("change", onFilter);
 root.removeEventListener("click", onClick);
 root.remove();
 },
 };
}

import { buildDonnaBrain, brainEvidence, makeBrainNote, makeDonnaSetupDraft, readBrainNote } from './core.76e7261ab2fed7be.js';
import { BRAIN_KINDS, BRAIN_LIST_PAGE, filterBrainRecords, layoutBrainRecords, recordLifetime, safeBrainSourceUrl } from './model.069c36b0bfc3af07.js';
const blankDraft = () => ({ title: '', body: '', tags: '', type: 'fact', source: '', expires: '', supersedes: null });
let serial = 0;
const svgNS = 'http://www.w3.org/2000/svg';
function el(tag, cls = '', text) {
    const node = document.createElement(tag);
    if (cls)
        node.className = cls;
    if (text !== undefined)
        node.textContent = text;
    return node;
}
function button(text, cls = 'secondary') { const b = el('button', cls, text); b.type = 'button'; return b; }
function svg(tag, attrs = {}) {
    const node = document.createElementNS(svgNS, tag);
    for (const [k, v] of Object.entries(attrs))
        node.setAttribute(k, String(v));
    return node;
}
const human = (value) => String(value ?? 'Not recorded').replace(/[-_]/g, ' ');
export function mountDonnaBrain(host, options) {
    const uid = 'donna-brain-' + (++serial), now = options.now ?? (() => new Date().toISOString());
    let companyId = null, brain = null, selected = null, page = 1, disposed = false;
    let busy = false, operation = 0, recallOpen = false, setup = null;
    const drafts = new Map();
    const statuses = new Map();
    const root = el('section', 'brain-root');
    root.setAttribute('aria-labelledby', uid + '-heading');
    const head = el('header', 'brain-heading'), heading = el('h2', '', 'Donna’s company memory.');
    heading.id = uid + '-heading';
    const scope = el('p', 'brain-scope'), mode = el('span', 'pill neutral');
    const intro = el('p', 'brain-intro', 'Explore what this company has recorded, see where it came from, and keep decisions connected to their work.');
    head.append(el('p', 'eyebrow', 'DONNA BRAIN'), heading, scope, intro, mode);
    const metrics = el('dl', 'brain-metrics'), policy = el('p', 'brain-policy');
    const tools = el('form', 'brain-tools');
    tools.setAttribute('role', 'search');
    tools.setAttribute('aria-label', 'Search company brain');
    const search = el('input');
    search.type = 'search';
    search.maxLength = 200;
    search.placeholder = 'Find a decision, skill, question or goal…';
    search.autocomplete = 'off';
    const kind = el('select');
    for (const value of ['all', ...BRAIN_KINDS]) {
        const o = el('option', '', value === 'all' ? 'All record types' : human(value));
        o.value = value;
        kind.append(o);
    }
    const history = el('input');
    history.type = 'checkbox';
    const historyLabel = el('label', 'brain-history');
    historyLabel.append(history, el('span', '', 'Include history & excluded'));
    const field = (label, control, id) => { const wrap = el('label', 'field', label); control.id = uid + '-' + id; wrap.htmlFor = control.id; wrap.append(control); return wrap; };
    const recall = button('Preview Donna recall');
    recall.dataset.brainAction = 'recall';
    tools.append(field('Search records', search, 'search'), field('Record type', kind, 'kind'), historyLabel, recall);
    const resultsStatus = el('p', 'brain-results-status');
    resultsStatus.setAttribute('role', 'status');
    const workspace = el('div', 'brain-workspace'), browser = el('div', 'brain-browser');
    const graphDetails = el('details', 'brain-graph-panel');
    graphDetails.open = true;
    graphDetails.append(el('summary', '', 'Connections in this company'));
    const graphCaption = el('p', 'form-help'), graphHost = el('div', 'brain-graph');
    graphHost.setAttribute('aria-label', 'Bounded company graph');
    graphDetails.append(graphCaption, graphHost);
    const list = el('div', 'brain-record-list');
    list.setAttribute('aria-label', 'Company records');
    const pager = el('div', 'brain-pager'), previous = button('Previous'), next = button('Next'), pageLabel = el('span', 'form-help');
    previous.dataset.brainAction = 'previous';
    next.dataset.brainAction = 'next';
    pager.append(previous, pageLabel, next);
    browser.append(graphDetails, list, pager);
    const inspector = el('aside', 'brain-inspector');
    inspector.setAttribute('aria-label', 'Selected record and provenance');
    workspace.append(browser, inspector);
    const recallRegion = el('section', 'brain-recall');
    recallRegion.hidden = true;
    recallRegion.setAttribute('aria-label', 'Donna recall preview');
    const editors = el('div', 'brain-editors');
    const noteDetails = el('details', 'brain-note-editor');
    noteDetails.open = true;
    noteDetails.append(el('summary', '', 'Save a memory'));
    const noteForm = el('form', 'brain-note-form');
    const noteScope = el('p', 'form-help'), correction = el('p', 'brain-correction');
    const title = el('input');
    title.type = 'text';
    title.required = true;
    title.maxLength = 200;
    title.placeholder = 'A clear title for this record';
    const noteType = el('select');
    for (const value of ['fact', 'decision', 'question', 'procedure']) {
        const option = el('option', '', human(value));
        option.value = value;
        noteType.append(option);
    }
    const body = el('textarea');
    body.rows = 5;
    body.maxLength = 3000;
    body.required = true;
    body.placeholder = 'Record the evidence, decision, unanswered question or repeatable procedure.';
    const tags = el('input');
    tags.type = 'text';
    tags.maxLength = 720;
    tags.placeholder = 'Comma-separated tags';
    const source = el('input');
    source.type = 'text';
    source.maxLength = 2000;
    source.placeholder = 'Source URL or artifact reference (optional)';
    const expires = el('input');
    expires.type = 'datetime-local';
    const noteActions = el('div', 'brain-actions'), save = button('Save to this company', 'primary'), cancelCorrection = button('Cancel correction', 'text-button');
    save.type = 'submit';
    save.dataset.brainAction = 'save-note';
    cancelCorrection.dataset.brainAction = 'cancel-correction';
    cancelCorrection.hidden = true;
    noteActions.append(save, cancelCorrection);
    const extra = el('details', 'brain-note-extra');
    extra.append(el('summary', '', 'Source, tags and expiry'), field('Source / artifact', source, 'source'), field('Tags', tags, 'tags'), field('Expires at · your local time', expires, 'expires'));
    noteForm.append(noteScope, correction, field('Title', title, 'title'), field('Kind', noteType, 'note-type'), field('What should Donna remember?', body, 'body'), extra, el('p', 'form-help', 'Saved through the company’s knowledge records. Corrections append a new record and preserve the earlier evidence.'), noteActions);
    noteDetails.append(noteForm);
    const setupDetails = el('details', 'brain-setup-editor');
    setupDetails.open = true;
    setupDetails.append(el('summary', '', 'Build the next setup plan'));
    const gaps = el('div', 'brain-gaps'), prepare = button('Prepare setup draft'), setupPreview = el('div', 'brain-setup-preview');
    prepare.dataset.brainAction = 'prepare-setup';
    setupDetails.append(el('p', 'form-help', 'Review the gaps in this saved company state and prepare a planning goal with existing people and skills.'), gaps, prepare, setupPreview);
    editors.append(noteDetails, setupDetails);
    const message = el('p', 'brain-message');
    message.setAttribute('role', 'status');
    message.setAttribute('aria-live', 'polite');
    root.append(head, metrics, policy, tools, resultsStatus, recallRegion, workspace, editors, message);
    host.append(root);
    function currentDraft() { return companyId ? drafts.get(companyId) ?? blankDraft() : blankDraft(); }
    function storeDraft() {
        if (!companyId)
            return;
        drafts.set(companyId, { title: title.value, body: body.value, tags: tags.value, type: noteType.value, source: source.value, expires: expires.value, supersedes: currentDraft().supersedes });
        // Drafts are in-memory only. Bound retained companies; never place private
        // note text in canvas preferences or public-preview local storage.
        while (drafts.size > 20) {
            const oldest = drafts.keys().next().value;
            if (!oldest || oldest === companyId)
                break;
            drafts.delete(oldest);
        }
    }
    function loadDraft() {
        const d = currentDraft();
        title.value = d.title;
        body.value = d.body;
        tags.value = d.tags;
        noteType.value = d.type;
        source.value = d.source;
        expires.value = d.expires;
        renderCorrection();
    }
    function setMessage(text, error = false, target = companyId) { if (target)
        statuses.set(target, { text, error }); if (target === companyId) {
        message.textContent = text;
        message.classList.toggle('error', error);
    } }
    function renderCorrection() {
        const id = currentDraft().supersedes, node = id ? brain?.graph.nodes.find(n => n.id === 'knowledge:' + id) : undefined;
        correction.textContent = id ? 'Correcting: ' + (node?.label ?? id) + ' · The earlier record stays in history.' : '';
        correction.hidden = !id;
        cancelCorrection.hidden = !id;
        save.textContent = id ? 'Append correction' : 'Save to this company';
    }
    function writableContext(target) {
        const c = options.context();
        if (disposed || !c.snapshot || c.companyId !== target || !c.snapshot.companies.some(x => x.id === target))
            throw new Error('Company scope changed. Return to the intended company and review this draft.');
        if (!c.writable)
            throw new Error(c.unavailableReason || 'Load a writable company workspace to save.');
        return c;
    }
    function select(id, focus = false) {
        if (!brain?.graph.nodes.some(n => n.id === id))
            return;
        selected = id;
        renderRecords();
        renderInspector();
        if (focus) {
            inspector.tabIndex = -1;
            inspector.focus({ preventScroll: true });
        }
    }
    function renderGraph(rows) {
        graphHost.replaceChildren();
        if (!brain)
            return;
        const layout = layoutBrainRecords(rows, brain.graph.edges, selected), points = new Map(layout.points.map(p => [p.node.id, p]));
        graphCaption.textContent = `${layout.points.length} of ${rows.length} matching records · ${layout.edges.length} visible links. Use the record list for full labels and keyboard navigation.`;
        if (!layout.points.length) {
            graphHost.append(el('p', 'brain-empty', 'No records match these filters.'));
            return;
        }
        const drawing = svg('svg', { viewBox: `0 0 840 ${layout.height}`, width: 840, height: layout.height, role: 'group', 'aria-label': 'Company record connections' });
        const captions = ['COMPANY & STRUCTURE', 'PEOPLE & KNOWLEDGE', 'GOALS & WORK'];
        captions.forEach((caption, i) => { const t = svg('text', { x: 20 + i * 280, y: 22, class: 'brain-graph-heading' }); t.textContent = caption; drawing.append(t); });
        for (const edge of layout.edges) {
            const a = points.get(edge.source), b = points.get(edge.target);
            const path = svg('path', { d: `M${a.x} ${a.y} C${a.x + 80} ${a.y},${b.x - 80} ${b.y},${b.x} ${b.y}`, class: 'brain-edge' + (edge.type === 'supersedes' ? ' brain-edge-correction' : '') });
            const t = svg('title');
            t.textContent = edge.label || edge.type;
            path.append(t);
            drawing.append(path);
        }
        // Use geometry attributes: the surrounding canvas disables CSS transforms in reduced-motion mode.
        for (const { node, x, y } of layout.points) {
            const g = svg('g', { class: 'brain-graph-node' + (selected === node.id ? ' selected' : ''), tabindex: 0, role: 'button', 'aria-label': `${node.label} · ${human(node.type)}`, 'aria-pressed': String(selected === node.id) });
            g.dataset.brainNode = node.id;
            const circle = svg('circle', { cx: x, cy: y, r: 7, 'data-kind': node.type }), label = svg('text', { x: x + 14, y: y + 4 });
            label.textContent = node.label.length > 25 ? node.label.slice(0, 23) + '…' : node.label;
            const full = svg('title');
            full.textContent = node.label + ' · ' + human(node.status);
            g.append(circle, label, full);
            drawing.append(g);
        }
        graphHost.append(drawing);
    }
    function renderRecords() {
        list.replaceChildren();
        if (!brain) {
            graphHost.replaceChildren();
            resultsStatus.textContent = 'No company records loaded.';
            pager.hidden = true;
            return;
        }
        const rows = filterBrainRecords(brain.graph.nodes, search.value, kind.value, history.checked, now()), pages = Math.max(1, Math.ceil(rows.length / BRAIN_LIST_PAGE));
        page = Math.max(1, Math.min(page, pages));
        resultsStatus.textContent = `${rows.length} matching records · ${history.checked ? 'current and historical' : 'current records'} · company scope only.`;
        for (const node of rows.slice((page - 1) * BRAIN_LIST_PAGE, page * BRAIN_LIST_PAGE)) {
            const b = button('', 'brain-record');
            b.dataset.brainRecord = node.id;
            b.setAttribute('aria-pressed', String(node.id === selected));
            const text = el('span', 'brain-record-copy');
            text.append(el('strong', '', node.label), el('span', '', node.summary.slice(0, 150)));
            const labels = el('span', 'brain-record-meta');
            labels.append(el('span', 'brain-kind', human(node.noteType ?? node.type)), el('span', '', recordLifetime(node, now()) === 'current' ? human(node.status) : recordLifetime(node, now())));
            b.append(text, labels);
            list.append(b);
        }
        if (!rows.length)
            list.append(el('p', 'brain-empty', 'No records match. Change the search or include history.'));
        pager.hidden = rows.length <= BRAIN_LIST_PAGE;
        previous.disabled = page <= 1;
        next.disabled = page >= pages;
        pageLabel.textContent = `Page ${page} of ${pages}`;
        renderGraph(rows);
    }
    function renderInspector() {
        inspector.replaceChildren();
        const node = brain?.graph.nodes.find(n => n.id === selected);
        if (!node) {
            inspector.append(el('p', 'eyebrow', 'RECORD & PROVENANCE'), el('h3', '', 'Choose a record.'), el('p', 'form-help', 'Inspect its source, saved state and connections. A saved summary records what is known; it does not certify that the source has been independently checked.'));
            return;
        }
        inspector.append(el('p', 'eyebrow', human(node.noteType ?? node.type)), el('h3', '', node.label), el('p', 'brain-record-body', node.summary));
        const facts = el('dl', 'brain-provenance');
        for (const [name, value] of [['Record', node.recordRef ?? node.id], ['Company', brain.companyName], ['State', human(node.status)], ['Eligibility', recordLifetime(node, now())], ['Saved / updated', node.updatedAt ?? 'Not recorded'], ['Valid from', node.valid_from ?? 'No date bound'], ['Valid until', node.valid_until ?? 'No expiry recorded'], ['Artifact / source reference', node.artifactRef || 'No artifact reference saved']]) {
            facts.append(el('dt', '', String(name)), el('dd', '', String(value)));
        }
        if (node.supersededBy) {
            facts.append(el('dt', '', 'Corrected by'), el('dd', '', String(node.supersededBy)));
        }
        inspector.append(facts, el('p', 'form-help', 'Reading status: saved record summary. Referenced files and external sources have not been opened by this pane.'));
        for (const id of node.source_ids) {
            const source = brain.graph.sources.find(s => s.id === id);
            if (!source)
                continue;
            const url = safeBrainSourceUrl(source.url), wrap = el('p', 'brain-source');
            if (url) {
                const a = el('a', '', source.title);
                a.href = url;
                a.target = '_blank';
                a.rel = 'noopener noreferrer';
                wrap.append(a);
            }
            else
                wrap.append(el('span', '', source.title));
            wrap.append(el('small', '', String(source.access_depth ?? 'Access depth not recorded')));
            inspector.append(wrap);
        }
        const links = brain.graph.edges.filter(e => e.source === node.id || e.target === node.id);
        if (links.length) {
            inspector.append(el('h4', '', 'Recorded connections'));
            const ul = el('ul', 'brain-connections');
            for (const edge of links.slice(0, 24)) {
                const outgoing = edge.source === node.id, id = outgoing ? edge.target : edge.source, other = brain.graph.nodes.find(n => n.id === id);
                if (!other)
                    continue;
                const li = el('li'), b = button(`${outgoing ? '→' : '←'} ${human(edge.type)} · ${other.label}`, 'text-button');
                b.dataset.brainLink = id;
                li.append(b);
                ul.append(li);
            }
            if (links.length > 24)
                ul.append(el('li', 'form-help', `${links.length - 24} more connections omitted from this inspector.`));
            inspector.append(ul);
        }
        if (node.type === 'knowledge') {
            const fix = button('Append correction');
            fix.dataset.brainAction = 'correct';
            fix.disabled = !options.context().writable || busy;
            inspector.append(fix);
        }
    }
    function renderRecall() {
        recallRegion.hidden = !recallOpen;
        recallRegion.replaceChildren();
        if (!recallOpen || !companyId || !brain)
            return;
        const context = options.context();
        if (!context.snapshot || context.companyId !== companyId)
            return;
        recallRegion.append(el('h3', '', 'What Donna can recall for this question'));
        if (!search.value.trim()) {
            recallRegion.append(el('p', 'form-help', 'Write a search question first.'));
            return;
        }
        try {
            const packet = brainEvidence(context.snapshot, companyId, search.value, now());
            recallRegion.append(el('p', 'form-help', `${packet.results.length} relevant saved records · ${packet.readingStatus}. Ranking indicates relevance, not proof or confidence.`));
            for (const result of packet.results) {
                const b = button('', 'brain-recall-record');
                b.dataset.brainLink = result.id;
                b.append(el('strong', '', result.label), el('span', '', result.summary));
                recallRegion.append(b);
            }
            if (!packet.results.length)
                recallRegion.append(el('p', 'brain-empty', 'No eligible records matched. Save evidence or refine the question.'));
            const provenance = el('details');
            provenance.append(el('summary', '', 'Retrieval provenance'), el('p', 'brain-mono', `Algorithm: ${packet.algorithm}\nRevision: ${packet.revision}\nCompany: ${packet.companyId}\nRetrieved at: ${now()}\nBounded omissions: ${packet.omittedCount}`));
            recallRegion.append(provenance);
        }
        catch (error) {
            recallRegion.append(el('p', 'error', error instanceof Error ? error.message : String(error)));
        }
    }
    function renderSetup() {
        setupPreview.replaceChildren();
        if (!setup || setup.companyId !== companyId)
            return;
        const c = options.context();
        setupPreview.append(el('h4', '', String(setup.command.title)), el('p', 'brain-setup-body', String(setup.command.description)), el('p', 'brain-setup-terms', 'Planning only · manual · $0 provider allowance · no tools granted'));
        if (setup.savedId) {
            const b = button('Inspect saved planning goal');
            b.dataset.brainLink = 'goal:' + setup.savedId;
            setupPreview.append(el('p', 'brain-save-receipt', 'Saved goal: ' + setup.savedId), b);
            return;
        }
        const stale = setup.revision !== brain?.graph.revision;
        if (stale)
            setupPreview.append(el('p', 'brain-stale', 'Company records changed. Prepare the draft again before saving.'));
        const b = button('Save planning goal', 'primary');
        b.dataset.brainAction = 'save-setup';
        b.disabled = !c.writable || busy || stale;
        setupPreview.append(b);
    }
    function refresh() {
        if (disposed)
            return;
        storeDraft();
        const c = options.context(), nextId = c.snapshot?.companies.some(x => x.id === c.companyId) ? c.companyId : null;
        if (nextId !== companyId) {
            companyId = nextId;
            selected = null;
            page = 1;
            search.value = '';
            kind.value = 'all';
            history.checked = false;
            recallOpen = false;
            setup = null;
        }
        brain = null;
        let failure = '';
        if (c.snapshot && companyId) {
            try {
                brain = buildDonnaBrain(c.snapshot, companyId);
            }
            catch (error) {
                failure = error instanceof Error ? error.message : String(error);
            }
        }
        scope.textContent = brain ? brain.companyName : 'Choose an available company';
        mode.textContent = c.modeLabel;
        policy.textContent = brain ? 'Company records are isolated before search. Saved definitions, execution records and source evidence retain their own status.' : failure || c.unavailableReason || 'Load the current workspace to inspect Donna’s company memory.';
        metrics.replaceChildren();
        for (const [label, count] of brain ? [['Records', brain.counts.nodes], ['Connections', brain.counts.edges], ['Knowledge', brain.counts.knowledge], ['Questions recorded', brain.counts.questions], ['Corrections', brain.counts.corrections]] : []) {
            const pair = el('div');
            pair.append(el('dt', '', String(label)), el('dd', '', String(count)));
            metrics.append(pair);
        }
        if (brain?.counts.omitted)
            policy.textContent += ` ${brain.counts.omitted} records omitted by projection limits.`;
        tools.querySelectorAll('input,select,button').forEach(control => control.disabled = !brain);
        noteScope.textContent = brain ? `Save in ${brain.companyName}. ${c.writable ? 'Draft text stays in this pane until saved.' : c.unavailableReason || 'This view is read only.'}` : 'Select a company before writing.';
        noteForm.querySelectorAll('input,select,textarea,button').forEach(control => control.disabled = !brain || !c.writable || busy);
        prepare.disabled = !brain || !c.writable || busy;
        gaps.replaceChildren();
        if (brain) {
            for (const gap of brain.gaps.slice(0, 8)) {
                const entry = el('div', 'brain-gap');
                entry.append(el('strong', '', gap.title), el('p', '', gap.detail));
                gaps.append(entry);
            }
            if (!brain.gaps.length)
                gaps.append(el('p', 'form-help', 'No basic setup gaps detected in the saved projection. Review the evidence before treating setup as complete.'));
        }
        const savedStatus = companyId && statuses.get(companyId);
        message.textContent = savedStatus ? savedStatus.text : '';
        message.classList.toggle('error', Boolean(savedStatus && savedStatus.error));
        loadDraft();
        renderRecords();
        renderInspector();
        renderRecall();
        renderSetup();
    }
    async function saveNote() {
        if (busy || !companyId)
            return;
        const target = companyId;
        storeDraft();
        const d = { ...currentDraft() }, c = writableContext(target), start = ++operation;
        if (!d.title.trim())
            throw new Error('Give this memory a title.');
        if (d.supersedes && !brain?.graph.nodes.some(n => n.id === 'knowledge:' + d.supersedes && n.type === 'knowledge'))
            throw new Error('The corrected record is no longer in this company projection. Review the correction target.');
        const expiry = d.expires ? new Date(d.expires).toISOString() : null;
        const summary = makeBrainNote({ type: d.type, body: d.body, tags: d.tags.split(',').map(t => t.trim()).filter(Boolean), supersedes: d.supersedes, expiresAt: expiry });
        const existing = new Set(c.snapshot.knowledge.map(n => n.id));
        busy = true;
        refresh();
        try {
            const result = await options.command({ action: 'add_knowledge', companyId: target, title: d.title.trim(), summary, artifactUri: d.source.trim() || `daftar-brain://${target}/note` });
            const record = result.knowledge.find(n => n.companyId === target && !existing.has(n.id) && n.title === d.title.trim() && n.summary === summary);
            if (!record)
                throw new Error('The command returned without a confirmed saved note. Your draft is retained for review.');
            if (disposed || start !== operation)
                return;
            drafts.set(target, blankDraft());
            if (companyId === target)
                loadDraft();
            setMessage(`Saved ${d.supersedes ? 'correction' : 'memory'} · ${record.id}.`, false, target);
            if (companyId === target)
                selected = 'knowledge:' + record.id;
        }
        catch (error) {
            if (!disposed)
                setMessage(error instanceof Error ? error.message : String(error), true, target);
        }
        finally {
            busy = false;
            if (!disposed)
                refresh();
        }
    }
    function prepareSetup() {
        if (!companyId || !brain)
            return;
        const c = writableContext(companyId), command = makeDonnaSetupDraft(c.snapshot, companyId);
        const existing = c.snapshot.goals?.find(g => g.companyId === companyId && g.title === command.title && g.status !== 'completed');
        setup = { companyId, revision: brain.graph.revision, command, savedId: existing?.id ?? null };
        if (existing)
            setMessage('An unfinished setup goal already exists. Review that goal before creating another.');
        else
            setMessage('Setup draft prepared. Review its scope and steps before saving.');
        renderSetup();
    }
    async function saveSetup() {
        if (busy || !setup || !companyId || setup.savedId)
            return;
        const target = companyId, c = writableContext(target), draft = setup;
        if (buildDonnaBrain(c.snapshot, target).graph.revision !== draft.revision)
            throw new Error('Company records changed. Prepare the setup draft again before saving.');
        const before = new Set((c.snapshot.goals ?? []).map(g => g.id));
        busy = true;
        refresh();
        try {
            const result = await options.command(draft.command);
            const goal = result.goals?.find(g => !before.has(g.id) && g.companyId === target && g.title === draft.command.title && g.description === draft.command.description && g.mode === 'plan');
            if (!goal)
                throw new Error('The command returned without a confirmed planning goal. Keep this draft until native confirmation.');
            if (disposed)
                return;
            draft.savedId = goal.id;
            if (companyId === target) {
                setup = draft;
                selected = 'goal:' + goal.id;
            }
            setMessage(`Saved planning goal · ${goal.id}. Review it in Goals before planning or execution.`, false, target);
        }
        catch (error) {
            if (!disposed)
                setMessage(error instanceof Error ? error.message : String(error), true, target);
        }
        finally {
            busy = false;
            if (!disposed)
                refresh();
        }
    }
    function safely(task) { try {
        const result = task();
        if (result instanceof Promise)
            void result.catch(error => setMessage(error instanceof Error ? error.message : String(error), true));
    }
    catch (error) {
        setMessage(error instanceof Error ? error.message : String(error), true);
    } }
    const onClick = (event) => {
        const target = event.target instanceof Element ? event.target.closest('[data-brain-record],[data-brain-node],[data-brain-link],[data-brain-action]') : null;
        if (!target || !root.contains(target) || (target.tagName === 'BUTTON' && target.disabled))
            return;
        const id = target.dataset.brainRecord ?? target.dataset.brainNode ?? target.dataset.brainLink;
        if (id) {
            select(id, true);
            return;
        }
        switch (target.dataset.brainAction) {
            case 'recall':
                recallOpen = !recallOpen;
                recall.setAttribute('aria-expanded', String(recallOpen));
                renderRecall();
                break;
            case 'previous':
                page--;
                renderRecords();
                break;
            case 'next':
                page++;
                renderRecords();
                break;
            case 'correct':
                safely(() => { if (!companyId)
                    return; writableContext(companyId); const node = brain?.graph.nodes.find(n => n.id === selected && n.type === 'knowledge'); if (!node)
                    return; storeDraft(); const d = currentDraft(), record = options.context().snapshot?.knowledge.find(k => 'knowledge:' + k.id === node.id), note = record && readBrainNote(record.summary); d.supersedes = node.id.slice('knowledge:'.length); if (!d.title)
                    d.title = ('Correction: ' + node.label).slice(0, 200); if (!d.body)
                    d.type = note?.type ?? 'fact'; drafts.set(companyId, d); loadDraft(); noteDetails.open = true; body.focus({ preventScroll: true }); noteDetails.scrollIntoView?.({ block: 'nearest' }); });
                break;
            case 'cancel-correction':
                storeDraft();
                if (companyId) {
                    const d = currentDraft();
                    d.supersedes = null;
                    drafts.set(companyId, d);
                    renderCorrection();
                }
                break;
            case 'prepare-setup':
                safely(prepareSetup);
                break;
            case 'save-setup':
                safely(saveSetup);
                break;
        }
    };
    const onKey = (event) => { if ((event.key === 'Enter' || event.key === ' ') && event.target instanceof Element && event.target.matches('[data-brain-node]')) {
        event.preventDefault();
        select(event.target.dataset.brainNode, true);
    } };
    const filter = () => { page = 1; renderRecords(); if (recallOpen)
        renderRecall(); };
    root.addEventListener('click', onClick);
    root.addEventListener('keydown', onKey);
    search.addEventListener('input', filter);
    kind.addEventListener('change', filter);
    history.addEventListener('change', filter);
    tools.addEventListener('submit', event => { event.preventDefault(); recallOpen = true; renderRecall(); });
    noteForm.addEventListener('input', storeDraft);
    noteForm.addEventListener('change', storeDraft);
    noteForm.addEventListener('submit', event => { event.preventDefault(); safely(saveNote); });
    refresh();
    return { refresh, destroy() { disposed = true; operation++; drafts.clear(); statuses.clear(); root.removeEventListener('click', onClick); root.removeEventListener('keydown', onKey); root.remove(); brain = null; setup = null; } };
}

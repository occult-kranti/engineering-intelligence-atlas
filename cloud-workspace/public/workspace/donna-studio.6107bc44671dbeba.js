// These are editable starting briefs, never tool calls or an execution grant.
export const DONNA_CREATIVE_BRIEFS = Object.freeze({
    moe: 'Plan a bounded coding trial using Qwen3-Coder 30B-A3B Q4_K_M on the connected Ollama runtime. Check the installed model digest and actual GPU first. Start with one request, an 8,192-token context and at most 1,024 output tokens. Propose one small Donna improvement with acceptance checks. Record the output and measured performance; keep rental costs separate from token spend.',
    blender: 'Create a small, original Blender scene for Donna in charcoal, pale olive and brass. Begin with a scene plan and one low-resolution preview. Keep the editable .blend and a GLB export. Inspect the scene, use the explicitly configured render device, and return the actual frame, device and timing receipt. Ask for review before expanding the render.',
    unreal: 'Plan a small Unreal Engine scene for Donna using the Blender asset. Identify the project and matching engine version, then inspect and validate the project. Prepare the import, materials, lighting and camera. A real rendered-frame test must use a graphics-enabled worker; keep that separate from NullRHI validation. Record what ran and what still needs an engine host.',
});
export function mountDonnaStudio(host, options) {
    const doc = host.ownerDocument;
    const find = (id) => {
        const node = host.querySelector(`#${id}`);
        if (!node)
            throw new Error(`Donna studio is missing ${id}.`);
        return node;
    };
    const tabs = Array.from(host.querySelectorAll('[data-donna-view]'));
    function show(view, focus = false) {
        for (const tab of tabs) {
            const selected = tab.dataset.donnaView === view;
            tab.setAttribute('aria-selected', String(selected));
            tab.tabIndex = selected ? 0 : -1;
        }
        for (const panel of Array.from(host.querySelectorAll('[data-donna-page]')))
            panel.hidden = panel.dataset.donnaPage !== view;
        host.dataset.donnaView = view;
        if (focus)
            tabs.find(tab => tab.dataset.donnaView === view)?.focus();
    }
    host.addEventListener('click', event => {
        const target = event.target instanceof doc.defaultView.Element ? event.target.closest('button') : null;
        if (!target || !host.contains(target))
            return;
        if (target.dataset.donnaView)
            show(target.dataset.donnaView);
        if (target.dataset.donnaAction === 'brief') {
            show('brief');
            find('chat-message').focus();
        }
        if (target.dataset.donnaAction === 'expand')
            options.expand();
        if (target.dataset.donnaAction === 'studio')
            show('studio', true);
        if (target.dataset.donnaSurface)
            options.openSurface(target.dataset.donnaSurface);
        const brief = target.dataset.donnaPreset && DONNA_CREATIVE_BRIEFS[target.dataset.donnaPreset];
        if (brief) {
            try {
                options.addDraft(brief);
                show('brief');
                find('chat-message').focus();
            }
            catch (error) {
                find('chat-status').textContent = error instanceof Error ? error.message : 'This brief could not be added.';
            }
        }
    });
    for (const tab of tabs)
        tab.addEventListener('keydown', event => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key))
                return;
            event.preventDefault();
            const at = tabs.indexOf(tab);
            const next = event.key === 'Home' ? tabs[0] : event.key === 'End' ? tabs.at(-1) : tabs[(at + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
            if (next)
                show(next.dataset.donnaView, true);
        });
    function count(id, value) { find(id).textContent = value === null ? '—' : String(value); }
    function refresh(state) {
        find('donna-context-scope').textContent = state.scope;
        find('donna-scope-summary').textContent = state.scope;
        count('donna-crew-count', state.employeeCount);
        count('donna-goal-count', state.openGoals);
        count('donna-running-count', state.recordedRunning);
        count('donna-thread-count', state.messageCount);
        find('donna-connection-label').textContent = !state.available ? 'Workspace not loaded'
            : state.transport === 'public-preview' ? 'Example · read only'
                : state.transport === 'cloud-browser' ? 'Cloud conversation'
                    : state.transport === 'personal-browser' ? 'Desktop connection'
                        : state.transport === 'unavailable' ? 'Runtime unavailable' : 'Native workspace';
        const runtime = find('donna-runtime-label');
        runtime.textContent = !state.runtime ? 'Runtime status unavailable' : state.runtime.running ? 'Runtime reports active work' : state.runtime.enabled ? 'Dispatcher enabled' : 'Dispatcher paused';
        runtime.dataset.state = state.runtime?.running ? 'running' : 'idle';
        find('donna-runtime-note').textContent = state.transport === 'cloud-browser'
            ? 'Cloud replies stay in this conversation. Model and creative jobs need a connected execution worker.'
            : 'The worker reports execution. A saved role or model assignment does not start a job.';
        const recent = find('donna-recent-goals');
        recent.replaceChildren();
        for (const goal of state.recentGoals.slice(0, 3)) {
            const row = doc.createElement('li');
            const title = doc.createElement('span');
            title.textContent = goal.title;
            const status = doc.createElement('small');
            status.textContent = goal.status.replaceAll('-', ' ');
            row.append(title, status);
            recent.append(row);
        }
        if (!state.recentGoals.length) {
            const empty = doc.createElement('li');
            empty.className = 'donna-goal-empty';
            empty.textContent = state.available ? 'Your next goal starts with a brief.' : 'Load a workspace to see its saved goals.';
            recent.append(empty);
        }
    }
    function completeDraft(submittedText) {
        const input = find('chat-message');
        // A reply may arrive after the owner starts the next brief. Never erase it.
        if (input.value.trim() !== submittedText.trim())
            return false;
        const moveFocus = host.contains(doc.activeElement);
        input.value = '';
        input.dispatchEvent(new doc.defaultView.Event('input', { bubbles: true }));
        if (host.dataset.donnaView === 'brief')
            show('thread', moveFocus);
        return true;
    }
    show('brief');
    return { show, refresh, completeDraft };
}

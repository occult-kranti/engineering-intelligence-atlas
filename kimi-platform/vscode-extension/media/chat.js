// Research Director chat webview script.
// Security rules enforced here (and scanned by tests/staticScan.test.ts):
//  - acquireVsCodeApi() postMessage is the ONLY communication channel.
//  - All model output is rendered via textContent only — never as markup.
//  - No network APIs, no dynamic evaluation, no credential handling.
//  - No fake streaming: a pending indicator is shown until the host pushes
//    the completed state.
(function () {
  'use strict';

  const vscode = acquireVsCodeApi();

  const els = {
    messages: document.getElementById('messages'),
    status: document.getElementById('status'),
    input: document.getElementById('input'),
    send: document.getElementById('send'),
    stop: document.getElementById('stop'),
    refresh: document.getElementById('refresh'),
    sessionSelect: document.getElementById('session-select'),
  };

  let state = {
    paired: false,
    sessions: [],
    activeSessionId: null,
    messages: [],
    pending: false,
    error: null,
  };

  function clearChildren(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  function renderSessions() {
    const sel = els.sessionSelect;
    clearChildren(sel);
    for (const s of state.sessions) {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = s.title || s.id;
      if (s.id === state.activeSessionId) opt.selected = true;
      sel.appendChild(opt);
    }
    sel.disabled = state.sessions.length === 0;
  }

  function renderMessages() {
    const box = els.messages;
    clearChildren(box);
    if (!state.paired) {
      const p = document.createElement('p');
      p.className = 'rd-notice';
      p.textContent = 'Not paired. Run "Research Director: Pair with Desktop" from the Command Palette.';
      box.appendChild(p);
      return;
    }
    if (state.messages.length === 0) {
      const p = document.createElement('p');
      p.className = 'rd-notice';
      p.textContent = 'No messages yet.';
      box.appendChild(p);
    }
    for (const m of state.messages) {
      const wrap = document.createElement('article');
      wrap.className = 'rd-msg rd-msg-' + m.role;
      const head = document.createElement('header');
      head.className = 'rd-msg-head';
      head.textContent = m.role === 'user' ? 'You' : m.role === 'assistant' ? 'Director' : 'System';
      const body = document.createElement('p');
      body.className = 'rd-msg-body';
      body.textContent = m.content; // textContent only — never markup
      wrap.appendChild(head);
      wrap.appendChild(body);
      if (m.state === 'stopped' || m.state === 'error') {
        const note = document.createElement('p');
        note.className = 'rd-msg-note';
        note.textContent = m.state === 'stopped' ? 'Generation stopped' : 'Generation failed';
        wrap.appendChild(note);
      }
      box.appendChild(wrap);
    }
    if (state.pending) {
      const p = document.createElement('p');
      p.className = 'rd-pending';
      p.setAttribute('role', 'progressbar');
      p.setAttribute('aria-label', 'Waiting for the Director');
      p.textContent = 'Director is thinking…';
      box.appendChild(p);
    }
    box.scrollTop = box.scrollHeight;
  }

  function renderStatus() {
    clearChildren(els.status);
    if (state.error) {
      const p = document.createElement('p');
      p.className = 'rd-error';
      p.textContent = state.error;
      els.status.appendChild(p);
    }
    els.send.disabled = !state.paired || state.pending;
    els.stop.hidden = !state.pending;
  }

  function render() {
    renderSessions();
    renderMessages();
    renderStatus();
  }

  window.addEventListener('message', (event) => {
    const msg = event.data;
    if (!msg || typeof msg !== 'object' || msg.type !== 'state') return;
    state = {
      paired: !!msg.paired,
      sessions: Array.isArray(msg.sessions) ? msg.sessions : [],
      activeSessionId: typeof msg.activeSessionId === 'string' ? msg.activeSessionId : null,
      messages: Array.isArray(msg.messages) ? msg.messages : [],
      pending: !!msg.pending,
      error: typeof msg.error === 'string' ? msg.error : null,
    };
    render();
  });

  els.send.addEventListener('click', () => {
    const text = els.input.value;
    const sessionId = state.activeSessionId || (state.sessions[0] && state.sessions[0].id) || null;
    if (typeof text !== 'string' || text.trim().length === 0) return;
    if (!sessionId) {
      clearChildren(els.status);
      const p = document.createElement('p');
      p.className = 'rd-error';
      p.textContent = 'No chat session yet — run "Research Director: Ask Director about Selection" once to create one.';
      els.status.appendChild(p);
      return;
    }
    els.input.value = '';
    vscode.postMessage({ type: 'send', sessionId: sessionId, text: text });
  });

  els.stop.addEventListener('click', () => {
    if (state.activeSessionId) {
      vscode.postMessage({ type: 'stop', sessionId: state.activeSessionId });
    }
  });

  els.refresh.addEventListener('click', () => {
    vscode.postMessage({ type: 'listSessions' });
  });

  els.sessionSelect.addEventListener('change', () => {
    const id = els.sessionSelect.value;
    if (id) vscode.postMessage({ type: 'selectSession', sessionId: id });
  });

  els.input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      els.send.click();
    }
  });

  vscode.postMessage({ type: 'ready' });
})();

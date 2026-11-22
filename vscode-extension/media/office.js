'use strict';
const vscode = acquireVsCodeApi();
for (const button of document.querySelectorAll('[data-command]')) button.addEventListener('click', () => vscode.postMessage({ command: button.dataset.command }));
window.addEventListener('message', event => {
  const value = event.data; if (value?.type !== 'state') return;
  document.getElementById('connection').textContent = `${value.location || ''} · ${value.notice || ''}`;
});
vscode.postMessage({ type: 'ready' });

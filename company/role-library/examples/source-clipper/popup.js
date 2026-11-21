import { boundedRecord } from './source-record.js';

const status = document.getElementById('status');
const preview = document.getElementById('preview');
const exportButton = document.getElementById('export');
let record = null;

// Runs in the selected page's main frame only after Capture is clicked.
function selectedPageText() {
  const blocked = 'input,textarea,select,[contenteditable]:not([contenteditable="false"])';
  if (document.activeElement?.closest(blocked)) throw new Error('Editable fields are excluded.');
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount !== 1) throw new Error('Select one passage of ordinary page text.');
  const range = selection.getRangeAt(0);
  const ancestor = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement;
  if (ancestor?.closest(blocked)) throw new Error('Editable areas are excluded.');
  // A range spanning a contenteditable/form element is also excluded.
  if (Array.from(ancestor?.querySelectorAll(blocked) || []).some(node => range.intersectsNode(node))) throw new Error('The selection crosses an editable field.');
  const text = selection.toString();
  if (text.length > 2000) throw new Error('Select no more than 2,000 characters.');
  return { url: location.href, title: document.title, selectedText: text };
}

document.getElementById('capture').addEventListener('click', async () => {
  record = null; preview.value = ''; exportButton.disabled = true;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !/^https?:\/\//.test(tab.url || '')) throw new Error('Choose an ordinary web page; restricted pages cannot be captured.');
    const results = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: selectedPageText });
    record = boundedRecord(results[0]?.result);
    preview.value = JSON.stringify(record, null, 2);
    exportButton.disabled = false;
    status.textContent = 'Captured locally. Review the text and source before export; close this popup to discard.';
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : 'Capture failed; no export was created.';
  }
});

exportButton.addEventListener('click', () => {
  if (!record) return;
  const url = URL.createObjectURL(new Blob([JSON.stringify(record, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = 'selected-source.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  status.textContent = 'Export requested. The record was not uploaded.';
});

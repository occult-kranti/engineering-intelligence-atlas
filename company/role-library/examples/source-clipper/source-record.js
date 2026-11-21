/** Pure projection: no cookies, form values, storage, history or extra fields. */
export function boundedRecord(input, now = new Date().toISOString()) {
  if (!input || typeof input !== 'object') throw new Error('No selection record.');
  const url = new URL(input.url);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('Choose an ordinary web page.');
  const selectedText = typeof input.selectedText === 'string' ? input.selectedText.trim() : '';
  if (!selectedText) throw new Error('Select non-editable page text first.');
  if (selectedText.length > 2000) throw new Error('Select no more than 2,000 characters.');
  if (/(?:sk-ant-api|sk-proj-|github_pat_|gh[pousr]_)[A-Za-z0-9_-]{20,}|-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY-----/.test(selectedText)) throw new Error('This selection appears to contain credential material.');
  return {
    schemaVersion: 1,
    classification: 'private-until-reviewed',
    source: { url: url.origin + url.pathname, title: String(input.title || '').slice(0, 180), capturedAt: now },
    selectedText,
    capture: 'explicit-user-selection',
    limitations: ['Only selected text was captured', 'URL query and fragment omitted', 'No claim verification or permission to redistribute is implied'],
  };
}

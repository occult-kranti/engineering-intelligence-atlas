import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRuntimeUrl, isPersistableRuntimeUrl, isDevelopmentHost } from '../www/js/runtime-url.js';

test('accepts a bare host and defaults to https', () => {
  const r = normalizeRuntimeUrl('director.example.com');
  assert.equal(r.ok, true);
  assert.equal(r.url, 'https://director.example.com/');
  assert.equal(r.usesCleartext, false);
});

test('accepts https with path, query, and non-default port', () => {
  const r = normalizeRuntimeUrl('https://director.example.com:8443/app?tab=1#top');
  assert.equal(r.ok, true);
  assert.equal(r.url, 'https://director.example.com:8443/app?tab=1#top');
});

test('trims surrounding whitespace', () => {
  const r = normalizeRuntimeUrl('   https://director.example.com  ');
  assert.equal(r.ok, true);
  assert.equal(r.url, 'https://director.example.com/');
});

test('drops the default https port during normalization', () => {
  const r = normalizeRuntimeUrl('https://director.example.com:443/');
  assert.equal(r.ok, true);
  assert.equal(r.url, 'https://director.example.com/');
});

test('drops the default http port on localhost', () => {
  const r = normalizeRuntimeUrl('http://localhost:80/');
  assert.equal(r.ok, true);
  assert.equal(r.url, 'http://localhost/');
});

test('accepts http on localhost development hosts', () => {
  for (const input of [
    'http://localhost:3000',
    'http://127.0.0.1:8787',
    'http://[::1]:8787',
    'http://10.0.2.2:8787',
    'http://app.localhost:3000',
  ]) {
    const r = normalizeRuntimeUrl(input);
    assert.equal(r.ok, true, input);
    assert.equal(r.usesCleartext, true, input);
  }
});

test('rejects http on remote hosts', () => {
  const r = normalizeRuntimeUrl('http://director.example.com');
  assert.equal(r.ok, false);
  assert.match(r.error, /localhost/i);
});

test('rejects non-http(s) schemes', () => {
  for (const input of ['file:///etc/passwd', 'javascript:alert(1)', 'intent://x', 'ftp://host/x', 'data:text/html,x']) {
    const r = normalizeRuntimeUrl(input);
    assert.equal(r.ok, false, input);
  }
});

test('rejects embedded credentials so no secret is ever stored', () => {
  const r = normalizeRuntimeUrl('https://user:pass@director.example.com');
  assert.equal(r.ok, false);
  assert.match(r.error, /password|credentials|sign in/i);
});

test('rejects empty and malformed input', () => {
  for (const input of ['', '   ', 'https://', 'not a url with spaces', 'https://exa mple.com']) {
    const r = normalizeRuntimeUrl(input);
    assert.equal(r.ok, false, JSON.stringify(input));
  }
});

test('isDevelopmentHost classifies hosts', () => {
  const dev = (u) => isDevelopmentHost(new URL(u));
  assert.equal(dev('http://localhost/'), true);
  assert.equal(dev('http://127.1.2.3/'), true);
  assert.equal(dev('http://10.0.2.2/'), true);
  assert.equal(dev('http://[::1]/'), true);
  assert.equal(dev('https://example.com/'), false);
  assert.equal(dev('https://localhost.evil.com/'), false);
  assert.equal(dev('http://10.0.2.2.evil.com/'), false);
});

test('isPersistableRuntimeUrl mirrors validation', () => {
  assert.equal(isPersistableRuntimeUrl('https://director.example.com/'), true);
  assert.equal(isPersistableRuntimeUrl('http://localhost:3000/'), true);
  assert.equal(isPersistableRuntimeUrl('http://evil.example.com/'), false);
  assert.equal(isPersistableRuntimeUrl(''), false);
  assert.equal(isPersistableRuntimeUrl(null), false);
});

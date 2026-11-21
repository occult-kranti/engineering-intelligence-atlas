import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { boundedRecord } from './source-clipper/source-record.js';

test('source export keeps only bounded selected text and sanitized provenance', () => {
  const value = boundedRecord({ url: 'https://example.org/paper?token=private-value#fragment', title: 'Example', selectedText: '  Selected claim  ', cookies: 'must-not-copy', hiddenSession: 'must-not-copy' }, '2026-01-01T00:00:00Z');
  assert.equal(value.source.url, 'https://example.org/paper');
  assert.equal(value.selectedText, 'Selected claim');
  assert.equal(value.classification, 'private-until-reviewed');
  assert.ok(!JSON.stringify(value).includes('must-not-copy'));
  assert.ok(!JSON.stringify(value).includes('private-value'));
});

test('source capture rejects restricted URLs, credentials and unbounded input', () => {
  for (const url of ['chrome://settings', 'file:///tmp/private', 'https://person:secret@example.org/']) {
    assert.throws(() => boundedRecord({ url, selectedText: 'text' }));
  }
  assert.throws(() => boundedRecord({ url: 'https://example.org', selectedText: 'x'.repeat(2001) }));
  assert.throws(() => boundedRecord({ url: 'https://example.org', selectedText: '  ' }));
  assert.throws(() => boundedRecord({ url: 'https://example.org', selectedText: '-----BEGIN PRIVATE KEY-----\nexample-only' }));
});

test('extension requests gesture-scoped permissions without background collection', () => {
  const manifest = JSON.parse(fs.readFileSync(new URL('./source-clipper/manifest.json', import.meta.url)));
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions, ['activeTab', 'scripting']);
  for (const key of ['host_permissions', 'optional_host_permissions', 'background', 'content_scripts']) assert.equal(manifest[key], undefined);
});

import assert from 'node:assert/strict';
import http from 'node:http';
assert.throws(() => globalThis.fetch('https://example.invalid/'), /run offline/);
assert.throws(() => http.get('http://127.0.0.1:9/'), /run offline/);

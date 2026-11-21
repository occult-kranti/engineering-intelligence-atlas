import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createRuntimeStore,
  createLocalStorageAdapter,
  createPreferencesStorage,
  RUNTIME_URL_KEY,
} from '../www/js/runtime-store.js';
import { isPersistableRuntimeUrl } from '../www/js/runtime-url.js';

function memoryStorage() {
  const map = new Map();
  return {
    map,
    async getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    async setItem(key, value) {
      map.set(key, value);
    },
    async removeItem(key) {
      map.delete(key);
    },
  };
}

const validator = { isPersistableRuntimeUrl };

test('saves and loads a validated runtime URL under the documented key', async () => {
  const backing = memoryStorage();
  const store = createRuntimeStore(backing, validator);
  await store.save('https://director.example.com/');
  assert.equal(backing.map.get(RUNTIME_URL_KEY), 'https://director.example.com/');
  assert.equal(await store.load(), 'https://director.example.com/');
});

test('load returns null when nothing is stored', async () => {
  const store = createRuntimeStore(memoryStorage(), validator);
  assert.equal(await store.load(), null);
});

test('refuses to persist an invalid URL', async () => {
  const backing = memoryStorage();
  const store = createRuntimeStore(backing, validator);
  await assert.rejects(() => store.save('http://evil.example.com/'), /invalid/i);
  assert.equal(backing.map.size, 0);
});

test('evicts a previously stored value that no longer passes validation', async () => {
  const backing = memoryStorage();
  backing.map.set(RUNTIME_URL_KEY, 'javascript:alert(1)');
  const store = createRuntimeStore(backing, validator);
  assert.equal(await store.load(), null);
  assert.equal(backing.map.has(RUNTIME_URL_KEY), false);
});

test('clear removes the stored URL', async () => {
  const backing = memoryStorage();
  const store = createRuntimeStore(backing, validator);
  await store.save('https://director.example.com/');
  await store.clear();
  assert.equal(await store.load(), null);
});

test('localStorage adapter round-trips through a Web Storage-like object', async () => {
  const map = new Map();
  const webStorage = {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, v),
    removeItem: (k) => map.delete(k),
  };
  const store = createRuntimeStore(createLocalStorageAdapter(webStorage), validator);
  await store.save('http://localhost:3000/');
  assert.equal(await store.load(), 'http://localhost:3000/');
});

test('preferences adapter maps to Capacitor Preferences API', async () => {
  const calls = [];
  const fakePreferences = {
    async get({ key }) {
      calls.push(['get', key]);
      return { value: key === RUNTIME_URL_KEY ? 'https://director.example.com/' : null };
    },
    async set({ key, value }) {
      calls.push(['set', key, value]);
    },
    async remove({ key }) {
      calls.push(['remove', key]);
    },
  };
  const store = createRuntimeStore(createPreferencesStorage(fakePreferences), validator);
  assert.equal(await store.load(), 'https://director.example.com/');
  await store.save('https://director.example.com/');
  await store.clear();
  assert.deepEqual(calls, [
    ['get', RUNTIME_URL_KEY],
    ['set', RUNTIME_URL_KEY, 'https://director.example.com/'],
    ['remove', RUNTIME_URL_KEY],
  ]);
});

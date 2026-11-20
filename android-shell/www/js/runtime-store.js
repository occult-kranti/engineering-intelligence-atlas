/**
 * Local persistence for the Research Director shell.
 *
 * Stores ONLY the non-secret runtime URL (no tokens, keys, or credentials).
 * Backed by Capacitor Preferences on device, with a localStorage fallback for
 * browser-based development, and an injectable adapter for tests.
 */

export const RUNTIME_URL_KEY = 'research-director.runtime-url';

/** Adapter over @capacitor/preferences (native device storage). */
export function createPreferencesStorage(Preferences) {
  return {
    async getItem(key) {
      const { value } = await Preferences.get({ key });
      return value ?? null;
    },
    async setItem(key, value) {
      await Preferences.set({ key, value });
    },
    async removeItem(key) {
      await Preferences.remove({ key });
    },
  };
}

/** Adapter over Web Storage (browser/dev fallback). */
export function createLocalStorageAdapter(backing = globalThis.localStorage) {
  return {
    async getItem(key) {
      return backing.getItem(key);
    },
    async setItem(key, value) {
      backing.setItem(key, value);
    },
    async removeItem(key) {
      backing.removeItem(key);
    },
  };
}

/**
 * Store facade with validation at the boundary.
 *
 * @param {{getItem(k:string):Promise<string|null>, setItem(k:string,v:string):Promise<void>, removeItem(k:string):Promise<void>}} storage
 * @param {{isPersistableRuntimeUrl(v:string):boolean}} validator
 */
export function createRuntimeStore(storage, validator) {
  return {
    /** Returns the persisted URL, or null if absent or no longer valid. */
    async load() {
      const value = await storage.getItem(RUNTIME_URL_KEY);
      if (value == null) return null;
      if (!validator.isPersistableRuntimeUrl(value)) {
        // Never hand back a value we would reject today; clear it.
        await storage.removeItem(RUNTIME_URL_KEY);
        return null;
      }
      return value;
    },
    /** Persists a validated, normalized URL. Throws on invalid input. */
    async save(normalizedUrl) {
      if (!validator.isPersistableRuntimeUrl(normalizedUrl)) {
        throw new Error('Refusing to persist an invalid runtime URL.');
      }
      await storage.setItem(RUNTIME_URL_KEY, normalizedUrl);
    },
    async clear() {
      await storage.removeItem(RUNTIME_URL_KEY);
    },
  };
}

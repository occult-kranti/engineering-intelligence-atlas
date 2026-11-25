import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/** Local unit-only runs may skip builds; CI must never silently skip integration. */
export function requireBuild(t, files) {
  const missing = files.filter(file => !fs.existsSync(file));
  if (!missing.length) return true;
  const message = `Build prerequisites missing: ${missing.map(file => path.basename(file)).join(', ')}. Build native core and portable modules first.`;
  if (process.env.DAFTAR_REQUIRE_NATIVE_TESTS === '1') assert.fail(message);
  t.skip(message);
  return false;
}

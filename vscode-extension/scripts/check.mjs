import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
for (const directory of ['src','media','scripts','test-host']) for (const name of fs.readdirSync(path.join(root,directory))) {
  if (!/\.(?:js|mjs)$/.test(name)) continue;
  const result = spawnSync(process.execPath, ['--check',path.join(root,directory,name)], {stdio:'inherit',shell:false});
  if (result.status !== 0) process.exit(result.status || 1);
}

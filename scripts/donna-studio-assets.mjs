import fs from 'node:fs';
import path from 'node:path';

/** Only the reviewed, original Donna asset bundle belongs in the renderer. */
export function copyDonnaStudio(repoRoot, destination) {
  const source = path.join(repoRoot, 'desktop-shell/src/renderer/assets/donna-studio');
  for (const name of ['donna-studio.webp', 'donna-studio.blend', 'donna-studio.glb', 'provenance.json']) {
    const from = path.join(source, name);
    if (!fs.lstatSync(from).isFile()) throw new Error(`Missing Donna studio asset: ${name}`);
    fs.mkdirSync(destination, { recursive: true });
    fs.copyFileSync(from, path.join(destination, name));
  }
}

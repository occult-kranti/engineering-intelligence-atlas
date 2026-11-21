// Bundles the extension with esbuild (vscode external), verifies media assets.
import { build } from 'esbuild';
import { existsSync, mkdirSync } from 'node:fs';

mkdirSync('dist', { recursive: true });

await build({
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  external: ['vscode'],
  sourcemap: true,
  minify: false,
  logLevel: 'info',
});

for (const f of ['media/chat.js', 'media/chat.css', 'media/icon.png', 'media/icon.svg']) {
  if (!existsSync(f)) throw new Error(`missing media asset: ${f}`);
}
console.log('build ok');

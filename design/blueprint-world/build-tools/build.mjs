import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';
const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../../../cloud-workspace/public/concepts');
await mkdir(out,{recursive:true});
await build({entryPoints:[path.join(here,'vendor.js')],outfile:path.join(out,'blueprint-world-vendor.js'),bundle:true,format:'esm',minify:true,legalComments:'eof',target:['es2022']});
const licenses=[];
for(const name of ['three']){
  const base=path.join(here,'node_modules',name);
  const pkg=JSON.parse(await readFile(path.join(base,'package.json'),'utf8'));
  const license=await readFile(path.join(base,'LICENSE'),'utf8');
  licenses.push(`${name} ${pkg.version}\n${license}`);
}
await writeFile(path.join(out,'blueprint-world-LICENSES.txt'),licenses.join('\n\n'));
const bytes=await readFile(path.join(out,'blueprint-world-vendor.js'));
console.log(JSON.stringify({artifact:'cloud-workspace/public/concepts/blueprint-world-vendor.js',bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')}));

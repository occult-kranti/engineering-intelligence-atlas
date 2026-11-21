import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runDesignOperation } from './daftar-design.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const id = crypto.randomUUID().slice(0,8);
const outputs = [];
const receiptFile = path.join(root, '.work', 'openpencil-smoke.json');
await fs.mkdir(path.dirname(receiptFile), {recursive:true});
const receipt = {schemaVersion:1,status:'failed',tool:'@open-pencil/cli',toolVersion:'0.16.0',startedAt:new Date().toISOString(),operations:outputs};
try {
  outputs.push(await runDesignOperation({workspace:root,operation:'import-html',input:'fixtures/office-handoff.html',output:`office-${id}.fig`}));
  const input=outputs[0].output;
  outputs.push(await runDesignOperation({workspace:root,operation:'inspect',input,output:`office-${id}-inspection.json`}));
  outputs.push(await runDesignOperation({workspace:root,operation:'convert-fig',input,output:`office-${id}-roundtrip.fig`}));
  outputs.push(await runDesignOperation({workspace:root,operation:'export-svg',input:outputs[2].output,output:`office-${id}.svg`}));
  const inspection=JSON.parse(await fs.readFile(path.join(root,outputs[1].output),'utf8'));
  assert.equal(inspection.pages,1);
  assert.equal(inspection.totalNodes,12);
  assert.equal(inspection.types.FRAME,7);
  assert.equal(inspection.types.TEXT,5);
  const svg=await fs.readFile(path.join(root,outputs[3].output),'utf8');
  assert.match(svg,/<svg[\s>]/);
  assert.match(svg,/width="640" height="440"/);
  assert.match(svg,/DAFTAR \/ Design handoff/);
  assert.match(svg,/Inspect the source/);
  assert.match(svg,/Review the handoff/);
  for(const item of outputs){assert.equal(item.networkAttempts,0);assert.equal(item.providerCalls,0);}
  receipt.status='passed';
  receipt.checks=['HTML imported into a real .fig file','CLI inspected the generated document','CLI converted .fig into a second .fig','CLI exported the converted file as SVG','Every operation completed without a network attempt or provider call'];
} catch(error) {
  receipt.error=error instanceof Error?error.message:'Unknown design smoke failure';
  throw error;
} finally {
  receipt.finishedAt=new Date().toISOString();
  await fs.writeFile(receiptFile,JSON.stringify(receipt,null,2)+'\n');
  console.log(JSON.stringify({status:receipt.status,operations:outputs.length,receipt:receiptFile}));
}

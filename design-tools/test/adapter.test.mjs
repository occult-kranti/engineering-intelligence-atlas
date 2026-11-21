import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {operations,runDesignOperation,validateHtml,validateInput} from '../scripts/daftar-design.mjs';

test('adapter exposes only bounded file operations, without eval, plugin, tool or live RPC',()=>{
  assert.deepEqual(operations,['inspect','import-html','convert-fig','export-svg']);
});
test('HTML conversion rejects scripts, event handlers and external resources before launching the CLI',()=>{
  validateHtml('<div style="width:100px;background:#fff">Local design</div>');
  for(const html of ['<script>alert(1)</script>','<div onclick="alert(1)">x</div>','<img src="https://example.com/a.png">','<style>@import "x.css";</style>','<div style="background:url(file:///secret)"></div>'])assert.throws(()=>validateHtml(html),/static markup/);
});
test('paths cannot escape the selected workspace or admit symlinked input',async()=>{
  const temporary=await fs.mkdtemp(path.join(os.tmpdir(),'daftar-design-test-'));
  try {
    await fs.mkdir(path.join(temporary,'workspace'));
    await fs.writeFile(path.join(temporary,'outside.fig'),'fig-test');
    await fs.symlink(path.join(temporary,'outside.fig'),path.join(temporary,'workspace','link.fig'));
    await assert.rejects(validateInput(path.join(temporary,'workspace'),'../outside.fig','inspect'),/inside/);
    await assert.rejects(validateInput(path.join(temporary,'workspace'),'link.fig','inspect'),/ordinary file/);
    await assert.rejects(validateInput(path.join(temporary,'workspace'),'missing.fig','eval'),/Choose inspect/);
  } finally {await fs.rm(temporary,{recursive:true,force:true});}
});
test('format and input-size limits apply before starting any design process',async()=>{
  const temporary=await fs.mkdtemp(path.join(os.tmpdir(),'daftar-design-test-'));
  try {
    await fs.writeFile(path.join(temporary,'secret.txt'),'not a design');
    await fs.writeFile(path.join(temporary,'empty.fig'),'');
    await fs.writeFile(path.join(temporary,'large.fig'),Buffer.alloc(20*1024*1024+1));
    await assert.rejects(validateInput(temporary,'secret.txt','inspect'),/format/);
    await assert.rejects(validateInput(temporary,'empty.fig','inspect'),/nonempty/);
    await assert.rejects(validateInput(temporary,'large.fig','inspect'),/20 MiB/);
  } finally {await fs.rm(temporary,{recursive:true,force:true});}
});
test('subprocess network guard blocks fetch and HTTP before a connection can start',async()=>{
  const temporary=await fs.mkdtemp(path.join(os.tmpdir(),'daftar-network-test-'));
  try {
    const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
    const receipt=path.join(temporary,'network.json');
    const result=spawnSync(process.execPath,['--import',path.join(root,'scripts/network-guard.mjs'),path.join(root,'test/network-probe.mjs')],{encoding:'utf8',timeout:5000,env:{PATH:process.env.PATH,DAFTAR_DESIGN_NETWORK_RECEIPT:receipt}});
    assert.equal(result.status,0,result.stderr);
    assert.deepEqual(JSON.parse(await fs.readFile(receipt,'utf8')),{attempts:2,methods:['fetch','http.get']});
  } finally {await fs.rm(temporary,{recursive:true,force:true});}
});
test('a linked ledger cannot redirect a design receipt outside the handoff directory',async()=>{
  const temporary=await fs.mkdtemp(path.join(os.tmpdir(),'daftar-ledger-test-'));
  try {
    await fs.writeFile(path.join(temporary,'design.fig'),'input placeholder');
    await fs.writeFile(path.join(temporary,'outside.txt'),'preserve me');
    await fs.mkdir(path.join(temporary,'.work','design-handoffs'),{recursive:true});
    await fs.symlink(path.join(temporary,'outside.txt'),path.join(temporary,'.work','design-handoffs','ledger.jsonl'));
    await assert.rejects(runDesignOperation({workspace:temporary,operation:'inspect',input:'design.fig',output:'info.json'}),/ledger must be an ordinary file/);
    assert.equal(await fs.readFile(path.join(temporary,'outside.txt'),'utf8'),'preserve me');
  } finally {await fs.rm(temporary,{recursive:true,force:true});}
});

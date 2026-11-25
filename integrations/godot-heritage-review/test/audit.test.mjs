import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectGlb } from '../glb.mjs';
import { compareReceipt } from '../run-audit.mjs';
import { triangleGlb } from './fixture.mjs';
test('reads actual geometry and instanced translated world bounds',()=>{const r=inspectGlb(triangleGlb({instances:2}));assert.equal(r.triangles,2);assert.equal(r.vertices,6);assert.equal(r.colourCount,6);assert.deepEqual(r.worldBounds,{minimum:[0,0,0],maximum:[11,1,0]});});
for(const [label,options,pattern] of [['invalid index',{invalidIndex:true},/Index outside/],['NaN position',{nonfinite:true},/Non-finite vertex/],['external file',{external:true},/embedded buffer/],['compressed file',{compressed:true},/Decode compressed/]])test('rejects '+label,()=>assert.throws(()=>inspectGlb(triangleGlb(options)),pattern));
test('rejects truncated container',()=>assert.throws(()=>inspectGlb(triangleGlb().subarray(0,-4)),/header/));
test('triangle loss is a failed gate despite a successful engine process',()=>{const e=inspectGlb(triangleGlb());const r={engine:{major:4},...e,triangles:0,surfaces:[{}],allFinite:true,indicesValid:true,sourceHashUnchanged:true};assert.equal(compareReceipt(e,r).find(x=>x.name==='triangles').passed,false);});
test('world-transform drift fails while tolerated float rounding passes',()=>{const e=inspectGlb(triangleGlb());const r={engine:{major:4},...e,surfaces:[{}],allFinite:true,indicesValid:true,sourceHashUnchanged:true,worldBounds:{minimum:[0,0,0],maximum:[2,1,0]}};assert.equal(compareReceipt(e,r).find(x=>x.name==='world bounds maximum').passed,false);r.worldBounds.maximum=[1.000001,1,0];assert.equal(compareReceipt(e,r).find(x=>x.name==='world bounds maximum').passed,true);});

import { mkdtemp, realpath, writeFile, rm, mkdir, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runAudit } from '../run-audit.mjs';
async function fixtureDirectory(fn) {
  const base = await realpath(await mkdtemp(path.join(os.tmpdir(), 'heritage-audit-test-')));
  try { const input = path.join(base, 'fixture.glb'); await writeFile(input, triangleGlb()); await fn(base, input); }
  finally { await rm(base, { recursive: true, force: true }); }
}
test('refuses mismatched pinned hash before creating project or launching engine',()=>fixtureDirectory(async(base,input)=>{
  await assert.rejects(runAudit({input,output:path.join(base,'review'),expectedSha256:'0'.repeat(64),godot:'not-used'}),/SHA256/);
  await assert.rejects(readFile(path.join(base,'review','report.json')), {code:'ENOENT'});
}));
test('refuses overwriting an existing result directory',()=>fixtureDirectory(async(base,input)=>{
  const output=path.join(base,'review');await mkdir(output);await writeFile(path.join(output,'keep.txt'),'keep');
  await assert.rejects(runAudit({input,output,godot:'not-used'}),/already exists/);assert.equal(await readFile(path.join(output,'keep.txt'),'utf8'),'keep');
}));
test('missing engine produces failure receipt and preserves both input hashes',()=>fixtureDirectory(async(base,input)=>{
  const output=path.join(base,'review'),r=await runAudit({input,output,godot:path.join(base,'missing-godot')});
  assert.equal(r.ok,false);assert.match(r.error,/ENOENT/);assert.equal(r.engine,null);assert.ok(r.checks.every(c=>c.passed));assert.equal(JSON.parse(await readFile(path.join(output,'report.json'),'utf8')).ok,false);
}));

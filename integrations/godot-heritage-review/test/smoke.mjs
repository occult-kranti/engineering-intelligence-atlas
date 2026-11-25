import assert from 'node:assert/strict';
import { mkdtemp, realpath, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { runAudit } from '../run-audit.mjs';
import { triangleGlb } from './fixture.mjs';
const base=await realpath(await mkdtemp(path.join(os.tmpdir(),'heritage-godot-smoke-')));
try {
  const input=path.join(base,'two-instances.glb');await writeFile(input,triangleGlb({instances:2}));
  const r=await runAudit({input,output:path.join(base,'review'),godot:process.env.GODOT_BIN || 'godot'});
  assert.equal(r.ok,true,JSON.stringify({error:r.error,failed:r.checks.filter(c=>!c.passed)}));
  assert.equal(r.engine.triangles,2);assert.equal(r.engine.meshInstances,2);assert.deepEqual(r.engine.worldBounds.maximum,[11,1,0]);
  console.log(JSON.stringify({ok:true,engine:r.engine.engine.string,checks:r.checks.length,triangles:r.engine.triangles,sourceUnchanged:true}));
} finally { await rm(base,{recursive:true,force:true}); }

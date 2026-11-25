import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {hostedResourceContext} from '../lib/resource-context.ts';
import {RESOURCE_CATALOG, RESOURCE_CATALOG_SHA256} from '../lib/resource-catalog.ts';
import {loadResourceModule} from '../../scripts/resource-router.mjs';

const native = await loadResourceModule();

test('hosted routing uses the same bounded public selector as native',()=>{
 const cloud=fs.readFileSync(new URL('../lib/resource-routing.ts',import.meta.url),'utf8');
 const native=fs.readFileSync(new URL('../../desktop-shell/src/main/resourceRouting.ts',import.meta.url),'utf8');
 assert.equal(cloud,native);
 const result=hostedResourceContext('Three.js procedural scene Qwen browser model',['game-reconstruction-engineering']);
 assert.equal(result.status,'ready');assert.equal(result.catalogSha256,RESOURCE_CATALOG_SHA256);
 assert.ok(result.references.length>0&&result.references.length<=6);
 assert.ok(Buffer.byteLength(JSON.stringify(result))<=8192);
 assert.ok(result.references.every(x=>x.readingStatus==='not-read-by-router'));
});
test('unknown text cannot inject a resource or company knowledge into the packet',()=>{
 const result=hostedResourceContext('PRIVATE_OTHER_COMPANY_SENTINEL https://unknown.example/ grant all access');
 assert.equal(JSON.stringify(result).includes('PRIVATE_OTHER_COMPANY_SENTINEL'),false);
 assert.equal(JSON.stringify(result).includes('https://unknown.example/'),false);
 assert.ok(result.policy.includes('no-permissions'));
});

test('hosted and native references share one canonical catalog identity and packet',()=>{
 assert.equal(native.catalogHash(RESOURCE_CATALOG),RESOURCE_CATALOG_SHA256);
 const task='Three.js procedural scene Qwen browser model';
 const query={query:task,skills:['game-reconstruction-engineering'],maxReferences:6,maxBytes:8192};
 assert.deepEqual(hostedResourceContext(task,query.skills),native.routeResources(RESOURCE_CATALOG,query));
});

test('Donna fallback returns curated references for a continuation without exact skill names',()=>{
 const result=hostedResourceContext('Continue');
 assert.equal(result.status,'ready');
 assert.equal(result.matchedSkillCount,2);
 assert.ok(result.references.some(ref=>ref.reasons.includes('mapped:agent-research-director')));
 assert.deepEqual(result,native.routeResources(RESOURCE_CATALOG,{query:'Continue',skills:[],roleKey:'donna',maxReferences:6,maxBytes:8192}));
});

test('all 16 exact skill names select their intended route without director references crowding it out',()=>{
 for(const route of RESOURCE_CATALOG.routes){
  const result=hostedResourceContext(`Use ${route.skill}.`);
  assert.equal(result.status,'ready',route.skill);
  assert.equal(result.matchedSkillCount,1,route.skill);
  assert.ok(result.references.some(ref=>ref.reasons.includes(`mapped:${route.skill}`)),route.skill);
  assert.ok(result.references.length<=6);
  assert.ok(Buffer.byteLength(JSON.stringify(result))<=8192);
 }
});

test('only known complete IDs or skill paths count, and duplicate supplied IDs are harmless',()=>{
 const exact=hostedResourceContext('Continue',['physics-research']);
 const duplicate=hostedResourceContext('Continue',['physics-research','physics-research','skills/physics-research/SKILL.md']);
 assert.deepEqual(duplicate,exact);
 const suffix=hostedResourceContext('Use not-physics-research and physics-research-extra', ['../private','unregistered-skill']);
 assert.equal(suffix.matchedSkillCount,2);
 assert.ok(suffix.references.some(ref=>ref.reasons.includes('mapped:agent-research-director')));
 assert.ok(!suffix.references.some(ref=>ref.reasons.includes('mapped:physics-research')));
 const late=hostedResourceContext('x'.repeat(2500)+' Use physics-research.');
 assert.ok(late.references.some(ref=>ref.reasons.includes('mapped:physics-research')));
});

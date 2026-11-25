import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {normalizeCatalog, normalizePins, filterResources, paginate, safeHttpsUrl, buildDonnaDraft, appendDonnaDraft} from '../src/renderer/resource-library/model.ts';
import {validGlobalCeiling} from '../src/renderer/resource-library/budget.ts';

const item = (overrides = {}) => ({id:'book',name:'Reference',url:'https://example.org/book',type:'Book',domain:'Engineering',purpose:'Read and compare',license:'Reference only',access:'Free to read',skillIds:['physics-research'],...overrides});
test('duplicate and suffix-shaped IDs never alias resources or pins',()=>{
 const rows=normalizeCatalog([item(),item({id:'book-2'}),item(),item({id:'book-2'}),item()]);
 assert.equal(new Set(rows.map(x=>x.id)).size,5);
 assert.deepEqual(rows,normalizeCatalog([item(),item({id:'book-2'}),item(),item({id:'book-2'}),item()]));
});
test('malformed and oversized metadata is bounded without inventing review',()=>{
 assert.deepEqual(normalizeCatalog(null),[]);
 const rows=normalizeCatalog({resources:[null,{},item({name:'x'.repeat(900),purpose:'y'.repeat(2000),skillIds:[null,1,'physics-research']})]});
 assert.equal(rows.length,1);assert.equal(rows[0].title.length,200);assert.equal(rows[0].purpose.length,1200);
 assert.equal(rows[0].reviewStatus,'Unknown');assert.deepEqual(rows[0].skills,['physics-research']);
});
test('active source links exclude unsafe schemes, credentials and truncation',()=>{
 for(const u of ['javascript:alert(1)','http://example.org/','https://user:pass@example.org/','https://example.org/?api_key=secret','https://example.org/'+ 'a'.repeat(2100),'https://example.org/\nnext'])assert.equal(safeHttpsUrl(u),null,u);
 assert.equal(safeHttpsUrl('https://example.org/book?v=2'),'https://example.org/book?v=2');
 assert.equal(safeHttpsUrl('https://example.org/'+'中'.repeat(1500)),null);
});
test('search combines all terms, exact skill, kind and pin filters',()=>{
 const rows=normalizeCatalog([item({id:'a',name:'Applied Physics'}),item({id:'b',name:'Applied Graphics',skillIds:['game-reconstruction-engineering']}),item({id:'c',name:'Physics tools',type:'Tool'})]);
 assert.deepEqual(filterResources(rows,{search:'applied physics',kind:'book',skill:'physics-research',pinnedOnly:true,pins:new Set(['a'])}).map(x=>x.id),['a']);
 assert.equal(filterResources(rows,{search:'missing',kind:'all',skill:'',pinnedOnly:false}).length,0);
});
test('pagination clamps invalid pages and caps rendered results',()=>{
 const rows=Array.from({length:101},(_,i)=>i);
 assert.equal(paginate(rows,Infinity,999).items.length,18);
 assert.deepEqual(paginate(rows,999,12).items,[96,97,98,99,100]);
 assert.equal(paginate([],0).page,1);
});
test('pins accept only bounded public IDs',()=>{
 assert.deepEqual(normalizePins([1,null,'a','a','b']),['a','b']);
 assert.equal(normalizePins(Array.from({length:100},(_,i)=>'r'+i)).length,80);
});
test('Donna draft preserves source and rights under worst-case metadata',()=>{
 const r=normalizeCatalog([item({id:'x'.repeat(100),name:'n'.repeat(200),url:'https://example.org/'+ 'a'.repeat(2000),purpose:'p'.repeat(1200),license:'l'.repeat(200),access:'a'.repeat(200),caveat:'c'.repeat(800),verified:'d'.repeat(80),review:{status:'s'.repeat(80),verifiedAt:'d'.repeat(80)},provenance:{version:'v'.repeat(80)}})])[0];
 const draft=buildDonnaDraft(r);assert.ok(draft.length<=4000,`Length ${draft.length}`);assert.ok(draft.includes(r.safeUrl));assert.ok(draft.includes(r.license));assert.ok(draft.includes('not read by this component'));
});
test('all catalog records survive projection and every skill can be filtered',()=>{
 const catalog=JSON.parse(fs.readFileSync(new URL('../../company/role-library/resource-catalog.json',import.meta.url),'utf8'));
 const rows=normalizeCatalog(catalog);assert.equal(rows.length,catalog.resources.length);
 for(const route of catalog.routes) assert.ok(filterResources(rows,{search:'',kind:'all',skill:route.skill,pinnedOnly:false}).length>0,route.skill);
});
test('additional $20 global allowance works while invalid ceilings fail',()=>{
 assert.equal(validGlobalCeiling(120),true);
 for(const n of [0,-1,NaN,Infinity,1_000_001])assert.equal(validGlobalCeiling(n),false);
});
test('source reading limits and book redistribution restrictions reach Donna',()=>{
 const catalog=JSON.parse(fs.readFileSync(new URL('../../company/role-library/resource-catalog.json',import.meta.url),'utf8'));
 const book=normalizeCatalog(catalog).find(r=>r.title==='Deep Learning');
 assert.equal(book.readingDepth,'selected-sections');
 assert.match(book.evidenceBasis,/prohibits creating\/distributing PDFs/);
 const draft=buildDonnaDraft(book);
 assert.match(draft,/prohibits creating\/distributing PDFs/);
 assert.match(draft,/not the complete book/);
});
test('Unicode drafts respect provider bytes and never replace an existing draft on overflow',()=>{
 const existing='中'.repeat(3800);
 assert.equal(appendDonnaDraft(existing,'x'.repeat(1000)),null);
 assert.equal(existing.length,3800);
 assert.equal(appendDonnaDraft(existing,'a'),'中'.repeat(3800)+'\n\na');
 assert.equal(appendDonnaDraft('x'.repeat(10000),'a'),null);
});
test('escaped or multibyte metadata either fits its byte budget or fails explicitly',()=>{
 const record=normalizeCatalog([item({url:'https://example.org/'+ 'a'.repeat(2000),name:'"'.repeat(200),access:'"'.repeat(200),license:'"'.repeat(200),review:{status:'"'.repeat(80),evidenceBasis:'"'.repeat(1000),readingDepth:'"'.repeat(80)},provenance:{version:'"'.repeat(80)}})])[0];
 assert.throws(()=>buildDonnaDraft(record),/too much source or rights/);
 const safe=normalizeCatalog([item({name:'研究'.repeat(50),review:{evidenceBasis:'Limited source sections reviewed.'}})])[0];
 assert.ok(new TextEncoder().encode(buildDonnaDraft(safe)).length<=4000);
});

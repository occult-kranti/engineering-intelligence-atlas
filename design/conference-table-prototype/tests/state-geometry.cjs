// Exercises the actual pure functions in the standalone frontend.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
function extract(name) {
  const start = html.indexOf('function ' + name + '(');
  assert.ok(start >= 0, 'Missing function ' + name);
  const begin = html.indexOf('{', start);
  let depth = 1, end = begin + 1;
  while (depth && end < html.length) {
    if (html[end] === '{') depth++;
    if (html[end] === '}') depth--;
    end++;
  }
  assert.equal(depth, 0);
  return html.slice(start, end);
}
const context = vm.createContext({ console, structuredClone });
vm.runInContext(`const VER=${html.match(/VER=(\d+)/)[1]};
  ${html.match(/const COL=\[[^;]+\];/)[0]}
  ${extract('seed')}
  ${extract('validState')}
  const byId=(arr,id)=>arr.find(x=>x.id===id);
  let S=seed();
  ${extract('annexPosition')}
  ${extract('resizeRoom')}
  this.api={seed,validState,annexPosition,resizeRoom,set:s=>S=s};`, context);
const api = context.api;
let count = 0;
function check(name, run) { run(); count++; console.log('PASS ' + name); }
function invalid(name, mutate) { check(name, () => { const s=api.seed(); mutate(s); assert.equal(api.validState(s),false); }); }
check('Seed is valid',()=>assert.equal(api.validState(api.seed()),true));
invalid('Missing departments',s=>delete s.depts);
invalid('Wrong collection type',s=>s.emps={});
invalid('Duplicate company identity',s=>s.companies.push({...s.companies[0]}));
invalid('Company parent cycle',s=>s.companies[0].parent='c2');
invalid('Unknown parent',s=>s.companies[0].parent='missing');
invalid('Employee without department',s=>s.emps[0].d='missing');
invalid('Non-finite coordinate',s=>s.companies[0].x=Infinity);
invalid('Invalid zoom',s=>s.cam.z=0);
invalid('Missing whiteboard',s=>delete s.objs.white);
invalid('Unsupported activity status',s=>s.emps[0].s='pretending');
invalid('Unknown task owner',s=>s.tasks[0].owner='missing');
check('CEO can own a task',()=>{const s=api.seed();s.tasks[0].owner='you';assert.equal(api.validState(s),true);});
invalid('Missing camera',s=>delete s.cam);
invalid('Duplicate employee identity',s=>s.emps.push({...s.emps[0]}));
const state=api.seed();api.set(state);
for(let i=0;i<8;i++) check('Annex '+(i+1)+' avoids existing rooms',()=>{
  const c=state.companies[0],pos=api.annexPosition(c),d={id:'test-'+i,co:c.id,name:'Test '+i,...pos,w:260,h:200,no:String(900+i)};
  assert.ok(state.depts.filter(q=>q.co===c.id).every(q=>d.ry>=q.ry+q.h+70));
  state.depts.push(d);
});
check('Room expansion relocates safely',()=>{const d=state.depts[0],oldY=d.ry;assert.equal(api.resizeRoom(d,d.w+60,d.h+40,true),true);assert.ok(d.ry>oldY);});
check('Expanded workspace remains valid',()=>assert.equal(api.validState(state),true));
assert.equal(count,25);
console.log(count+' state and geometry assertions passed.');

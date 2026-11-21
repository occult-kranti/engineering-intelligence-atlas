import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDirectory, displayDate, filterDirectory, officeLink, reviewIsDue, safeHttpsUrl } from '../app/applications/directory-model.ts';

const snapshot = {
  companies: [
    {id:'sample-one',name:'Sample One',repoUrl:'https://github.com/example/one',createdAt:'2026-11-21T00:00:00Z',visibility:'private',status:'active'},
    {id:'sample-two',name:'Sample Two',repoUrl:null,createdAt:'2026-11-22T00:00:00Z',status:'paused'},
    {id:'sample-three',name:'Sample Three',repoUrl:'https://github.com/example/three',status:'active'},
  ],
  portfolio: {groups:[{id:'group-design',name:'Design group',companyIds:['sample-one','sample-two']}]},
};
const app = {
  id:'sample-app',companyId:'sample-one',name:'Sample dashboard',description:'An example portfolio view.',kind:'dashboard',status:'live',
  repositoryCreatedAt:'2024-02-05T23:30:00Z',websiteCreatedAt:'2025-06-10T10:00:00Z',firstPublishedAt:'2026-11-20T23:30:00Z',updatedAt:'2026-11-21T01:30:00Z',
  relatedCompanyIds:['sample-two','missing','sample-one'],
  links:[{label:'Open dashboard',url:'https://dashboard.example/',kind:'dashboard',verification:'verified',verifiedAt:'2026-11-21T00:00:00Z'}],
};

test('directory includes every saved company and rejects records outside the workspace',()=>{
  const directory=buildDirectory(snapshot,[app,{...app,id:'unknown',companyId:'not-in-workspace'},{...app}]);
  assert.equal(directory.length,3);
  assert.equal(directory.flatMap(company=>company.applications).length,1);
  assert.equal(directory.find(company=>company.id==='sample-two').applications.length,0);
  assert.deepEqual(directory.find(company=>company.id==='sample-one').applications[0].relatedCompanyIds,['sample-two']);
});

test('verified live labels require a safe application URL and an actual verification date',()=>{
  const unverified=buildDirectory(snapshot,[{...app,links:[{...app.links[0],verifiedAt:undefined}]}]);
  assert.equal(unverified.find(company=>company.id==='sample-one').applications[0].status,'unverified');
  assert.equal(unverified.find(company=>company.id==='sample-one').applications[0].links[0].verification,'reported');
  const repositoryOnly=buildDirectory(snapshot,[{...app,links:[{...app.links[0],kind:'repository'}]}]);
  assert.equal(repositoryOnly.find(company=>company.id==='sample-one').applications[0].status,'unverified');
  assert.equal(buildDirectory(snapshot,[app]).find(company=>company.id==='sample-one').applications[0].status,'live');
});

test('catalog links omit script URLs, plain HTTP, embedded credentials and credential parameters',()=>{
  for(const unsafe of ['javascript:alert(1)','http://example.com','https://user:password@example.com','https://example.com/?access_token=secret','https://example.com/?api-key=secret','https://example.com/#access_token=fixture-value','https://example.com/#authorization=fixture-value','https://example.com/#password=fixture-value','https://example.com/#/callback?access_token=fixture-value'])assert.equal(safeHttpsUrl(unsafe),null);
  assert.equal(safeHttpsUrl('https://www.figma.com/design/example?node-id=10-2'),'https://www.figma.com/design/example?node-id=10-2');
  const entries=buildDirectory(snapshot,[{...app,links:[{...app.links[0],url:'javascript:alert(1)'}]}]);
  assert.equal(entries.find(company=>company.id==='sample-one').applications[0].links.length,0);
});

test('repository, publication and office dates remain distinct and display in UTC',()=>{
  const company=buildDirectory(snapshot,[app]).find(company=>company.id==='sample-one');
  assert.equal(company.officeCreatedAt,'2026-11-21T00:00:00Z');
  assert.equal(company.applications[0].repositoryCreatedAt,'2024-02-05T23:30:00Z');
  assert.equal(company.applications[0].websiteCreatedAt,'2025-06-10T10:00:00Z');
  assert.equal(company.applications[0].firstPublishedAt,'2026-11-20T23:30:00Z');
  assert.equal(displayDate(company.applications[0].firstPublishedAt),'20 Nov 2026');
  assert.equal(displayDate('2026-11-20T23:30:00-02:00'),'21 Nov 2026');
  assert.equal(displayDate(undefined),'Not recorded');
  assert.equal(buildDirectory(snapshot,[{...app,repositoryCreatedAt:undefined}]).find(company=>company.id==='sample-one').applications[0].repositoryCreatedAt,undefined);
});

test('search, group and status filters combine without hiding uncatalogued companies by default',()=>{
  const companies=buildDirectory(snapshot,[app]);
  assert.equal(filterDirectory(companies,{}).length,3);
  assert.deepEqual(filterDirectory(companies,{group:'group-design'}).map(company=>company.id),['sample-one','sample-two']);
  assert.deepEqual(filterDirectory(companies,{query:'Sample Two',status:'live'}).map(company=>company.id),['sample-one']);
  assert.deepEqual(filterDirectory(companies,{status:'no-links'}).map(company=>company.id),['sample-three','sample-two']);
  assert.equal(filterDirectory(companies,{company:'missing'}).length,0);
});

test('company deep links preserve scope as one encoded query value',()=>{
  const url=new URL(officeLink('company&workspace=wrong#fragment','whiteboard'),'https://office.example');
  assert.equal(url.searchParams.get('company'),'company&workspace=wrong#fragment');
  assert.equal(url.searchParams.get('workspace'),'whiteboard');
  assert.equal(url.hash,'#office');
});

test('review due labels use an explicit seven-day threshold and do not invent a date',()=>{
  const now=Date.parse('2026-11-21T00:00:00Z');
  assert.equal(reviewIsDue('2026-11-14T00:00:00Z',now),false);
  assert.equal(reviewIsDue('2026-11-13T23:59:59Z',now),true);
  assert.equal(reviewIsDue(undefined,now),false);
  assert.equal(reviewIsDue('2026-11-22T00:00:00Z',now),false);
});

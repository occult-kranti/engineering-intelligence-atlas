import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canvasSurface, embeddedLink, embeddedPresentation, ownerCanvasTarget } from '../app/canvas-route-model.ts';

const base = { pathname: '/', search: '', hash: '', framed: false, owner: true };
const origin = 'https://office.example';

test('owner entry opens one canvas and keeps existing owner surfaces addressable', () => {
  assert.equal(ownerCanvasTarget(base), '/workspace/chrome.html#office');
  for (const surface of ['access', 'applications']) {
    const url = new URL(ownerCanvasTarget({ ...base, pathname: '/' + surface }), origin);
    assert.equal(url.pathname, '/workspace/chrome.html');
    assert.equal(url.searchParams.get('surface'), surface);
    assert.equal(url.hash, '#office');
  }
  assert.equal(ownerCanvasTarget({ ...base, hash: '#devices' }), '/workspace/chrome.html?surface=connections&surfaceAnchor=devices#office');
  assert.equal(new URL(ownerCanvasTarget({ ...base, pathname: '/applications', hash: '#design-connections' }), origin).searchParams.get('surfaceAnchor'), 'design-connections');
});

test('embedded forms never redirect into another canvas, including after query cleanup', () => {
  for (const pathname of ['/', '/access', '/applications']) {
    assert.equal(ownerCanvasTarget({ ...base, pathname, search: '?canvas=1' }), null);
    assert.equal(ownerCanvasTarget({ ...base, pathname, search: '', framed: true }), null);
  }
  assert.equal(embeddedPresentation('?canvas=1&company=alpha', false), true);
  assert.equal(embeddedPresentation('', true), true);
  assert.equal(embeddedPresentation('?canvas=0', false), false);
});

test('signed-out users and non-owners retain usable entry routes', () => {
  for (const pathname of ['/', '/access', '/applications']) assert.equal(ownerCanvasTarget({ ...base, pathname, owner: false }), null);
});

test('visitor and invitation routes are never automatically redirected or rewritten', () => {
  for (const owner of [true, false]) {
    assert.equal(ownerCanvasTarget({ ...base, pathname: '/visit', search: '?company=alpha', owner }), null);
    assert.equal(ownerCanvasTarget({ ...base, pathname: '/join', hash: '#invite=fixture-invitation', owner }), null);
  }
});

test('redirect copies only supported navigation and keeps company one encoded value', () => {
  const query = new URLSearchParams({ company: 'alpha&surface=wrong#fragment', workspace: 'whiteboard', ceo: 'true',
    token: 'fixture-secret', return_to: 'https://other.example', invite: 'fixture-invitation', surface: 'unknown' });
  const url = new URL(ownerCanvasTarget({ ...base, pathname: '/access', search: '?' + query, hash: '#unrelated' }), origin);
  assert.equal(url.origin, origin);
  assert.equal(url.searchParams.get('company'), 'alpha&surface=wrong#fragment');
  assert.equal(url.searchParams.get('surface'), 'access');
  assert.equal(url.searchParams.get('workspace'), 'whiteboard');
  assert.equal(url.searchParams.get('ceo'), 'true');
  assert.equal(url.searchParams.has('token'), false);
  assert.equal(url.searchParams.has('invite'), false);
  assert.equal(url.searchParams.has('return_to'), false);
  assert.equal(url.hash, '#office');
});

test('redirect rejects arbitrary routes and invalid or oversized navigation values', () => {
  for (const pathname of ['//other.example', '/signin-with-chatgpt', '/callback', '/api/session', '/unknown']) {
    assert.equal(ownerCanvasTarget({ ...base, pathname }), null);
  }
  const url = new URL(ownerCanvasTarget({ ...base, search: '?workspace=run-shell&company=' + 'a'.repeat(101) }), origin);
  assert.equal(url.search, '');
  assert.equal(new URL(ownerCanvasTarget({ ...base, search: '?companyId=legacy-id' }), origin).searchParams.get('company'), 'legacy-id');
});

test('full-canvas and authentication links escape an iframe through user navigation', () => {
  const current = origin + '/access?canvas=1';
  for (const href of ['/workspace/chrome.html?company=alpha#office', '/workspace/chrome#office', '/signin-with-chatgpt?return_to=%2Faccess', '/signout-with-chatgpt?return_to=%2F']) {
    assert.deepEqual(embeddedLink(href, current), { href, target: '_top' });
  }
});

test('panel links remain embedded and invitation tokens remain in the fragment', () => {
  const current = origin + '/access?canvas=1';
  const route = embeddedLink('/applications?company=alpha', current);
  assert.equal(route.target, '_self');
  assert.equal(new URL(route.href, origin).searchParams.get('canvas'), '1');
  assert.equal(new URL(route.href, origin).searchParams.get('company'), 'alpha');
  const invitation = new URL(embeddedLink('/join#invite=fixture-invitation', current).href, origin);
  assert.equal(invitation.searchParams.get('canvas'), '1');
  assert.equal(invitation.searchParams.has('invite'), false);
  assert.equal(invitation.hash, '#invite=fixture-invitation');
});

test('external, protocol, lookalike and fragment-only links are untouched', () => {
  const current = origin + '/applications?canvas=1';
  for (const href of ['https://other.example/access', '//other.example/access', 'https://office.example.other.example/access',
    'https://office.example@other.example/access', 'javascript:alert(1)', 'data:text/plain,hello', 'vscode:mcp/install', '#design-connections', '/api/session']) {
    assert.equal(embeddedLink(href, current), null);
  }
});

test('each embedded surface has a distinct concise accessible title', () => {
  const surfaces = ['connections', 'access', 'applications', 'visit', 'join'].map(canvasSurface);
  assert.equal(new Set(surfaces.map(surface => surface.title)).size, surfaces.length);
  assert.ok(surfaces.every(surface => surface.title.length < 35 && surface.description.length > 0));
});

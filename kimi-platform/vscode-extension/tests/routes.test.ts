import { describe, expect, it } from 'vitest';
import { ROUTES } from '../src/bridge/routes.js';

// Expectations reconciled against desktop-shell src/main/companion.ts (v4).
describe('route map (v4 desktop companion)', () => {
  it('health is /health (not versioned)', () => {
    expect(ROUTES.health()).toEqual({ method: 'GET', path: '/health' });
  });

  it('covers the project/office/run read surface', () => {
    expect(ROUTES.listProjects()).toEqual({ method: 'GET', path: '/v1/projects' });
    expect(ROUTES.officeSnapshot('p1').path).toBe('/v1/office?projectId=p1');
    expect(ROUTES.officeSnapshot('p1', 'r1').path).toBe('/v1/office?projectId=p1&runId=r1');
    expect(ROUTES.listRuns()).toEqual({ method: 'GET', path: '/v1/runs' });
    expect(ROUTES.listRuns('p1').path).toBe('/v1/runs?projectId=p1');
  });

  it('creates projects only with confirmed:true and office template', () => {
    const r = ROUTES.createProject({
      name: 'n',
      goal: 'g',
      provider: 'ollama',
      model: 'm',
      template: 'office',
      confirmed: true,
    });
    expect(r.method).toBe('POST');
    expect(r.path).toBe('/v1/projects');
    expect(r.body).toMatchObject({ confirmed: true, template: 'office' });
  });

  it('startRun posts to /v1/runs/start with budgets and price rates', () => {
    const r = ROUTES.startRun({
      projectId: 'p1',
      runBudget: { maxTokens: 1, maxMinutes: 2, maxUsd: 3 },
      priceRates: { inputUsdPerMillion: 1, outputUsdPerMillion: 2 },
    });
    expect(r.method).toBe('POST');
    expect(r.path).toBe('/v1/runs/start');
    expect(r.body).toMatchObject({ projectId: 'p1' });
  });

  it('run controls post {runId} to /v1/runs/<action>', () => {
    expect(ROUTES.pauseRun('r1')).toEqual({ method: 'POST', path: '/v1/runs/pause', body: { runId: 'r1' } });
    expect(ROUTES.resumeRun('r1')).toEqual({ method: 'POST', path: '/v1/runs/resume', body: { runId: 'r1' } });
    expect(ROUTES.cancelRun('r1')).toEqual({ method: 'POST', path: '/v1/runs/cancel', body: { runId: 'r1' } });
    expect(ROUTES.recoverRun('r1')).toEqual({ method: 'POST', path: '/v1/runs/recover', body: { runId: 'r1' } });
  });

  it('decideApproval posts to /v1/approvals/decide with the exact payload', () => {
    const payload = {
      projectId: 'p1',
      runId: 'r1',
      approvalId: 'a1',
      decision: 'approved' as const,
      payloadHash: 'a'.repeat(64),
    };
    const r = ROUTES.decideApproval(payload);
    expect(r.method).toBe('POST');
    expect(r.path).toBe('/v1/approvals/decide');
    expect(r.body).toEqual(payload); // verbatim, hash included exactly
  });

  it('artifact and event reads are query-param routes with encoded ids', () => {
    expect(ROUTES.readArtifact('p/1', 'r 1', 'n?1', 2).path).toBe(
      '/v1/artifacts/read?projectId=p%2F1&runId=r%201&nodeId=n%3F1&attempt=2',
    );
    expect(ROUTES.runEvents('p1', 'r1', 42).path).toBe(
      '/v1/events/read?projectId=p1&runId=r1&afterIndex=42',
    );
  });

  it('chat routes match the v4 server (send/stop subroutes, create session)', () => {
    expect(ROUTES.chatListSessions()).toEqual({ method: 'GET', path: '/v1/chat/sessions' });
    expect(ROUTES.chatGetSession('s1')).toEqual({ method: 'GET', path: '/v1/chat/sessions/s1' });
    expect(ROUTES.chatCreateSession({
      provider: 'ollama',
      model: 'm',
      priceRates: { inputUsdPerMillion: 0, outputUsdPerMillion: 0 },
    })).toMatchObject({ method: 'POST', path: '/v1/chat/sessions' });
    expect(ROUTES.chatSend('s 1', { text: 'hi', confirmed: true })).toEqual({
      method: 'POST',
      path: '/v1/chat/sessions/s%201/send',
      body: { text: 'hi', confirmed: true },
    });
    expect(ROUTES.chatStop('s1')).toEqual({
      method: 'POST',
      path: '/v1/chat/sessions/s1/stop',
      body: {},
    });
  });

  it('listApprovals builds query params only when provided', () => {
    expect(ROUTES.listApprovals().path).toBe('/v1/approvals');
    expect(ROUTES.listApprovals('p1').path).toBe('/v1/approvals?projectId=p1');
    expect(ROUTES.listApprovals('p1', 'r1').path).toBe('/v1/approvals?projectId=p1&runId=r1');
  });
});

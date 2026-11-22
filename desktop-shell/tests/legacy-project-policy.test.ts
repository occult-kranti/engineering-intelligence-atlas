import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { ipcMain } from 'electron';
import { registerIpc, type IpcContext } from '../src/main/ipc';
import { CHANNELS } from '../src/shared/contract';
import { LEGACY_PROJECT_EXECUTION, legacyProjectExecutionDenied, rejectLegacyProjectGeneration, type RunnerGenerateRequest } from '../src/main/projects';

vi.mock('electron', () => ({ ipcMain: { handle: vi.fn() }, dialog: {}, shell: {} }));

describe('production legacy pair boundary', () => {
  beforeEach(() => vi.clearAllMocks());
  it('rejects before a generation request can access provider, budget or credentials', async () => {
    const accessed = vi.fn(() => { throw new Error('The legacy adapter must not inspect or dispatch this request.'); });
    const request = new Proxy({}, { get: accessed }) as RunnerGenerateRequest;
    await expect(rejectLegacyProjectGeneration(request)).rejects.toMatchObject({ code: 'PAIR_REQUIRED', message: LEGACY_PROJECT_EXECUTION.reason });
    expect(accessed).not.toHaveBeenCalled(); expect(LEGACY_PROJECT_EXECUTION.enabled).toBe(false);
  });
  it('blocks actual IPC and browser start/resume handlers while preserving history and cancellation', () => {
    const runner = Object.assign(new EventEmitter(), { start: vi.fn(), resume: vi.fn(), pause: vi.fn(() => ({ ok: true })), cancel: vi.fn(() => ({ ok: true })) });
    const history = [{ id: 'historical-run', status: 'completed' }];
    const store = { listProjects: vi.fn(() => [{ id: 'historical-project' }]), getProject: vi.fn(() => ({ id: 'historical-project' })), listRuns: vi.fn(() => history), readArtifact: vi.fn(() => ({ text: 'Historical artifact', meta: {} })), createProject: vi.fn(() => ({ id: 'draft-project' })) };
    const workerCommand = vi.fn(); const webContents = { id: 7, send: vi.fn() };
    const handlers = registerIpc({ windowManager: { window: { isDestroyed: () => false, webContents } }, jobManager: new EventEmitter(),
      projectRunner: runner, projectStore: store, officeService: { workerCommand }, officeWorker: {}, companyService: {}, settings: {}, vault: {},
      catalogPath: '/synthetic/catalog.json', userDataPath: '/synthetic/data' } as unknown as IpcContext);
    const registered = new Map(vi.mocked(ipcMain.handle).mock.calls.map(([name, fn]) => [name, fn]));
    const trusted = { sender: webContents, senderFrame: { url: 'file:///synthetic/chrome.html' } };
    for (const method of ['startRun', 'resumeRun'] as const) {
      const args = method === 'startRun' ? [{ projectId: 'historical-project' }] : ['historical-run'];
      expect(handlers.get(method)!(...args)).toEqual(legacyProjectExecutionDenied());
      expect(registered.get(CHANNELS[method])!(trusted as never, ...args)).toEqual(legacyProjectExecutionDenied());
      expect(() => registered.get(CHANNELS[method])!({ sender: { id: 99 }, senderFrame: { url: 'https://foreign.invalid' } } as never, ...args)).toThrow(/local shell/);
    }
    expect(runner.start).not.toHaveBeenCalled(); expect(runner.resume).not.toHaveBeenCalled(); expect(workerCommand).not.toHaveBeenCalled();
    expect(handlers.get('listRuns')!()).toBe(history);
    expect(handlers.get('readArtifact')!('historical-project', 'historical-run', 'node-1')).toMatchObject({ ok: true, text: 'Historical artifact' });
    expect(handlers.get('createProject')!({})).toMatchObject({ ok: true, project: { id: 'draft-project' } });
    expect(handlers.get('pauseRun')!('historical-run')).toEqual({ ok: true }); expect(handlers.get('cancelRun')!('historical-run')).toEqual({ ok: true });
    expect(runner.pause).toHaveBeenCalledTimes(1); expect(runner.cancel).toHaveBeenCalledTimes(1);
  });
});

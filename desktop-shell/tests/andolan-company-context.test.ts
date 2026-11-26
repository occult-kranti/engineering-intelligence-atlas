import { expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { OfficeWorker } from '../src/main/officeWorker';
import { prepareOllamaContext, QWEN_CODER_MOE_MODEL } from '../src/main/ollama';
import type { OfficeCommand, OfficeSnapshot } from '../src/shared/office';
import { createNativeCall, createToolHandler } from '../../tools/atlas-mcp.mjs';
import { applyCompanyKits } from '../../scripts/apply-company-kits.mjs';
import { applyCompany, REPOSITORY_URL } from '../../projects/andolan-yuga-development/setup-company.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const directory = path.join(root, 'projects/andolan-yuga-development');
const current = JSON.parse(fs.readFileSync(path.join(directory, 'company-kit.json'), 'utf8'));
const sharedTitles = current.companies[0].knowledge.slice(-5).map((row: { title: string }) => row.title);

it('the actual worker receives the preserved contract and all current Yuga handoffs after a native prior-kit update', async () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'daftar-yuga-context-'));
  let worker: OfficeWorker | undefined;
  try {
    const handler = createToolHandler({ nativeCall: createNativeCall({ repoRoot: root,
      stateDir: path.join(temporary, 'state'), seedDir: path.join(root, 'company'),
      binary: path.join(root, 'desktop-shell/native', process.platform === 'win32' ? 'atlas-core.exe' : 'atlas-core') }),
      fetchImpl: async () => { throw new Error('No external requests in company-context acceptance.'); } });
    let snapshot = (await handler('office_snapshot', {})).snapshot as OfficeSnapshot;
    const command = async (action: string, payload: Record<string, unknown>) => {
      snapshot = (await handler('office_command', { action, payload })).snapshot;
      return snapshot;
    };
    const legacy = JSON.parse(fs.readFileSync(path.join(directory, 'fixtures/company-kit-20261125.json'), 'utf8'));
    legacy.companies[0].knowledge.find((row: { key: string }) => row.key === 'prompt-moe-coder').summary =
      'OWNER_CONTRACT_RETAINED: an independent reviewer accepts every code patch.';
    await applyCompanyKits(legacy, { snapshot, command: (action: string, payload: Record<string, unknown>) =>
      command(action, action === 'create_company' ? { ...payload, repoUrl: REPOSITORY_URL } : payload) });
    const updated = await applyCompany({ snapshot, command });
    const captures: Array<{ employeeId: string; system: string; prompt: string; model: string; maxOutputTokens: number }> = [];
    worker = new OfficeWorker({ seedDir: path.join(root, 'company'), artifactRoot: path.join(temporary, 'artifacts'),
      snapshot: async () => ({ ok: true, snapshot }),
      command: async (request: OfficeCommand) => {
        const { action, ...payload } = request;
        return { ok: true, snapshot: await command(action, payload) };
      },
      generate: async (request, job) => {
        captures.push({ employeeId: job!.employeeId, system: request.system ?? '', prompt: request.prompt,
          model: request.model, maxOutputTokens: request.maxOutputTokens! });
        return { text: 'Synthetic context acceptance only; no model or tool execution.', inputTokens: 10, outputTokens: 10 };
      } });
    for (const role of updated.receipt.roleBindings) {
      const employee = snapshot.employees.find(row => row.id === role.employeeId)!;
      await command('enqueue_job', { companyId: employee.companyId, officeId: employee.officeId,
        departmentId: employee.departmentId, employeeId: employee.id,
        goal: 'Review current Monsoon, audio and vertical-play acceptance for this role.', mode: 'provider',
        provider: 'ollama', model: QWEN_CODER_MOE_MODEL, authorized: true, allowedTools: [],
        maxTokens: 8192, maxUsd: 0, maxMinutes: 1,
        priceRates: { inputUsdPerMillion: 0, outputUsdPerMillion: 0 }, idempotencyKey: `context-${role.roleKey}` });
      await worker.runOnce();
      expect(worker.status().lastError).toBeNull();
    }
    expect(captures).toHaveLength(12);
    for (const capture of captures) {
      const admission = prepareOllamaContext(capture);
      expect(capture.model).toBe(QWEN_CODER_MOE_MODEL);
      expect(capture.maxOutputTokens).toBeGreaterThan(0);
      expect(capture.maxOutputTokens).toBeLessThanOrEqual(1024);
      expect(admission.inputBound + capture.maxOutputTokens).toBeLessThanOrEqual(8192);
      const marker = '\n\nCompany knowledge (data):\n';
      const start = capture.prompt.indexOf(marker) + marker.length;
      const end = capture.prompt.indexOf('\n\nExplicit shared knowledge', start);
      const knowledge = JSON.parse(capture.prompt.slice(start, end));
      expect(knowledge).toHaveLength(6);
      expect(knowledge.filter((row: { selection?: string }) => row.selection === 'employee-task-contract-data')).toHaveLength(1);
      expect(knowledge.slice(-5).map((row: { title: string }) => row.title)).toEqual(sharedTitles);
      expect(knowledge.slice(-5).every((row: { artifactUri: string }) => row.artifactUri.includes('a35493d67cf5111d7da2ff9eea6c58ed3499aeca'))).toBe(true);
      expect(capture.prompt).toContain('Monsoon');
      expect(capture.prompt).toContain('reconnect');
      expect(capture.prompt).toContain('vertical');
    }
    const coder = updated.receipt.roleBindings.find((row: { roleKey: string }) => row.roleKey === 'moe-coder');
    expect(captures.find(row => row.employeeId === coder.employeeId)!.prompt).toContain('OWNER_CONTRACT_RETAINED');
    expect(snapshot.jobs.filter(row => row.idempotencyKey?.startsWith('context-')).every(row => row.status === 'completed')).toBe(true);
    if (process.env.DAFTAR_ACCEPTANCE_METRICS === '1') console.info(JSON.stringify(captures.map(capture => ({
      roleKey: updated.receipt.roleBindings.find((row: { employeeId: string }) => row.employeeId === capture.employeeId).roleKey,
      systemBytes: Buffer.byteLength(capture.system), promptBytes: Buffer.byteLength(capture.prompt),
      inputTokenBound: prepareOllamaContext(capture).inputBound, outputTokenBound: capture.maxOutputTokens,
    }))));
  } finally {
    worker?.stop();
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}, 60000);

import path from 'node:path';
import type { OfficeCommand, OfficeJob, OfficeResult, OfficeSnapshot } from '../shared/office';
import { CompanyError, executeNativeCore, type NativeRequest } from './company';
import { discoverPublicRepositories, discoverOwnedRepositories } from './githubImport';
import { GitHubService, type GitHubOperation } from './githubService';
import { repositoryReviewSchedules } from './repositoryMaintenance';

export interface OfficeServiceOptions {
  userDataPath: string;
  seedDir: string;
  binaryPath: string | null;
  fetch?: typeof fetch;
  githubToken?: () => string | null;
  execute?: (binary: string, request: NativeRequest) => Promise<OfficeSnapshot>;
}

const WORKER_ACTIONS = new Set(['claim_job', 'reserve_job', 'finish_job', 'complete_job', 'heartbeat_job', 'get_cache', 'put_cache', 'reserve_external', 'settle_external', 'post_assistant_message', 'tick_goals', 'record_github_activity']);

/** Check immediately before a managed side effect, after potentially long model work. */
export function assertWorkerCapability(snapshot: OfficeSnapshot, job: OfficeJob, capability: string): void {
  const current = snapshot.jobs.find(j => j.id === job.id);
  if (!current || current.status !== 'running' || current.leaseToken !== job.leaseToken || !current.allowedTools.includes(capability)) throw new Error('Managed action is no longer assigned to this worker lease. Artifact preserved.');
  const activeCompany = (id: string) => snapshot.companies.some(c => c.id === id && c.status === 'active');
  const activeOffice = (id: string) => snapshot.offices.some(o => o.id === id && o.status === 'active');
  const activeDepartment = (id: string) => snapshot.departments.some(d => d.id === id && d.status === 'active');
  const pausedGroup = (companyId: string) => snapshot.portfolio?.groups.some(g => g.status === 'paused' && g.companyIds.includes(companyId)) === true;
  const employee = snapshot.employees.find(e => e.id === current.employeeId);
  if (snapshot.policy?.dispatchPaused || (!current.authorized && snapshot.policy?.approvalMode !== 'autonomous') || !activeCompany(current.companyId) || !activeOffice(current.officeId) || (current.departmentId && !activeDepartment(current.departmentId)) || !employee || employee.status !== 'active' || (employee.companyId && !activeCompany(employee.companyId)) || (employee.officeId && !activeOffice(employee.officeId)) || (employee.departmentId && !activeDepartment(employee.departmentId))) throw new Error('Managed action was paused by its owner or hierarchy. Artifact preserved.');
  if (pausedGroup(current.companyId) || (employee.companyId && pausedGroup(employee.companyId))) throw new Error('The company or worker home group was paused before the managed action. Artifact preserved.');
  for (const transferId of current.knowledgeTransferIds ?? []) {
    const transfer = snapshot.portfolio?.transfers.find(t => t.id === transferId && t.status === 'granted' && t.recipientCompanyId === current.companyId);
    if (!transfer || !snapshot.knowledge.some(k => k.id === transfer.knowledgeId && k.companyId === transfer.sourceCompanyId)) throw new Error('A selected knowledge grant was revoked before the managed action. Artifact preserved.');
  }
  if (current.serviceContractId) {
    const contract = snapshot.portfolio?.contracts.find(c => c.id === current.serviceContractId && c.status === 'active');
    const service = snapshot.portfolio?.services.find(s => s.id === contract?.serviceId && s.status === 'active');
    if (!contract || !service || !activeCompany(service.companyId) || !activeOffice(service.officeId) || !activeDepartment(service.departmentId) || contract.recipientCompanyId !== current.companyId || (contract.recipientOfficeId && contract.recipientOfficeId !== current.officeId) || (contract.recipientDepartmentId && contract.recipientDepartmentId !== current.departmentId) || !contract.employeeIds.includes(current.employeeId) || !service.employeeIds.includes(current.employeeId) || !contract.allowedTools.includes(capability)) throw new Error('The shared-service capability was revoked or paused. Artifact preserved.');
    if (pausedGroup(service.companyId)) throw new Error('The shared-service group was paused before the managed action. Artifact preserved.');
  } else if ((employee.companyId && employee.companyId !== current.companyId) || (employee.officeId && employee.officeId !== current.officeId) || (employee.departmentId && employee.departmentId !== current.departmentId)) throw new Error('Shared workers require an active contract before using tools.');
}

/** One native state file is shared by the desktop and headless MCP worker. */
export class OfficeService {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private readonly options: OfficeServiceOptions) {}
  private async native(command: 'office_snapshot' | 'office_command', payload?: unknown): Promise<OfficeResult> {
    try {
      if (!this.options.binaryPath) throw new CompanyError('Rust core is not built. Run npm run build:native or use the complete desktop package.', 'CORE_UNAVAILABLE');
      const request: NativeRequest = { command, stateDir: path.join(this.options.userDataPath, 'company'), seedDir: this.options.seedDir, ...(payload ? { payload } : {}) };
      const snapshot = this.options.execute
        ? await this.options.execute(this.options.binaryPath, request)
        : await executeNativeCore<OfficeSnapshot>(this.options.binaryPath, request);
      return { ok: true, snapshot };
    } catch (error) {
      return { ok: false, snapshot: null, error: error instanceof CompanyError ? error.message : 'Office operation failed; existing state was preserved.', code: error instanceof CompanyError ? error.code : 'OFFICE_ERROR' };
    }
  }
  private serial(action: () => Promise<OfficeResult>): Promise<OfficeResult> {
    const next = this.queue.then(action, action);
    this.queue = next.catch(() => undefined);
    return next;
  }
  officeSnapshot(): Promise<OfficeResult> { return this.serial(() => this.native('office_snapshot')); }
  async assertWorkerCapability(job: OfficeJob, capability: string): Promise<void> {
    const result = await this.officeSnapshot();
    if (!result.ok || !result.snapshot) throw new Error(result.error || 'Office unavailable; managed action was not attempted.');
    assertWorkerCapability(result.snapshot, job, capability);
  }
  /** Internal worker API. The local renderer cannot claim or forge settlements. */
  workerCommand(request: OfficeCommand): Promise<OfficeResult> {
    return this.serial(() => this.native('office_command', request));
  }
  async officeCommand(request: OfficeCommand): Promise<OfficeResult> {
    if (!request || typeof request.action !== 'string' || WORKER_ACTIONS.has(request.action)) {
      return { ok: false, snapshot: null, error: 'This action belongs to the managed worker, not the workspace controls.', code: 'WORKER_ONLY' };
    }
    if (request.action === 'import_repositories') {
      return { ok: false, snapshot: null, error: 'Use Import GitHub account so repository metadata is checked before registration.', code: 'VERIFIED_IMPORT_REQUIRED' };
    }
    if (request.action === 'import_github_account') {
      // Discover before entering the mutation queue, so a slow network does not
      // block worker cancellation checks or local queue controls.
      try {
        const token = request.includePrivate === true ? this.options.githubToken?.() : null;
        if (request.includePrivate === true && !token) throw new Error('Save a GitHub credential in Settings to include your private repositories.');
        const repositories = token ? await discoverOwnedRepositories(request.owner, token, this.options.fetch) : await discoverPublicRepositories(request.owner, this.options.fetch);
        let result = await this.officeSnapshot();
        for (let start = 0; start < repositories.length; start += 200) {
          result = await this.workerCommand({ action: 'import_repositories', repositories: repositories.slice(start, start + 200) });
          if (!result.ok) return result;
        }
        return result;
      } catch (error) {
        return { ok: false, snapshot: null, error: error instanceof Error ? error.message.slice(0, 500) : 'GitHub account import failed.', code: 'GITHUB_IMPORT_FAILED' };
      }
    }
    if (request.action === 'github_operation') return this.githubOperation(request);
    if (request.action === 'schedule_repository_reviews') return this.serial(async () => {
      const current = await this.native('office_snapshot');
      if (!current.ok || !current.snapshot) return current;
      const created: string[] = [];
      let latest = current;
      try {
        // Validate the whole request first; preserve receipts on a later I/O failure.
        const commands = repositoryReviewSchedules(current.snapshot, request);
        for (const command of commands) {
          latest = await this.native('office_command', command);
          if (!latest.ok || !latest.snapshot) return { ...latest, error: `${latest.error ?? 'Schedule storage failed.'} ${created.length} reviews were saved; retry skips existing reviews.` };
          if (typeof latest.snapshot.lastAction?.scheduleId === 'string') created.push(latest.snapshot.lastAction.scheduleId);
        }
        return { ...latest, snapshot: { ...latest.snapshot!, lastAction: { reviewScheduleIds: created, created: created.length, enabled: request.enabled === true } } };
      } catch (error) {
        return { ok: false, snapshot: null, error: error instanceof Error ? error.message : 'Repository review setup failed.', code: 'REVIEW_SETUP_FAILED' };
      }
    });
    return this.workerCommand(request);
  }

  /** Revalidated, fixed-host read context. No model receives the GitHub credential. */
  async prepareWorkerContext(job: import('../shared/office').OfficeJob): Promise<string> {
    if (!job.allowedTools.includes('github.read_repository')) return '';
    await this.assertWorkerCapability(job, 'github.read_repository');
    const current = await this.officeSnapshot();
    if (!current.ok || !current.snapshot) throw new Error(current.error || 'Office unavailable.');
    const attempt = current.snapshot.jobs.find(j => j.id === job.id);
    const company = current.snapshot.companies.find(c => c.id === job.companyId);
    if (!company?.repoUrl || company.status !== 'active' || attempt?.status !== 'running' || attempt.leaseToken !== job.leaseToken) throw new Error('Repository review was paused before the source read.');
    const result = await new GitHubService(this.options.githubToken ?? (() => null), this.options.fetch).run(company.repoUrl, { operation: 'snapshot' });
    const readme = result.readme as { content?: string } | null;
    const branches = Array.isArray(result.branches) ? result.branches : [];
    return JSON.stringify({ ...result, branches: branches.slice(0, 40), branchesTruncated: branches.length > 40, readme: readme ? { ...readme, content: readme.content?.slice(0, 8000), truncated: (readme.content?.length ?? 0) > 8000 || (readme as { truncated?: boolean }).truncated } : null });
  }

  async githubOperation(request: OfficeCommand): Promise<OfficeResult> {
    try {
      const current = await this.officeSnapshot();
      if (!current.ok || !current.snapshot) return current;
      const snapshot = current.snapshot;
      const company = snapshot.companies.find(c => c.id === request.companyId);
      if (!company?.repoUrl) throw new Error('Select a company with a registered GitHub repository.');
      const operation = request.operation as GitHubOperation['operation'];
      if (operation === 'publish_changes') {
        const steward = snapshot.employees.find(e => e.companyId === company.id && e.assignmentKey === 'github-steward');
        if (company.status !== 'active' || !steward || steward.status !== 'active' || (steward.officeId && snapshot.offices.find(o=>o.id===steward.officeId)?.status !== 'active') || (steward.departmentId && snapshot.departments.find(d=>d.id===steward.departmentId)?.status !== 'active')) throw new Error('Activate this company and its GitHub steward before publishing.');
        if (snapshot.policy?.approvalMode !== 'autonomous' && request.reviewed !== true) throw new Error('Review the changeset before publishing, or select Autonomous mode in your workspace policy.');
      }
      const result = await new GitHubService(this.options.githubToken ?? (() => null), this.options.fetch).run(company.repoUrl, { ...request, operation });
      const evidenceUrl = typeof result.url === 'string' ? result.url : company.repoUrl;
      const logged = await this.workerCommand({ action: 'record_github_activity', companyId: company.id, summary: `GitHub ${operation} completed${result.commit ? ` at ${result.commit}` : ''}`, evidenceUrl });
      if (!logged.ok || !logged.snapshot) return { ...current, snapshot: { ...snapshot, lastAction: { github: result, ledgerWarning: 'Operation completed but local activity could not be written.' } } };
      logged.snapshot.lastAction = { ...logged.snapshot.lastAction, github: result };
      return logged;
    } catch (error) {
      return { ok: false, snapshot: null, error: error instanceof Error ? error.message.slice(0,500) : 'GitHub operation failed.', code: 'GITHUB_OPERATION_FAILED' };
    }
  }
}

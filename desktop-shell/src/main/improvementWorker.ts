import type { OfficeCommand, OfficeJob, OfficeResult, OfficeSnapshot, OfficeGoalRunSettings, OfficeImprovementCoordinatorStatus } from '../shared/office';
import crypto from 'node:crypto';
import { OfficeWorker, type OfficeWorkerOptions, type OfficeWorkerActivity } from './officeWorker';
import { assertImprovementPriceQuote, readImprovementPriceCatalog, selectImprovementRoute, type ImprovementRoute, type ImprovementPriceQuote } from './improvementPricing';

export interface ImprovementSessionRecord {
  id: string; revision: number; status: string; companyId: string; officeId: string; departmentId: string | null;
  primaryEmployeeId: string; reviewerEmployeeId: string; serviceContractId: string | null; reviewerServiceContractId: string | null;
  allowedRoutes: ImprovementRoute[]; runSettings: OfficeGoalRunSettings;
  activeGoalId: string | null; cycle: number;
}
type ImprovementState = Omit<OfficeSnapshot,'improvementSessions'> & { improvementSessions?: ImprovementSessionRecord[] };
export interface ImprovementWorkerOptions {
  snapshot: () => Promise<OfficeResult>;
  command: (request: OfficeCommand) => Promise<OfficeResult>;
  workerOptions: OfficeWorkerOptions;
  priceCatalogPath: string;
  eligibleRoutes: (session: ImprovementSessionRecord, signal: AbortSignal) => Promise<ImprovementRoute[]>;
  intervalMs?: number;
  /** A test seam only; runtime/IPC configuration cannot replace this factory. */
  createWorker?: (options: OfficeWorkerOptions) => Pick<OfficeWorker, 'runOnce' | 'stop' | 'status'>;
}
const RUNNABLE = new Set(['active','waiting-work','waiting-budget']);
const emptyExecution = (): OfficeWorkerActivity['execution'] => ({ sampledAt: new Date().toISOString(), activeCalls: [] });
export const fingerprintCredential = (credential:string):string => crypto.createHash('sha256').update(credential).digest('hex');
function state(result: OfficeResult): ImprovementState {
  if (!result.ok || !result.snapshot) throw new Error('Native improvement state is unavailable.');
  return result.snapshot as ImprovementState;
}

/** Native records own work, receipts and all dollars. This object owns only scheduling. */
export class ImprovementWorker {
  private closed = false;
  private started = false;
  private timer: NodeJS.Timeout | null = null;
  private pending: Promise<void> | null = null;
  private requestedWake = false;
  private current: Pick<OfficeWorker,'runOnce'|'stop'|'status'> | null = null;
  private controller: AbortController | null = null;
  private sessionId: string | null = null;
  private lastSessionId: string | null = null;
  private idlePolls = 0;
  private errorPolls = 0;
  private nextPollAt: number | null = null;
  private lastOutcome: 'idle'|'work'|'error'|null = null;
  private blockedReason: string | null = null;
  private observation: OfficeImprovementCoordinatorStatus['observation'] = null;
  private readonly intervalMs: number;
  constructor(private readonly options: ImprovementWorkerOptions) {
    this.intervalMs = Math.max(5000,Math.min(120000,Number.isFinite(options.intervalMs) ? Math.trunc(options.intervalMs!) : 15000));
  }
  status() {
    return { started: this.started && !this.closed, running: this.pending !== null, activeSessionId: this.sessionId,
      lastOutcome: this.lastOutcome, blockedReason: this.blockedReason, nextPollAt: this.nextPollAt,
      idlePolls: this.idlePolls, errorPolls: this.errorPolls, baseIntervalMs: this.intervalMs, maxIntervalMs: 120000,
      execution: this.current?.status().execution ?? emptyExecution() };
  }
  workerStatus() { return this.current?.status() ?? null; }
  coordinatorStatus(): OfficeImprovementCoordinatorStatus {
    return { sampledAt: new Date().toISOString(), enabled: this.started && !this.closed,
      checking: !this.closed && this.pending !== null, observation: this.observation ? { ...this.observation } : null };
  }
  private observe(session: ImprovementSessionRecord, outcome: NonNullable<OfficeImprovementCoordinatorStatus['observation']>['outcome'], reason: NonNullable<OfficeImprovementCoordinatorStatus['observation']>['reason'] = null): void {
    if (this.closed) return;
    this.observation = { sessionId: session.id, sessionRevision: session.revision, companyId: session.companyId,
      officeId: session.officeId, departmentId: session.departmentId, checkedAt: new Date().toISOString(), outcome, reason };
  }
  start(): void { if (this.closed || this.started) return; this.started = true; this.wake(); }
  wake(command?: OfficeCommand): void {
    if (this.closed || !this.started) return;
    if (command?.action === 'control_improvement_session' && command.sessionId === this.sessionId && ['pause','cancel'].includes(String(command.operation))) {
      this.controller?.abort(); this.current?.stop();
    }
    this.clearTimer();
    if (this.pending) { this.requestedWake = true; return; }
    this.pending = this.poll().finally(() => {
      this.pending = null;
      if (this.closed) return;
      const changed = this.requestedWake; this.requestedWake = false;
      const streak = Math.max(this.idlePolls,this.errorPolls);
      const delay = changed ? 0 : Math.min(120000,this.intervalMs * 2 ** Math.min(8,Math.max(0,streak-1)));
      this.nextPollAt = Date.now()+delay;
      this.timer=setTimeout(()=>{this.clearTimer();this.wake();},delay);this.timer.unref();
    });
  }
  close(): void {
    this.closed = true; this.started = false; this.requestedWake = false;
    this.observation = null;
    this.clearTimer(); this.controller?.abort(); this.current?.stop();
  }
  private clearTimer(): void { if(this.timer)clearTimeout(this.timer);this.timer=null;this.nextPollAt=null; }
  private async poll(): Promise<void> {
    let outcome:'idle'|'work'|'error'='idle'; const controller=new AbortController();this.controller=controller;
    this.blockedReason=null; this.observation=null;
    let observedSession: ImprovementSessionRecord | null = null;
    try {
      const snapshot=state(await this.options.snapshot());controller.signal.throwIfAborted();
      const sessions=(snapshot.improvementSessions ?? []).filter(session=>RUNNABLE.has(session.status)).slice(0,256);
      if (!sessions.length || snapshot.policy?.dispatchPaused) { this.blockedReason=snapshot.policy?.dispatchPaused?'global-dispatch-paused':null; return; }
      const previous=sessions.findIndex(session=>session.id===this.lastSessionId);
      const session=sessions[(previous+1)%sessions.length]!;this.sessionId=session.id;this.lastSessionId=session.id;
      observedSession=session; this.observe(session,'checking');
      const catalog=readImprovementPriceCatalog(this.options.priceCatalogPath);
      const eligible=await this.options.eligibleRoutes(session,controller.signal);controller.signal.throwIfAborted();
      const selectedRoute=selectImprovementRoute(catalog,session.allowedRoutes,eligible,session.runSettings.maxTokens);
      if (!selectedRoute) {this.blockedReason='no-current-eligible-priced-route';this.observe(session,'blocked','no-current-eligible-priced-route');return;}
      const beforeJobs=new Set(snapshot.jobs.map(job=>job.id));
      const ticked=state(await this.options.command({action:'tick_improvements',sessionId:session.id,selectedRoute} as OfficeCommand));
      controller.signal.throwIfAborted();
      const updated=ticked.improvementSessions?.find(item=>item.id===session.id);
      if (!updated || !RUNNABLE.has(updated.status)) {this.blockedReason=updated?.status ?? 'session-unavailable';this.observation=null;return;}
      observedSession=updated; this.observe(updated,'checking');
      const eligibleForDispatch=async(job:OfficeJob)=>{
        const quote=(job as OfficeJob & {improvementRoute?:ImprovementPriceQuote|null}).improvementRoute;
        assertImprovementPriceQuote(quote,job as OfficeJob & {priceRates:ImprovementPriceQuote['priceRates']},job.limits.maxTokens);
        const currentState=state(await this.options.snapshot());
        const currentSession=currentState.improvementSessions?.find(item=>item.id===session.id);
        if (!currentSession || !RUNNABLE.has(currentSession.status)) throw new Error('Improvement session is no longer active. No provider request was sent.');
        const routes=await this.options.eligibleRoutes(currentSession,controller.signal);
        if (!routes.some(route=>route.provider===job.provider&&route.model===job.model)) throw new Error('The frozen improvement route is no longer connected or permitted. No provider request was sent.');
        await this.options.workerOptions.validateJob?.(job);
        assertImprovementPriceQuote(quote,job as OfficeJob & {priceRates:ImprovementPriceQuote['priceRates']},job.limits.maxTokens);
      };
      const create=this.options.createWorker ?? (options=>new OfficeWorker(options));
      this.current=create({...this.options.workerOptions,improvementSessionId:session.id,validateJob:eligibleForDispatch});
      const stop=()=>this.current?.stop();controller.signal.addEventListener('abort',stop,{once:true});
      try { await this.current.runOnce(); } finally { controller.signal.removeEventListener('abort',stop); }
      const result=this.current.status();
      outcome=result.lastError?'error':result.scheduling?.some(slot=>slot.lastOutcome==='work')||ticked.jobs.some(job=>!beforeJobs.has(job.id))?'work':'idle';
      if (result.lastError) this.blockedReason='attempt-needs-review';
      this.observe(updated,outcome==='error'?'blocked':outcome==='work'?'progress':'idle',result.lastError?'attempt-needs-review':null);
    } catch {
      outcome=controller.signal.aborted?'idle':'error';
      this.blockedReason=controller.signal.aborted?'paused-or-closed':'improvement-state-needs-review';
      if (controller.signal.aborted) this.observation=null;
      else if (observedSession) this.observe(observedSession,'blocked','improvement-state-needs-review');
    } finally {
      this.current?.stop();this.current=null;this.controller=null;this.sessionId=null;
      this.lastOutcome=outcome;this.idlePolls=outcome==='idle'?Math.min(32,this.idlePolls+1):0;
      this.errorPolls=outcome==='error'?Math.min(32,this.errorPolls+1):0;
    }
  }
}

/** Preserve the ordinary-pool switch while reporting real execution from either pool. */
export function combineWorkerExecution<T extends {execution?:OfficeWorkerActivity['execution'];running?:boolean;activeJobId?:string|null;activeJobIds?:string[]}>(ordinary:T, improvement:ReturnType<ImprovementWorker['workerStatus']>, coordinator?:OfficeImprovementCoordinatorStatus):T & {execution:OfficeWorkerActivity['execution'];improvement?:OfficeImprovementCoordinatorStatus} {
  const activeCalls=[...(ordinary.execution?.activeCalls??[]),...(improvement?.execution.activeCalls??[])].slice(0,8);
  const activeJobIds=[...(ordinary.activeJobIds??(ordinary.activeJobId?[ordinary.activeJobId]:[])),...(improvement?.activeJobId?[improvement.activeJobId]:[])];
  return {...ordinary,running:ordinary.running===true||improvement?.running===true,activeJobId:activeJobIds[0]??null,activeJobIds,
    ...(coordinator ? {improvement:coordinator} : {}),
    execution:{sampledAt:new Date().toISOString(),activeCalls}};
}

/** Bounded read-only discovery cache; model failures never trigger generation. */
export function createImprovementRouteDiscovery(options:{
  credentialFingerprint:(provider:'anthropic'|'openai')=>string|null;
  discover:(provider:'anthropic'|'openai',signal:AbortSignal)=>Promise<Array<{id:string}>>;
  localEligible:(session:ImprovementSessionRecord,route:ImprovementRoute)=>Promise<boolean>;
}) {
  const lifetime=new AbortController();
  const cache=new Map<string,{fingerprint:string;until:number;models:Set<string>}>();
  const pending=new Map<string,Promise<Set<string>>>();
  async function models(provider:'anthropic'|'openai',signal:AbortSignal):Promise<Set<string>> {
    const fingerprint=options.credentialFingerprint(provider);if(!fingerprint)return new Set();
    const previous=cache.get(provider);
    if(previous?.fingerprint===fingerprint&&previous.until>Date.now())return previous.models;
    const identity=`${provider}:${fingerprint}`;
    const existing=pending.get(identity);if(existing)return existing;
    const abort=new AbortController();const timer=setTimeout(()=>abort.abort(),10000);timer.unref();
    const operation=Promise.resolve().then(async()=>{
      try {
        const rows=await options.discover(provider,AbortSignal.any([signal,lifetime.signal,abort.signal]));
        if(options.credentialFingerprint(provider)!==fingerprint||lifetime.signal.aborted||signal.aborted) return new Set<string>();
        const result=new Set(rows.slice(0,2000).filter(row=>typeof row.id==='string'&&row.id.length<=200).map(row=>row.id));
        cache.set(provider,{fingerprint,until:Date.now()+5*60_000,models:result});return result;
      } catch {
        if(!lifetime.signal.aborted)cache.set(provider,{fingerprint,until:Date.now()+30000,models:new Set()});
        return new Set<string>();
      } finally {clearTimeout(timer);pending.delete(identity);}
    });
    pending.set(identity,operation);return operation;
  }
  return {
    async eligibleRoutes(session:ImprovementSessionRecord,signal:AbortSignal):Promise<ImprovementRoute[]> {
      if(lifetime.signal.aborted)return [];
      const eligible:ImprovementRoute[]=[];
      for(const route of session.allowedRoutes.slice(0,16)) {
        signal.throwIfAborted();
        if(route.provider==='ollama') {if(await options.localEligible(session,route))eligible.push(route);}
        else if(['anthropic','openai'].includes(route.provider)&&(await models(route.provider,signal)).has(route.model))eligible.push(route);
      }
      return eligible;
    },
    close(){lifetime.abort();cache.clear();},
  };
}

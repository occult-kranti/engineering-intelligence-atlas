import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { SafeStorageLike } from './vault';
import type { OfficeCommand, OfficeResult, OfficeSnapshot } from '../shared/office';
import type { CloudConnectionResult, CloudConnectionStatus, ConfigureCloudRequest } from '../shared/cloud';

const MAX_BYTES = 8 * 1024 * 1024;
const LOCAL_ARTIFACT_EVIDENCE = '[local artifact omitted from cloud]';

/** Backup may change both the directory and artifact filename. Do not hash either. */
function cloudEvidence(value: unknown): unknown {
  if (typeof value === 'string') {
    const reference = value.replace(/^[\t\n\r\f\v ]+/, '');
    if (/^(?:\/|[A-Za-z]:[\\/]|\\\\|file:)/i.test(reference)) return LOCAL_ARTIFACT_EVIDENCE;
  }
  if (Array.isArray(value)) return value.map(cloudEvidence);
  return value;
}
interface Pairing { deviceToken: string; siteAccessToken?: string; clientId?: string; baseUrl?: string }
interface StoredConnection { url: string; pairing: Pairing }
interface SyncMeta { clientId: string; url: string | null; revision: number | null; lastSyncedAt: string | null; snapshotSha256?: string | null; chatCursor?: string }
export interface CloudSyncOptions {
  userDataPath: string; safeStorage: SafeStorageLike; fetch?: typeof fetch;
  snapshot: () => Promise<OfficeResult>;
  command: (request: OfficeCommand) => Promise<OfficeResult>;
}

export function normalizeCloudUrl(raw: unknown): string {
  if (typeof raw !== 'string' || raw.length > 2048) throw new Error('Enter the workspace website URL.');
  const url = new URL(raw.trim());
  const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) || url.username || url.password || url.search || url.hash || !['', '/'].includes(url.pathname)) {
    throw new Error('Use an HTTPS workspace origin without credentials, paths, queries or fragments.');
  }
  return url.origin;
}
export function parsePairing(token: unknown): Pairing {
  if (typeof token !== 'string' || token.length > 16000) throw new Error('Invalid device pairing credential.');
  let value: Pairing;
  try { value = token.trim().startsWith('{') ? JSON.parse(token) : { deviceToken: token.trim() }; }
  catch { throw new Error('The device pairing JSON is invalid.'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid device pairing credential.');
  const valid = (s: unknown, max: number) => typeof s === 'string' && s.length >= 20 && s.length <= max && !/[\s\0]/.test(s);
  if (!valid(value.deviceToken, 2048) || (value.siteAccessToken !== undefined && !valid(value.siteAccessToken, 12000))) throw new Error('Invalid device pairing credential.');
  if (value.clientId !== undefined && (typeof value.clientId !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(value.clientId))) throw new Error('Invalid pairing client identity.');
  return { deviceToken: value.deviceToken, ...(value.siteAccessToken ? { siteAccessToken: value.siteAccessToken } : {}), ...(value.clientId ? {clientId: value.clientId} : {}), ...(value.baseUrl ? {baseUrl: normalizeCloudUrl(value.baseUrl)} : {}) };
}

/** Explicit sync exports the shared office and full chat, without live secrets or local artifact paths. */
export function cloudSnapshot(snapshot: OfficeSnapshot): OfficeSnapshot {
  const fields = ['schemaVersion','activeCompanyId','companies','offices','departments','employees','jobs','schedules','cache','knowledge','events','lastAction','policy','budget','chatThreads','goals','checkpoints','blueprints','portfolio','decisionPanels','authority'];
  const selected: Record<string, unknown> = {};
  for (const field of fields) if (field in snapshot) selected[field] = (snapshot as unknown as Record<string, unknown>)[field];
  const serialized = JSON.stringify(selected, (key, value) => {
    if (['leaseToken', 'workerId', 'artifactUri', 'pendingReservation'].includes(key)) return null;
    if (['lastAction', 'remoteReceipts'].includes(key)) return key === 'remoteReceipts' ? [] : null;
    // Only structured evidence references: chat/summary text and HTTPS sources stay exact.
    if (key === 'evidence') return cloudEvidence(value);
    return value;
  });
  if (Buffer.byteLength(serialized) > MAX_BYTES) throw new Error('Workspace and full conversations exceed the 8 MiB cloud snapshot limit. Export/archive completed work before syncing; no messages were truncated or uploaded.');
  if (/(?:sk-ant-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-proj-[A-Za-z0-9_-]{20,})/.test(serialized)) {
    throw new Error('A possible API credential appears in workspace text. Remove it before cloud transfer.');
  }
  return JSON.parse(serialized) as OfficeSnapshot;
}

/** Stable across Rust serde/JS JSON numeric formatting; numbers use IEEE-754 bytes. */
export function syncStateHash(snapshot: OfficeSnapshot): string {
  const canonical = (value: unknown): string => {
    if (value === null) return 'n';
    if (typeof value === 'boolean') return value ? 't' : 'f';
    if (typeof value === 'number') { const bytes=Buffer.alloc(8);bytes.writeDoubleBE(value===0?0:value);return `d${bytes.toString('hex')}`; }
    if (typeof value === 'string') return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
    if (value && typeof value === 'object') return `{${Object.keys(value).sort((a,b)=>Buffer.compare(Buffer.from(a),Buffer.from(b))).map(key=>`${JSON.stringify(key)}:${canonical((value as Record<string,unknown>)[key])}`).join(',')}}`;
    throw new Error('Workspace contains an unsupported sync value.');
  };
  return crypto.createHash('sha256').update(canonical(cloudSnapshot(snapshot))).digest('hex');
}

/** Full cloud records use the hosted API's text ceiling; imports never truncate. */
export function cloudMessageContent(content: string): string {
  if (content.length > 60000 || Buffer.byteLength(content) > 240000) {
    throw new Error('A cloud conversation message exceeds this version’s import limit. Its full text remains on the website and the cursor was not advanced.');
  }
  return content;
}

/** Opt-in, explicit sync. The Rust office remains the execution authority. */
export class CloudSyncService {
  private readonly dir: string;
  private meta: SyncMeta;
  private connected = false;
  private error: string | null = null;
  private pendingCommands = 0;
  private chatImported = 0;
  private chatSkipped = 0;
  private chatHasMore = false;
  private inFlight: Promise<CloudConnectionResult> | null = null;
  private readonly fetcher: typeof fetch;
  constructor(private readonly options: CloudSyncOptions) {
    this.dir = path.join(options.userDataPath, 'cloud');
    this.fetcher = options.fetch ?? fetch;
    this.meta = { clientId: crypto.randomUUID(), url: null, revision: null, lastSyncedAt: null };
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(this.dir, 'connection.json'), 'utf8')) as SyncMeta;
      if (/^[A-Za-z0-9_-]{1,100}$/.test(raw.clientId) && (raw.url === null || normalizeCloudUrl(raw.url) === raw.url)) {
        this.meta = { clientId: raw.clientId, url: raw.url, revision: Number.isSafeInteger(raw.revision) && raw.revision! >= 0 ? raw.revision : null, lastSyncedAt: typeof raw.lastSyncedAt === 'string' ? raw.lastSyncedAt : null, snapshotSha256: typeof raw.snapshotSha256==='string'&&/^[a-f0-9]{64}$/.test(raw.snapshotSha256)?raw.snapshotSha256:null, chatCursor: typeof raw.chatCursor==='string'&&raw.chatCursor.length<=1000?raw.chatCursor:'' };
      }
    } catch { /* Start disconnected when metadata is absent or invalid. */ }
  }
  private encrypted(): boolean {
    try { return this.options.safeStorage.isEncryptionAvailable() && this.options.safeStorage.getSelectedStorageBackend?.() !== 'basic_text'; }
    catch { return false; }
  }
  private atomic(file: string, bytes: string | Buffer): void {
    fs.mkdirSync(this.dir, { recursive: true, mode: 0o700 });
    const tmp = path.join(this.dir, `${file}.${crypto.randomUUID()}.tmp`);
    try { fs.writeFileSync(tmp, bytes, { mode: 0o600 }); fs.renameSync(tmp, path.join(this.dir, file)); }
    finally { fs.rmSync(tmp, { force: true }); }
  }
  private persist(): void { this.atomic('connection.json', JSON.stringify(this.meta)); }
  private credential(): StoredConnection {
    if (!this.encrypted()) throw new Error('Unlock your OS keychain to connect this device.');
    try {
      const parsed = JSON.parse(this.options.safeStorage.decryptString(fs.readFileSync(path.join(this.dir, 'device.bin')))) as StoredConnection;
      const url = normalizeCloudUrl(parsed.url);
      if (url !== this.meta.url) throw new Error('Origin mismatch');
      return { url, pairing: parsePairing(JSON.stringify(parsed.pairing)) };
    } catch { throw new Error('Pair this device again from the signed-in website.'); }
  }
  status(): CloudConnectionStatus {
    return { configured: !!this.meta.url && fs.existsSync(path.join(this.dir, 'device.bin')), connected: this.connected, url: this.meta.url, revision: this.meta.revision, lastSyncedAt: this.meta.lastSyncedAt, pendingCommands: this.pendingCommands, error: this.error, capability: 'snapshot-and-commands', encryptionAvailable: this.encrypted(), chatImported: this.chatImported, chatSkipped: this.chatSkipped, chatHasMore: this.chatHasMore };
  }
  private result(ok: boolean, error?: string): CloudConnectionResult {
    this.error = error ?? null;
    return { ok, status: this.status(), ...(error ? { error } : {}) };
  }
  private async request(connection: StoredConnection, route: string, method = 'GET', data?: unknown): Promise<any> {
    const headers: Record<string, string> = { Authorization: `Bearer ${connection.pairing.deviceToken}`, Accept: 'application/json' };
    if (connection.pairing.siteAccessToken) headers['OAI-Sites-Authorization'] = `Bearer ${connection.pairing.siteAccessToken}`;
    if (data !== undefined) headers['Content-Type'] = 'application/json';
    const body = data === undefined ? undefined : JSON.stringify(data);
    if (body && Buffer.byteLength(body) > MAX_BYTES + 65536) throw new Error('Cloud request exceeds its size limit.');
    let response: Response;
    try { response = await this.fetcher(`${connection.url}${route}`, { method, headers, ...(body ? { body } : {}), redirect: 'error', signal: AbortSignal.timeout(30000) }); }
    catch { throw new Error('The cloud workspace is offline or unreachable. Local work is preserved.'); }
    if (response.status === 409) throw new Error('Cloud revision conflict. Local and cloud work were preserved; refresh the website and resolve the owning desktop before syncing again.');
    if (response.status === 401 || response.status === 403) throw new Error('Cloud sign-in or device access expired. Create a new pairing credential on the website.');
    if (!response.ok) throw new Error(`Cloud request failed (${response.status}). Local work is preserved.`);
    if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('The workspace returned a sign-in page instead of its API. Use the full device pairing credential.');
    const reader = response.body?.getReader();
    if (!reader) throw new Error('The cloud response is empty.');
    let bytes = 0; const chunks: Uint8Array[] = [];
    while (true) {
      const next = await reader.read(); if (next.done) break;
      bytes += next.value.length;
      if (bytes > MAX_BYTES + 65536) { await reader.cancel(); throw new Error('Cloud response exceeds its size limit.'); }
      chunks.push(next.value);
    }
    try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
    catch { throw new Error('The cloud response is invalid.'); }
  }
  async configure(request: ConfigureCloudRequest): Promise<CloudConnectionResult> {
    if (this.inFlight) return this.result(false, 'A sync is in progress. Wait before changing its connection.');
    try {
      if (!this.encrypted()) throw new Error('OS secure storage is unavailable. Unlock your keychain before pairing.');
      const connection = { url: normalizeCloudUrl(request?.url), pairing: parsePairing(request?.token) };
      if (connection.pairing.baseUrl && connection.pairing.baseUrl !== connection.url) throw new Error('Pairing credential belongs to a different website.');
      const session = await this.request(connection, '/api/session');
      if (session.signedIn !== true) throw new Error('Sign in on the website and create a device pairing credential.');
      if (typeof session.clientId !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(session.clientId)) throw new Error('The authenticated device identity is missing or invalid. Create a desktop pairing credential.');
      if (connection.pairing.clientId && connection.pairing.clientId !== session.clientId) throw new Error('The pairing identity does not match the authenticated device. Create a fresh pairing credential.');
      connection.pairing.clientId = session.clientId;
      this.atomic('device.bin', this.options.safeStorage.encryptString(JSON.stringify(connection)));
      if (this.meta.url !== connection.url) { this.meta.revision = null; this.meta.lastSyncedAt = null; this.meta.snapshotSha256 = null; this.meta.chatCursor = ''; }
      if (connection.pairing.clientId && this.meta.clientId !== connection.pairing.clientId) {
        this.meta.clientId = connection.pairing.clientId; this.meta.revision = null; this.meta.lastSyncedAt = null; this.meta.snapshotSha256 = null;
      }
      this.meta.url = connection.url; this.persist(); this.connected = true;
      return this.result(true);
    } catch (err) { this.connected = false; return this.result(false, err instanceof Error ? err.message : 'Device pairing failed.'); }
  }
  disconnect(): CloudConnectionResult {
    if (this.inFlight) return this.result(false, 'A sync is in progress. Wait before disconnecting.');
    try {
      fs.rmSync(path.join(this.dir, 'device.bin'), { force: true });
      this.meta.url = null; this.meta.revision = null; this.meta.lastSyncedAt = null; this.meta.snapshotSha256 = null; this.meta.chatCursor = ''; this.persist();
      this.connected = false; this.pendingCommands = 0;
      return this.result(true);
    } catch { return this.result(false, 'The local pairing could not be removed.'); }
  }
  sync(): Promise<CloudConnectionResult> {
    if (this.inFlight) return this.inFlight;
    this.inFlight = this.performSync().finally(() => { this.inFlight = null; });
    return this.inFlight;
  }
  private async performSync(): Promise<CloudConnectionResult> {
    try {
      this.chatImported = 0; this.chatSkipped = 0; this.chatHasMore = false;
      const connection = this.credential();
      const remote = await this.request(connection, '/api/workspace');
      remote.clientId = remote.clientId ?? remote.sourceClientId;
      if (!Number.isSafeInteger(remote.revision) || remote.revision < 0) throw new Error('Cloud workspace revision is invalid.');
      if (this.meta.revision !== null && remote.revision !== this.meta.revision && remote.clientId !== this.meta.clientId) throw new Error('Cloud revision changed on another device. Local work is preserved; resolve the owning desktop before syncing.');
      if (this.meta.revision === null && remote.revision > 0 && remote.clientId && remote.clientId !== this.meta.clientId) throw new Error('The cloud already has a workspace from another desktop. It was preserved; pair the original desktop to continue execution.');
      let local = await this.options.snapshot();
      if (!local.ok || !local.snapshot) throw new Error(local.error ?? 'Local workspace could not be read.');
      let expectedStateHash = syncStateHash(local.snapshot);
      const cloudBaseHash = remote.snapshot ? syncStateHash(remote.snapshot) : this.meta.snapshotSha256;
      if (this.meta.revision === null && remote.revision > 0 && !remote.clientId && cloudBaseHash !== expectedStateHash) throw new Error('Restore your latest private workspace bundle before the first sync. The populated cloud workspace was preserved; a default local office cannot replace it.');
      const changedLocally = cloudBaseHash !== expectedStateHash;
      // An empty website has no workspace row to claim. Its first PUT creates
      // and claims that row atomically; populated seeds must be claimed before ACKs.
      if (!remote.clientId && remote.revision > 0) {
        const claimed = await this.request(connection, '/api/workspace/claim-writer', 'POST', { expectedRevision: remote.revision, clientId: this.meta.clientId });
        if (claimed.revision !== remote.revision || (claimed.sourceClientId ?? claimed.clientId) !== this.meta.clientId) throw new Error('The website did not confirm this desktop as its writer. No queued command was executed.');
        remote.clientId = this.meta.clientId;
      }
      const queued = await this.request(connection, '/api/commands');
      if (!Array.isArray(queued.commands) || queued.commands.length > 100) throw new Error('Cloud command queue is invalid or exceeds 100 items per sync.');
      this.pendingCommands = queued.commands.length;
      for (const item of queued.commands) {
        if (!item || typeof item.id !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(item.id) || !item.command || typeof item.command.action !== 'string') throw new Error('Cloud command envelope is invalid.');
        const payload = item.command.payload ?? {};
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Cloud command payload is invalid.');
        const command = { ...payload, action: item.command.action };
        const replay = (local.snapshot as OfficeSnapshot & {remoteReceipts?:Array<{id:string}>}).remoteReceipts?.some(r=>r.id===item.id) === true;
        const stale = !replay && (changedLocally || item.baseRevision !== remote.revision);
        const applied = stale ? {ok:false,snapshot:null,error:'The command was based on an older workspace. Refresh the website and resubmit.',code:'CONFLICT'} : await this.options.command({ action: 'apply_remote_command', id: item.id, expectedStateHash, command });
        if (!applied.ok && (!applied.code || /^(?:CORE_|STATE_|IO_ERROR|OFFICE_ERROR)/.test(applied.code))) throw new Error('The native command outcome could not be confirmed. It remains queued; retry sync after fixing the local runtime. Durable receipts prevent duplicate effects.');
        await this.request(connection, `/api/commands/${encodeURIComponent(item.id)}/ack`, 'POST', { ok: applied.ok, ...(applied.ok ? {} : { error: applied.error ?? 'Native validation rejected this command.', code: applied.code }) });
        if (applied.ok && applied.snapshot) { local = applied; expectedStateHash = syncStateHash(applied.snapshot); }
        this.pendingCommands -= 1;
      }
      const conversation = await this.request(connection, `/api/cloud-threads?cursor=${encodeURIComponent(this.meta.chatCursor ?? '')}`);
      if (!Array.isArray(conversation.messages) || conversation.messages.length > 100 || typeof conversation.cursor !== 'string' || conversation.cursor.length > 1000 || (conversation.nextCursor !== null && typeof conversation.nextCursor !== 'string')) throw new Error('The cloud conversation cursor response is invalid. Saved local work was preserved.');
      for (const message of conversation.messages) {
        if (!message || typeof message.id !== 'string' || !/^[a-f0-9-]{36}$/i.test(message.id) || !message.scope || typeof message.scope.kind !== 'string' || typeof message.scope.id !== 'string' || !['user','assistant'].includes(message.role) || typeof message.content !== 'string' || !message.content.trim() || typeof message.createdAt !== 'string' || !Number.isFinite(Date.parse(message.createdAt))) throw new Error('A cloud conversation message has invalid metadata. Its cursor was not advanced.');
        if (!['company','office','department','employee'].includes(message.scope.kind)) { this.chatSkipped += 1; continue; }
        local = await this.options.snapshot();
        if (!local.ok || !local.snapshot) throw new Error(local.error ?? 'Local conversation could not be read.');
        const command = { action: 'import_cloud_message', id: `cloud-${message.id}`, scope: message.scope, role: message.role, content: cloudMessageContent(message.content), createdAt: message.createdAt };
        if (Buffer.byteLength(JSON.stringify(command)) > 524288) throw new Error('A cloud conversation envelope exceeds its import limit. Its full text remains on the website and the cursor was not advanced.');
        const imported = await this.options.command({
          action: 'apply_remote_command',
          id: `cloud-chat-${message.id}`,
          expectedStateHash: syncStateHash(local.snapshot),
          command,
        });
        if (!imported.ok || !imported.snapshot) throw new Error(imported.error ?? 'Cloud conversation import was not confirmed. Existing messages are preserved; retry is idempotent.');
        if (imported.snapshot.lastAction?.replayed !== true) this.chatImported += 1;
      }
      this.meta.chatCursor = conversation.cursor;
      this.chatHasMore = conversation.nextCursor !== null;
      local = await this.options.snapshot();
      if (!local.ok || !local.snapshot) throw new Error(local.error ?? 'Local workspace could not be read.');
      const saved = await this.request(connection, '/api/workspace', 'PUT', { expectedRevision: remote.revision, clientId: this.meta.clientId, snapshot: cloudSnapshot(local.snapshot) });
      if (!Number.isSafeInteger(saved.revision) || saved.revision <= remote.revision) throw new Error('Cloud did not acknowledge the saved revision. Retry is safe; commands have native receipts.');
      this.meta.revision = saved.revision; this.meta.lastSyncedAt = typeof saved.updatedAt === 'string' ? saved.updatedAt : new Date().toISOString();
      this.meta.snapshotSha256 = syncStateHash(local.snapshot);
      this.persist(); this.connected = true;
      return { ...this.result(true), notice: `Office synced. Imported ${this.chatImported} cloud conversation message${this.chatImported===1?'':'s'}.${this.chatSkipped ? ` ${this.chatSkipped} unsupported-scope message${this.chatSkipped===1?' remains':'s remain'} on the website.` : ''}${this.chatHasMore ? ' More messages await the next sync.' : ''}` };
    } catch (err) { this.connected = false; return this.result(false, err instanceof Error ? err.message : 'Cloud sync failed; local work is preserved.'); }
  }
}

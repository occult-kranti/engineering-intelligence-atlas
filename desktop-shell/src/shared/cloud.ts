/** Device credentials never leave the desktop main process after configuration. */
export interface CloudConnectionStatus {
  configured: boolean;
  connected: boolean;
  url: string | null;
  revision: number | null;
  lastSyncedAt: string | null;
  /** Remote commands fetched but not yet acknowledged; not unsaved local edits. */
  pendingCommands: number;
  error: string | null;
  capability: 'snapshot-and-commands';
  encryptionAvailable: boolean;
  chatImported?: number;
  chatSkipped?: number;
  chatHasMore?: boolean;
}
export interface ConfigureCloudRequest {
  url: string;
  /** A device token or pairing JSON containing deviceToken and siteAccessToken. */
  token: string;
}
export interface CloudConnectionResult { ok: boolean; status: CloudConnectionStatus; error?: string; notice?: string }

export class CollaborationError extends Error {
  constructor(message: string, readonly status: number, readonly code: string) { super(message); }
}

/** Same-origin, cookie-authenticated calls. Mutations are never automatically retried. */
export async function collaborationRequest<T>(path: string, method = 'GET', body?: unknown, signal?: AbortSignal): Promise<T> {
  if (!path.startsWith('/api/collaboration/') || path.includes('\\')) throw new Error('Invalid workspace request.');
  const timeout = AbortSignal.timeout(20000);
  let response: Response;
  try {
    response = await fetch(path, { method, credentials: 'same-origin', cache: 'no-store', redirect: 'error',
      headers: { accept: 'application/json', ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}), signal: signal ? AbortSignal.any([timeout, signal]) : timeout });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new CollaborationError(method === 'GET' ? 'The workspace could not be reached. Refresh to try again.' : 'The result could not be confirmed. Refresh the saved records before trying again.', 0, 'unconfirmed');
  }
  let data: Record<string, unknown>;
  try { data = await response.json(); } catch { throw new CollaborationError('The workspace returned an unreadable response. Refresh before continuing.', response.status, 'invalid_response'); }
  if (!response.ok || data.ok === false) throw new CollaborationError(typeof data.error === 'string' ? data.error : 'The request could not be completed.', response.status, typeof data.code === 'string' ? data.code : 'request_failed');
  return data as T;
}

export const companyEndpoint = (id: string, suffix = '') => `/api/collaboration/companies/${encodeURIComponent(id)}${suffix}`;
export const roleLabel = (role: string) => role === 'owner' ? 'Owner' : role === 'contributor' ? 'Contributor' : 'Viewer';
export function formatTime(value: string | null | undefined): string {
  if (!value) return 'No expiry';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date) : 'Date unavailable';
}
export function localDateInput(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
export function isoDateInput(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error('Choose a valid expiry date and time.');
  return date.toISOString();
}
export const nextWeek = () => localDateInput(new Date(Date.now() + 7 * 86400000).toISOString());
export const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'The request could not be completed.';
export const signInPath = (path: string) => `/signin-with-chatgpt?return_to=${encodeURIComponent(path)}`;

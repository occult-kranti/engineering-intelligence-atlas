export type ApiRecord = Record<string, any>;
export class OfficeApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}
export async function officeApi(path: string, options: RequestInit = {}): Promise<ApiRecord> {
  const response = await fetch(path, {...options, credentials: 'same-origin', cache: 'no-store', headers: {'content-type': 'application/json', ...options.headers}});
  if (!response.headers.get('content-type')?.includes('application/json')) throw new OfficeApiError('Sign in with ChatGPT to open your private workspace.', 401);
  const data = await response.json() as ApiRecord;
  if (!response.ok) throw new OfficeApiError(data.error || 'The workspace could not be loaded. Your saved work is unchanged.', response.status);
  return data;
}

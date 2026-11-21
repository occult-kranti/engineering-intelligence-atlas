import path from 'node:path';

/** Rebranding must not hide an existing owner workspace or override a test/profile flag. */
export function existingUserDataPath(current: string, appData: string, explicit: boolean, exists: (value: string) => boolean): string {
  if (explicit || exists(current)) return current;
  for (const name of ['Research Director Desktop', 'research-director-desktop-shell']) {
    const candidate = path.join(appData, name);
    if (exists(candidate)) return candidate;
  }
  return current;
}

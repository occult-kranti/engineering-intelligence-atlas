import path from 'node:path';

/** Rebranding must not hide an existing owner workspace or override a test/profile flag. */
export function existingUserDataPath(current: string, getAppData: () => string, explicit: boolean, exists: (value: string) => boolean): string {
  if (explicit || exists(current)) return current;
  // An explicit/current profile does not need the OS default root. Resolving it
  // eagerly can reject startup on an isolated Windows account even though the
  // caller already supplied a usable --user-data-dir.
  const appData = getAppData();
  for (const name of ['Research Director Desktop', 'research-director-desktop-shell']) {
    const candidate = path.join(appData, name);
    if (exists(candidate)) return candidate;
  }
  return current;
}

export function sidebarPreferenceKey(userId: string) {
  return `meus-acordos:sidebar-collapsed:${userId}`;
}

export function readSidebarPreference(storage: Pick<Storage, 'getItem'>, userId: string): boolean {
  try { return storage.getItem(sidebarPreferenceKey(userId)) === 'true'; }
  catch { return false; }
}

export function writeSidebarPreference(storage: Pick<Storage, 'setItem'>, userId: string, collapsed: boolean) {
  try { storage.setItem(sidebarPreferenceKey(userId), String(collapsed)); }
  catch { /* The toggle still works without browser storage. */ }
}
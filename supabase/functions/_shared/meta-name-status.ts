const USABLE_NAME_STATUSES = new Set(['APPROVED', 'AVAILABLE_WITHOUT_REVIEW']);

export function isMetaDisplayNameUsable(status: unknown): boolean {
  return USABLE_NAME_STATUSES.has(String(status || '').toUpperCase());
}

export function isInformationalDisplayNameLimit(detail: unknown, nameStatus: unknown): boolean {
  return isMetaDisplayNameUsable(nameStatus) && /display name|nome de exibição/i.test(String(detail || ''));
}
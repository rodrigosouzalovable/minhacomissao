// Prefer Meta's phone; use a strictly formatted phone suffix in the saved label
// only when display_phone is absent. Never use the opaque phone_number_id.
const BRAZIL_DDDS = new Set([
  '11', '12', '13', '14', '15', '16', '17', '18', '19', '21', '22', '24',
  '27', '28', '31', '32', '33', '34', '35', '37', '38', '41', '42', '43',
  '44', '45', '46', '47', '48', '49', '51', '53', '54', '55', '61', '62',
  '63', '64', '65', '66', '67', '68', '69', '71', '73', '74', '75', '77',
  '79', '81', '82', '83', '84', '85', '86', '87', '88', '89', '91', '92',
  '93', '94', '95', '96', '97', '98', '99',
]);

export type MetaPhoneInstance = {
  id: string;
  display_phone?: string | null;
  nome?: string | null;
  saude_raw?: { display_phone_number?: string | null } | null;
  saude_status?: string | null;
  saude_ban_info?: unknown;
};

export function instanceDisplayPhone(instance: Omit<MetaPhoneInstance, 'id'>): string {
  const phone = instance.display_phone?.trim() || instance.saude_raw?.display_phone_number?.trim();
  if (phone) return phone;
  // A saved label such as "SOUZA 62 8269-8799" contains an unambiguous phone.
  // Require separators and a complete trailing phone, not arbitrary label digits.
  return instance.nome?.match(/(?:^|\s)(\+?(?:\d{1,3}[\s-]+)?\(?\d{2,3}\)?[\s-]+\d{4,5}-\d{4})\s*$/)?.[1] || '';
}

export function isBrazilianInstance(instance: Omit<MetaPhoneInstance, 'id'>): boolean {
  return isBrazilianInstancePhone(instanceDisplayPhone(instance));
}

export function isBannedInstance(instance: Pick<MetaPhoneInstance, 'saude_status' | 'saude_ban_info'>): boolean {
  if (String(instance.saude_status ?? '').trim().toUpperCase() === 'BANNED') return true;
  const info = instance.saude_ban_info;
  if (typeof info === 'string') return info.trim().length > 0;
  return !!info && typeof info === 'object' && Object.keys(info).length > 0;
}

export function isBrazilianInstancePhone(raw?: string | null): boolean {
  const input = String(raw ?? '').trim();
  if (!input || !/^\+?[\d\s().-]+$/.test(input)) return false;
  let digits = input.replace(/\D/g, '');
  const explicitCountry = input.startsWith('+') || digits.startsWith('00');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (explicitCountry || digits.length === 12 || digits.length === 13) {
    if (!digits.startsWith('55') || ![12, 13].includes(digits.length)) return false;
    digits = digits.slice(2);
  }
  if (!BRAZIL_DDDS.has(digits.slice(0, 2))) return false;
  const subscriber = digits.slice(2);
  // Meta may display Brazilian mobiles in the legacy eight-digit format.
  // This is country classification, not a reason to rewrite the saved phone.
  return /^[2-9]\d{7}$/.test(subscriber) || /^9\d{8}$/.test(subscriber);
}

export function nationalInstanceCount(instances: readonly Omit<MetaPhoneInstance, 'id'>[]): number {
  return instances.filter(isBrazilianInstance).length;
}

export function nationalSelectionIds(ids: readonly string[], instances: readonly MetaPhoneInstance[]): string[] {
  const allowed = new Set(instances.filter((instance) => isBrazilianInstance(instance) && !isBannedInstance(instance)).map((instance) => instance.id));
  return ids.filter((id) => allowed.has(id));
}

/** Select from the authorized loaded list only; approval and GREEN are both required. */
export function approvedGreenSelectionIds<T extends MetaPhoneInstance & { saude_quality?: string | null }>(
  instances: readonly T[], approvedIds: ReadonlySet<string>,
): string[] {
  return [...new Set(instances.filter((instance) =>
    approvedIds.has(instance.id) &&
    String(instance.saude_quality ?? '').trim().toUpperCase() === 'GREEN' &&
    isBrazilianInstance(instance) && !isBannedInstance(instance)
  ).map((instance) => instance.id))];
}

export function nationalMassSelection<T extends MetaPhoneInstance & { saude_quality?: string | null }>(
  visible: readonly T[], qualityFilterActive: boolean,
): T[] {
  return visible.filter((instance) => {
    if (!isBrazilianInstance(instance) || isBannedInstance(instance)) return false;
    if (qualityFilterActive) return true;
    const quality = String(instance.saude_quality ?? '').trim().toUpperCase();
    return quality === 'GREEN' || quality === 'UNKNOWN' || quality === '';
  });
}
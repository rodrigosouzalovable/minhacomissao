// Meta's display_phone is the phone, never the opaque phone_number_id or name.
const BRAZIL_DDDS = new Set([
  '11', '12', '13', '14', '15', '16', '17', '18', '19', '21', '22', '24',
  '27', '28', '31', '32', '33', '34', '35', '37', '38', '41', '42', '43',
  '44', '45', '46', '47', '48', '49', '51', '53', '54', '55', '61', '62',
  '63', '64', '65', '66', '67', '68', '69', '71', '73', '74', '75', '77',
  '79', '81', '82', '83', '84', '85', '86', '87', '88', '89', '91', '92',
  '93', '94', '95', '96', '97', '98', '99',
]);

export type MetaPhoneInstance = { id: string; display_phone?: string | null };

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
  return /^[2-5]\d{7}$/.test(subscriber) || /^9\d{8}$/.test(subscriber);
}

export function nationalInstanceCount(instances: readonly Pick<MetaPhoneInstance, 'display_phone'>[]): number {
  return instances.filter((instance) => isBrazilianInstancePhone(instance.display_phone)).length;
}

export function nationalSelectionIds(ids: readonly string[], instances: readonly MetaPhoneInstance[]): string[] {
  const allowed = new Set(instances.filter((instance) => isBrazilianInstancePhone(instance.display_phone)).map((instance) => instance.id));
  return ids.filter((id) => allowed.has(id));
}

export function nationalMassSelection<T extends MetaPhoneInstance & { saude_quality?: string | null }>(
  visible: readonly T[], qualityFilterActive: boolean,
): T[] {
  return visible.filter((instance) => {
    if (!isBrazilianInstancePhone(instance.display_phone)) return false;
    if (qualityFilterActive) return true;
    const quality = String(instance.saude_quality ?? '').trim().toUpperCase();
    return quality === 'GREEN' || quality === 'UNKNOWN' || quality === '';
  });
}
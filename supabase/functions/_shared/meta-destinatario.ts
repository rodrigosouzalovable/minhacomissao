// Preserve explicit international country codes. Bare Brazilian local numbers
// still receive +55; the NANP 555 test range is already country-coded.
export function telefoneMeta(raw: string): string | null {
  const input = String(raw || '').trim();
  const digits = input.replace(/\D/g, '');
  if (!digits) return null;
  const explicitInternational = input.startsWith('+') || input.startsWith('00');
  const international = input.startsWith('00') ? digits.slice(2) : digits;
  const normalized = explicitInternational || /^1555\d{7}$/.test(digits)
    ? international
    : digits.startsWith('55') && (digits.length === 12 || digits.length === 13)
      ? digits
      : digits.length === 10 || digits.length === 11
        ? `55${digits}`
        : '';
  return /^[1-9]\d{7,14}$/.test(normalized) ? normalized : null;
}
/** Numeric searches use the indexed SECURITY INVOKER query (RLS remains authoritative). */
export function inboxPhoneSearch(value: string): string | null {
  const trimmed = value.trim();
  if (!/^[\d\s()+.\-]+$/.test(trimmed)) return null;
  const digits = trimmed.replace(/\D/g, '');
  return digits.length >= 4 ? digits.slice(-8) : null;
}

export function inboxPhoneSearchArgs(suffix: string, limit: number) {
  if (!/^\d{4,8}$/.test(suffix)) throw new Error('Sufixo de telefone inválido');
  return { p_suffix: suffix, p_limit: Math.max(1, Math.min(2000, Math.trunc(limit) || 200)) };
}

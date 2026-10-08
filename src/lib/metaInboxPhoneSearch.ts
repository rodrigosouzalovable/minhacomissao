/** Numeric searches use the existing authenticated contact SELECT (RLS remains authoritative). */
export function inboxPhoneSearch(value: string): string | null {
  const trimmed = value.trim();
  if (!/^[\d\s()+.\-]+$/.test(trimmed)) return null;
  const digits = trimmed.replace(/\D/g, '');
  return digits.length >= 4 ? digits.slice(-8) : null;
}

export function inboxPhoneSearchQuery<T extends {
  like: (column: string, pattern: string) => T;
  order: (column: string, options: { ascending: boolean; nullsFirst: boolean }) => T;
  limit: (count: number) => T;
}>(query: T, suffix: string, limit: number): T {
  return query.like('telefone', `%${suffix}`)
    .order('ultima_mensagem_em', { ascending: false, nullsFirst: false })
    .limit(limit);
}
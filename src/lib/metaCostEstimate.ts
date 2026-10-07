export const META_ESTIMATE_PRICES: Record<string, number> = {
  MARKETING: 0.0625,
  UTILITY: 0.0068,
  AUTHENTICATION: 0.0068,
  SERVICE: 0,
};
export const META_ESTIMATE_FX = 5.55;

export function normalizeCostPhone(value: string): string {
  const digits = String(value || '').replace(/\D+/g, '');
  if (digits.startsWith('55') && digits.length >= 12) return digits;
  return digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
}

export type CostWindow = { telefone: string; instancia_id: string; ultima_msg_entrada_em: string | null };

/** Until routing is fixed, a free Utility estimate requires a window on every possible sender. */
export function estimateMetaCost(phones: string[], instanceIds: string[], category: string | null, windows: CostWindow[], now = Date.now(), incomplete = false) {
  const categoria = String(category || '').toUpperCase();
  const precoUsd = META_ESTIMATE_PRICES[categoria] ?? 0;
  const normalized = phones.map(normalizeCostPhone).filter(Boolean);
  const senders = [...new Set(instanceIds)];
  const open = new Map<string, Set<string>>();
  for (const row of windows) {
    const timestamp = row.ultima_msg_entrada_em ? Date.parse(row.ultima_msg_entrada_em) : NaN;
    if (timestamp > now - 86_400_000 && timestamp <= now && senders.includes(row.instancia_id)) {
      const key = normalizeCostPhone(row.telefone);
      const found = open.get(key) ?? new Set<string>();
      found.add(row.instancia_id);
      open.set(key, found);
    }
  }
  const total = normalized.length;
  const gratis = categoria === 'SERVICE' ? total : !incomplete && categoria === 'UTILITY' && senders.length > 0
    ? normalized.filter((phone) => senders.every((id) => open.get(phone)?.has(id))).length : 0;
  const cobrados = total - gratis;
  const usd = cobrados * precoUsd;
  return { total, gratis, cobrados, precoUsd, usd, brl: usd * META_ESTIMATE_FX, fxRate: META_ESTIMATE_FX, categoria, incomplete, conservative: categoria === 'UTILITY' && senders.length > 1 };
}
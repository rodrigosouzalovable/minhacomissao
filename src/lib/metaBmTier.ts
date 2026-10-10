export const BM_TIER_VALUES: Record<string, number> = { TIER_250: 250, TIER_1K: 1000, TIER_2K: 2000, TIER_10K: 10000, TIER_100K: 100000, TIER_UNLIMITED: 1000000 };
type Bm = { id: string; tier_diario?: number | null; tier_manual?: boolean | null; tier_ilimitado?: boolean | null };
type Instance = { id: string; meta_bm_id?: string | null; ativo: boolean; messaging_limit_manual?: string | null; saude_tier?: string | null };
type Quota = { tier_diario: number; tier_ilimitado: boolean; instancias: number };
export type InheritedBmTier = { value: string; limit: number; source: string; unlimited: boolean };

export function tierNumber(value?: string | null): number | null {
  if (!value) return null;
  const key = value.replace(/^MESSAGING_LIMIT_/, "");
  return BM_TIER_VALUES[key] ?? null;
}

export function resolveBmTier(bm: Bm | undefined, instances: Instance[], quota?: Quota | null, excludeId?: string): InheritedBmTier | null {
  if (!bm) return null;
  const peers = instances.filter((i) => i.meta_bm_id === bm.id && i.ativo && i.id !== excludeId);
  if (bm.tier_manual || bm.tier_ilimitado) {
    const unlimited = bm.tier_ilimitado === true;
    const limit = unlimited ? 1000000 : Number(bm.tier_diario);
    if (!Number.isFinite(limit) || limit <= 0) return null;
    // Explicit BM limits stay owned by the BM, including custom values.
    return { value: "__auto__", limit, source: "bm", unlimited };
  }
  const candidates = peers.map((i) => ({ value: i.messaging_limit_manual ?? "__auto__", limit: tierNumber(i.messaging_limit_manual ?? i.saude_tier) }))
    .filter((i): i is { value: string; limit: number } => i.limit !== null).sort((a, b) => b.limit - a.limit);
  const highest = candidates[0];
  const hasQuota = quota && quota.instancias > 0 && quota.tier_diario > 0;
  const limit = hasQuota ? (quota.tier_ilimitado ? 1000000 : quota.tier_diario) : highest?.limit;
  if (!limit) return null;
  const manual = candidates.find((i) => i.limit === limit && i.value !== "__auto__");
  return { value: manual?.value ?? "__auto__", limit, source: manual ? "manual" : "meta_api", unlimited: limit >= 999999 };
}

export function inheritedTierPatch(tier: InheritedBmTier | null) {
  return { messaging_limit_manual: tier && tier.value !== "__auto__" ? tier.value : null,
    messaging_limit_source: tier?.source ?? "default", tier_diario: tier?.limit ?? 1000 };
}

export function shouldPropagateBmTier(touched: boolean, next: string, previous: string): boolean {
  return touched && next !== previous;
}
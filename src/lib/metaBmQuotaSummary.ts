import type { CotaBm } from '../hooks/useBmCotas';

export type BmQuotaInstance = {
  meta_bm_id?: string | null;
  business_id?: string | null;
  waba_id?: string | null;
  phone_number_id?: string | null;
  ativo: boolean;
  saude_status?: string | null;
  saude_ban_info?: unknown;
  saude_restricoes?: unknown;
};
type BmIdentity = { id: string; business_id?: string | null };
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const upper = (value: unknown) => String(value ?? '').trim().toUpperCase();
const hasBanInfo = (value: unknown) => typeof value === 'string'
  ? value.trim().length > 0
  : Object.keys(record(value)).length > 0;

function entities(instance: BmQuotaInstance) {
  const restrictions = record(instance.saude_restricoes);
  return ['phone_health', 'waba_health'].flatMap(key => {
    const list = record(restrictions[key]).entities;
    return Array.isArray(list) ? list.map(record) : [];
  });
}
function entityBanned(entity: Record<string, unknown>): boolean {
  if (upper(entity.can_send_message) === 'BANNED') return true;
  const errors = entity.errors;
  return Array.isArray(errors) && errors.some(value => {
    const error = record(value);
    return (upper(entity.entity_type) === 'WABA' && Number(error.error_code) === 141014)
      || /\bbanned\b/i.test(String(error.error_description ?? ''));
  });
}

/** Presentation only: never modifies shared send quotas or persisted health. */
export function summarizeBmQuotas(
  quotas: readonly CotaBm[], instances: readonly BmQuotaInstance[], bms: readonly BmIdentity[],
) {
  const eligible = quotas.filter(quota => {
    if (quota.instancias <= 0) return false;
    const peers = instances.filter(instance => instance.meta_bm_id === quota.bm_id);
    // Missing/partial authorized data is not evidence of a ban.
    if (!peers.length) return true;
    const businessId = bms.find(bm => bm.id === quota.bm_id)?.business_id;
    const bannedWabas = new Set<string>();
    let businessBanned = false;
    for (const peer of peers) {
      for (const entity of entities(peer)) {
        if (!entityBanned(entity)) continue;
        const id = String(entity.id ?? '');
        if (upper(entity.entity_type) === 'BUSINESS' && id && id === (businessId || peer.business_id)) {
          businessBanned = true;
        }
        if (upper(entity.entity_type) === 'WABA' && id && id === peer.waba_id) bannedWabas.add(id);
      }
      if (hasBanInfo(peer.saude_ban_info) && peer.waba_id) bannedWabas.add(peer.waba_id);
    }
    if (businessBanned) return false;
    const active = peers.filter(peer => peer.ativo);
    if (!active.length || active.length < quota.instancias) return true;
    return active.some(peer => !bannedWabas.has(peer.waba_id ?? '')
      && upper(peer.saude_status) !== 'BANNED'
      && !hasBanInfo(peer.saude_ban_info)
      && !entities(peer).some(entity => upper(entity.entity_type) === 'PHONE_NUMBER'
        && String(entity.id ?? '') === peer.phone_number_id && entityBanned(entity)));
  });
  const limited = eligible.filter(quota => !quota.tier_ilimitado);
  return {
    quantidade: eligible.length,
    ilimitadas: eligible.length - limited.length,
    limite: limited.reduce((sum, quota) => sum + quota.tier_diario, 0),
    usados: limited.reduce((sum, quota) => sum + quota.enviados_24h, 0),
    restantes: limited.reduce((sum, quota) => sum + quota.restantes, 0),
  };
}
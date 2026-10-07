import { isInformationalDisplayNameLimit } from './metaNameStatus';
export interface PoolInstance {
  id: string; ativo?: boolean; provider?: string | null; saude_quality?: string | null;
  estado_pool?: string | null; pausa_automatica_motivo?: string | null; pool_fora_manual?: boolean | null;
}
export function podeOferecerReativacao(i: PoolInstance): boolean {
  return i.ativo !== false && i.provider !== 'uazapi' && !i.pool_fora_manual &&
    ['YELLOW', 'RED'].includes(String(i.saude_quality).toUpperCase()) &&
    ['pausado', 'restrita', 'quarentena'].includes(String(i.estado_pool)) &&
    !/fora.*manual|retirada.*manual/i.test(i.pausa_automatica_motivo || '');
}
export function motivoRecusaReativacao(r: any, id: string): string | null {
  if (!r || r.instancia_id !== id || r.error || r.raw?.error) return 'Não foi possível confirmar a liberação na Meta. Confira o cadastro e tente verificar a saúde novamente.';
  if (String(r.status).toUpperCase() !== 'CONNECTED') return 'A Meta não confirmou que o número está conectado.';
  if (r.ban_info && (typeof r.ban_info !== 'object' || Object.keys(r.ban_info).length)) return 'A Meta ainda informa bloqueio ou banimento.';
  const hs = [r.phone_health, r.waba_health].filter(Boolean);
  const es = hs.flatMap(h => Array.isArray(h.entities) ? h.entities : []);
  const blocked = new Set(['BLOCKED', 'LIMITED', 'RESTRICTED']);
  if (hs.some(h => blocked.has(String(h.can_send_message).toUpperCase()))) return 'A Meta confirmou uma limitação de envio. Reativar não remove essa restrição.';
  for (const e of es) {
    if (!blocked.has(String(e.can_send_message).toUpperCase())) continue;
    if (e.entity_type === 'PHONE_NUMBER' && isInformationalDisplayNameLimit((e.additional_info || []).join(' '))) continue;
    return 'A Meta confirmou uma restrição no número ou na conta. Resolva-a antes de reativar.';
  }
  if (!['BUSINESS', 'WABA', 'PHONE_NUMBER'].every(t => es.some(e => String(e.entity_type).toUpperCase() === t && String(e.can_send_message).toUpperCase() === 'AVAILABLE'))) return 'A consulta da Meta foi incompleta. Tente verificar a saúde novamente; nada foi reativado.';
  if (r.restrito_meta && !r.limitacao_nome_informativa) return 'A Meta ainda informa uma restrição de envio.';
  return null;
}

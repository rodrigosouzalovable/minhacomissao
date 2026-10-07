import { metaMessagingRestriction } from './meta-template-eligibility.ts';
export function brtDate(now = new Date()): string { return new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(now); }
export function overdueStage(due: string, today: string): number | null {
  const days = Math.round((Date.parse(today + 'T12:00:00Z') - Date.parse(due + 'T12:00:00Z')) / 86400000);
  return days >= 1 && days <= 10 ? days >= 7 ? 7 : days >= 3 ? 3 : 1 : null;
}
export function reminderWindow(now = new Date()): boolean {
  const brt = new Date(now.getTime() - 10800000);
  return brt.getUTCDay() !== 0 && brt.getUTCHours() >= 8 && brt.getUTCHours() < 18;
}
export function greenSender(inst: any, now = Date.now()): boolean {
  return inst.ativo === true && (inst.provider || 'meta') === 'meta' && inst.saude_status === 'CONNECTED' && inst.saude_quality === 'GREEN'
    && inst.qualidade_leitura_ok === true && Date.parse(inst.saude_checked_at) > now - 21600000
    && (!inst.estado_pool || inst.estado_pool === 'ativo') && !inst.pool_fora_manual && !inst.instancia_teste_aquecimento
    && ![inst.pausa_automatica_ate, inst.quarentena_ate, inst.rate_limit_ate].some(t => t && Date.parse(t) > now)
    && !metaMessagingRestriction(inst);
}
export function reminderValues(name: string, company: string, due: string, map: Record<string,string>, body: string): Record<string,string> | null {
  const creditor: Record<string,string> = { ume_novo_mundo: 'NOVO MUNDO', mundo_da_moda: 'UME', odres_cred: 'ODRES CRED' };
  const parts = due.split('-');
  const values: Record<string,string> = { nome: name?.trim(), credor: creditor[company], vencimento: parts.length === 3 ? parts.reverse().join('/') : '' };
  const vars: Record<string,string> = {};
  for (const match of body.matchAll(/\{\{\s*([\w]+)\s*\}\}/g)) {
    const key = match[1]; const value = values[map[key]];
    if (!value) return null;
    vars[key] = value;
  }
  return values.nome && values.credor && values.vencimento ? vars : null;
}
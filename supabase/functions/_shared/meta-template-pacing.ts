export const TEMPLATE_INTERVAL_MIN_SECONDS = 120;
export const TEMPLATE_INTERVAL_MAX_SECONDS = 300;

export function templateIntervalSeconds(random = Math.random): number {
  return TEMPLATE_INTERVAL_MIN_SECONDS + Math.floor(Math.max(0, Math.min(0.999999999, random())) * 181);
}

export async function claimTemplatePacing(db: any, instanceId: string, masterId: string) {
  const { data, error } = await db.rpc('claim_meta_template_pacing', {
    p_instancia_id: instanceId, p_mestre_id: masterId,
  });
  if (error) throw error;
  if (!data || typeof data.allowed !== 'boolean') throw new Error('Reserva de intervalo indisponível');
  return data as { allowed: boolean; token?: string; existing?: boolean; next_allowed_at: string };
}

export async function finishTemplatePacing(db: any, token?: string) {
  if (!token) return;
  const { error } = await db.rpc('finish_meta_template_pacing', { p_token: token });
  if (error) console.error('[template-pacing] falha ao finalizar reserva', error.message);
}

export async function deferTemplate(db: any, instanceId: string, masterId: string, when: string, reason: string) {
  const { error } = await db.from('meta_templates_onboarding_fila').upsert({
    instancia_id: instanceId, template_mestre_id: masterId, status: 'PENDENTE',
    agendado_para: when, motivo: `aplicacao_manual: ${reason}`, prioridade: 1,
  }, { onConflict: 'instancia_id,template_mestre_id', ignoreDuplicates: true });
  if (error) throw error;
  const { data: row, error: readError } = await db.from('meta_templates_onboarding_fila')
    .select('id,status,agendado_para').eq('instancia_id', instanceId).eq('template_mestre_id', masterId).single();
  if (readError) throw readError;
  if (row.status === 'PENDENTE') {
    const next = new Date(row.agendado_para) > new Date(when) ? row.agendado_para : when;
    const { error: updateError } = await db.from('meta_templates_onboarding_fila')
      .update({ agendado_para: next, motivo: `aplicacao_manual: ${reason}` }).eq('id', row.id).eq('status', 'PENDENTE').lte('agendado_para', next);
    if (updateError) throw updateError;
  } else if (row.status !== 'ENVIADO') {
    throw new Error('Aplicação anterior encerrada; revise o motivo antes de retomar.');
  }
}
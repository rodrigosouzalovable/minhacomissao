import { tierAtual } from './meta-aquecimento-inteligente.ts';

export const GREEN_SOUL_BM_ID = '843830f9-cd23-4600-8ee6-73674efa460b';

export interface PilotoBm {
  bm_id: string;
  ativo: boolean;
  etapa: number;
  metas_diarias: number[];
  mix_leads_pct: number;
  entrega_min_pct: number;
  falha_reduzir_pct: number;
  falha_pausar_pct: number;
  status: string;
  motivo?: string | null;
}

export function telefoneChave(valor: unknown): string {
  return String(valor || '').replace(/\D/g, '').slice(-8);
}

export function dataBrtDiasAtras(dias: number): string {
  const agora = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  agora.setDate(agora.getDate() - dias);
  return agora.toISOString().slice(0, 10);
}

export async function carregarPilotosAtivos(supabase: any): Promise<Map<string, PilotoBm>> {
  const { data } = await supabase
    .from('meta_bm_escalada_piloto')
    .select('*')
    .eq('ativo', true);
  return new Map(((data || []) as PilotoBm[]).map((p) => [String(p.bm_id), p]));
}

export async function avaliarPiloto(
  supabase: any,
  piloto: PilotoBm,
  instanciasBm: any[],
): Promise<{ meta: number; etapa: number; status: string; motivo: string | null; tier: number }> {
  const tier = Math.max(...instanciasBm.map((i) => tierAtual(i)), 0);
  if (tier >= 10_000) {
    await supabase.from('meta_bm_escalada_piloto').update({
      ativo: false,
      status: 'concluido_10k',
      motivo: 'tier_10k_confirmado_meta',
      encerrado_em: new Date().toISOString(),
      atualizado_em: new Date().toISOString(),
    }).eq('bm_id', piloto.bm_id);
    return { meta: 0, etapa: piloto.etapa, status: 'concluido_10k', motivo: 'tier_10k_confirmado_meta', tier };
  }

  const participantes = instanciasBm.filter((i) => i.pool_fora_manual !== true && i.estado_pool !== 'fora_manual');
  const bloqueada = participantes.some((i) => {
    const qualidade = String(i.saude_quality || 'UNKNOWN').toUpperCase();
    const quarentena = i.quarentena_ate && new Date(i.quarentena_ate).getTime() > Date.now();
    const pausa = i.pausa_automatica_ate && new Date(i.pausa_automatica_ate).getTime() > Date.now();
    return ['YELLOW', 'RED'].includes(qualidade) || quarentena || pausa ||
      ['restrita', 'pausado'].includes(String(i.estado_pool || '').toLowerCase());
  });
  if (bloqueada) return { meta: 0, etapa: piloto.etapa, status: 'pausado', motivo: 'qualidade_ou_restricao_meta', tier };

  const ontem = dataBrtDiasAtras(1);
  const ids = instanciasBm.map((i) => i.id);
  const { data: logsOntem } = ids.length > 0
    ? await supabase.from('meta_aquecimento_destino_log')
      .select('destino_telefone, status, entregue_em, respondeu_em')
      .in('instancia_id', ids).eq('dia', ontem).limit(5000)
    : { data: [] };
  const logs = (logsOntem || []) as any[];
  const enviados = new Set(logs.filter((l) => l.status !== 'falha').map((l) => telefoneChave(l.destino_telefone)).filter(Boolean));
  const entregues = new Set(logs.filter((l) => l.entregue_em).map((l) => telefoneChave(l.destino_telefone)).filter(Boolean));
  const falhas = logs.filter((l) => l.status === 'falha').length;
  const respostas = logs.filter((l) => l.respondeu_em).length;
  const entregaPct = enviados.size > 0 ? (entregues.size / enviados.size) * 100 : 0;
  const falhaPct = logs.length > 0 ? (falhas / logs.length) * 100 : 0;
  const metas = Array.isArray(piloto.metas_diarias) && piloto.metas_diarias.length ? piloto.metas_diarias : [450, 550, 650];
  let etapa = Math.max(1, Math.min(Number(piloto.etapa || 1), metas.length));
  let status = 'escalando';
  let motivo: string | null = null;
  let meta = Number(metas[etapa - 1] || 450);

  if (falhaPct > Number(piloto.falha_pausar_pct || 5)) {
    status = 'pausado';
    motivo = 'falhas_acima_5_pct';
    meta = 0;
  } else if (falhaPct >= Number(piloto.falha_reduzir_pct || 3)) {
    status = 'reduzido';
    motivo = 'falhas_entre_3_e_5_pct';
    meta = Math.floor(meta * 0.7);
  } else if (enviados.size > 0 && entregaPct >= Number(piloto.entrega_min_pct || 95)) {
    etapa = Math.min(etapa + 1, metas.length);
    meta = Number(metas[etapa - 1] || metas[metas.length - 1]);
  } else if (enviados.size > 0) {
    motivo = 'entrega_abaixo_95_pct';
  }

  await supabase.from('meta_bm_escalada_diaria').upsert({
    bm_id: piloto.bm_id,
    dia: ontem,
    etapa: Number(piloto.etapa || 1),
    meta_unicos: Number(metas[Math.max(0, Number(piloto.etapa || 1) - 1)] || 450),
    enviados_unicos: enviados.size,
    entregues_unicos: entregues.size,
    respostas,
    falhas,
    qualidade: participantes.map((i) => String(i.saude_quality || 'UNKNOWN')).join(',') || 'UNKNOWN',
    tier_oficial: tier,
    status,
    motivo,
    atualizado_em: new Date().toISOString(),
  }, { onConflict: 'bm_id,dia' });

  await supabase.from('meta_bm_escalada_piloto').update({
    etapa,
    status,
    motivo,
    atualizado_em: new Date().toISOString(),
  }).eq('bm_id', piloto.bm_id);
  return { meta, etapa, status, motivo, tier };
}
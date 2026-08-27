// Escolhe a melhor instância Meta para o próximo envio baseado em score de saúde.
// Regras: só considera estado_pool='ativo', não pausada, dentro do horário e cota.
// Fórmula: quality × tier × idade × (1 - uso_hoje/cota_efetiva)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { carregarCotasBm, motivoBloqueioBm } from '../_shared/bm-cotas.ts';
import { enviadosHojeBrt, enviadosUltimaHora, tetoBase } from '../_shared/meta-freio.ts';


const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function pesoQualidade(q: string | null, ignorarQualidade = false): number {
  const v = String(q || '').toUpperCase();
  if (v === 'GREEN') return 100;
  if (v === 'UNKNOWN' || v === '') return 60;
  if (ignorarQualidade) return 30; // YELLOW/RED permitidos (mesmo peso do YELLOW throttled)
  return 0; // YELLOW/RED bloqueado
}

function pesoTier(t: string | null): number {
  const v = String(t || '').toUpperCase();
  if (v.includes('UNLIMITED')) return 1000;
  if (v.includes('100K')) return 400;
  if (v.includes('10K')) return 40;
  if (v.includes('1K')) return 4;
  return 1; // TIER_250 e default
}
function fatorIdade(dias: number): number {
  if (dias < 7) return 0.3;
  if (dias < 30) return 0.7;
  return 1.0;
}
function cotaFase(fase: string, cfg: any): number {
  switch (fase) {
    case 'fase1': return cfg?.cota_fase1 || 20;
    case 'fase2': return cfg?.cota_fase2 || 50;
    case 'fase3': return cfg?.cota_fase3 || 150;
    case 'fase4': return cfg?.cota_fase4 || 400;
    case 'livre': return 999999;
    default: return 0; // aguardando
  }
}
function faseFromDias(d: number): string {
  if (d < 1) return 'fase1';
  if (d <= 3) return 'fase1';
  if (d <= 7) return 'fase2';
  if (d <= 14) return 'fase3';
  if (d <= 21) return 'fase4';
  return 'livre';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const { instancia_ids, user_id, excluir_id, excluir_ids, ignorar_pausa_qualidade } = await req.json();
    const ignoraQualidadeGlobal = ignorar_pausa_qualidade === true;
    const excluidas: string[] = Array.isArray(excluir_ids) ? excluir_ids : [];

    if (!Array.isArray(instancia_ids) || instancia_ids.length === 0) {
      return new Response(JSON.stringify({ success: false, error: 'instancia_ids obrigatório' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }


    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: cfg } = await supabase.from('meta_envio_pool_config').select('*').eq('id', 1).maybeSingle();

    // Bloqueio de domingo/horário BRT
    const nowBrt = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const diaSemana = nowBrt.getDay(); // 0=domingo
    if (cfg?.bloquear_domingo && diaSemana === 0) {
      return new Response(JSON.stringify({ success: false, blocked: 'domingo', error: 'Envios bloqueados aos domingos' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const hh = nowBrt.getHours() + nowBrt.getMinutes() / 60;
    const [hIni] = String(cfg?.horario_inicio || '08:00:00').split(':').map(Number);
    const [hFim] = String(cfg?.horario_fim || '20:00:00').split(':').map(Number);
    if (hh < hIni || hh >= hFim) {
      return new Response(JSON.stringify({ success: false, blocked: 'horario', error: `Fora do horário (${hIni}h–${hFim}h BRT)` }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Carrega instâncias candidatas
    const { data: insts } = await supabase
      .from('meta_whatsapp_instances').select('*')
      .in('id', instancia_ids).eq('ativo', true);

    if (!insts?.length) {
      return new Response(JSON.stringify({ success: false, error: 'nenhuma instância ativa' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const hoje = new Date().toISOString().slice(0, 10);
    const nowIso = new Date().toISOString();

    // Métricas de ontem por instância (guardrail ratio inbound e block-rate)
    const ontem = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const { data: metricasOntem } = await supabase
      .from('meta_instance_daily_metrics')
      .select('instancia_id, enviadas, inbound, bloqueadas, falharam')
      .in('instancia_id', instancia_ids)
      .eq('data', ontem);
    const metricaMap = new Map<string, any>();
    (metricasOntem || []).forEach((m: any) => metricaMap.set(m.instancia_id, m));

    const guardrailRatio = cfg?.guardrail_ratio_inbound !== false;
    const ratioMinPct = Number(cfg?.guardrail_ratio_min_pct ?? 5);
    const blockMaxPct = Number(cfg?.guardrail_block_rate_max_pct ?? 2);
    const volumeMinGuardrail = Number(cfg?.guardrail_volume_minimo ?? 50);

    // Freio de qualidade do dia (teto efetivo por instância)
    const freioAtivo = cfg?.freio_ativo !== false;
    const hojeBrt = new Date(
      new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }),
    ).toISOString().slice(0, 10);
    const { data: freioRows } = await supabase
      .from('meta_instance_freio_diario')
      .select('instancia_id, teto_efetivo, motivo_reducao')
      .in('instancia_id', instancia_ids)
      .eq('dia', hojeBrt);
    const freioMap = new Map<string, any>();
    (freioRows || []).forEach((f: any) => freioMap.set(f.instancia_id, f));
    const cotaMaxHora = Math.max(1, Number(cfg?.cota_max_hora ?? 12));

    // Cotas por BM (janela móvel de 24h)
    const cotasBm = await carregarCotasBm(supabase);


    // Contagem hoje (fallback: enviados_hoje da própria row)
    const candidates: any[] = [];
    const descartados: string[] = [];
    const reprovadosGuardrail: any[] = [];
    for (const inst of insts) {
      const rotulo = inst.nome || inst.phone_number_id || inst.id;
      if (excluidas.includes(inst.id)) { descartados.push(`${rotulo}: já falhou na entrega para este contato`); continue; }
      // Nome de exibição reprovado/em análise costuma gerar falha de entrega (#131000)
      const nameStatus = String(inst.meta_name_status || '').toUpperCase();
      if (nameStatus === 'REJECTED' || nameStatus === 'PENDING_REVIEW') {
        descartados.push(`${rotulo}: nome de exibição ${nameStatus} na Meta (entrega bloqueada)`);
        continue;
      }
      const motivoBm = motivoBloqueioBm(cotasBm, inst.meta_bm_id);
      if (motivoBm) { descartados.push(`${rotulo}: ${motivoBm}`); continue; }

      const motivoPausaLower = String(inst.pausa_automatica_motivo || '').toLowerCase();
      const pausaPorQualidade = motivoPausaLower.startsWith('quality=');
      const pausaPorStatus = motivoPausaLower.startsWith('status=');
      const pausaAtiva = !!inst.pausa_automatica_ate && new Date(inst.pausa_automatica_ate) > new Date();
      const estadoBloqueado = inst.estado_pool === 'restrita' || inst.estado_pool === 'pausado';
      // Liberação de PAUSA: botão "Retomar" OU instância sem pausa/restrição ativa.
      const ignoraQualidade =
        ignoraQualidadeGlobal || inst.qualidade_liberada_manual === true || (!pausaAtiva && !estadoBloqueado);
      // Gate de QUALIDADE (mais estrito): YELLOW/RED só passam em rajada ou com
      // liberação manual explícita — proteger o número vem antes do volume.
      const ignoraQualidadeGate = ignoraQualidadeGlobal || inst.qualidade_liberada_manual === true;



      if (inst.estado_pool && inst.estado_pool !== 'ativo') {
        // Em modo rajada, ignora pausa por qualidade (só bloqueia restrita ou pausa por status).
        const bloqueia = inst.estado_pool === 'restrita' || !(ignoraQualidade && pausaPorQualidade);
        if (bloqueia) { descartados.push(`${rotulo}: estado do pool = ${inst.estado_pool}`); continue; }
      }
      if (inst.pausa_automatica_ate && new Date(inst.pausa_automatica_ate) > new Date()) {
        const bloqueia = !(ignoraQualidade && pausaPorQualidade);
        if (bloqueia) { descartados.push(`${rotulo}: pausada até ${new Date(inst.pausa_automatica_ate).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} (${inst.pausa_automatica_motivo || 'sem motivo'})`); continue; }
        // pausa por status sempre bloqueia
        if (pausaPorStatus) { descartados.push(`${rotulo}: pausada por ${inst.pausa_automatica_motivo}`); continue; }
      }

      // Quarentena por queda de qualidade: fora do pool de campanha até a data.
      if (inst.quarentena_ate && new Date(inst.quarentena_ate) > new Date() && !ignoraQualidadeGlobal) {
        descartados.push(
          `${rotulo}: em quarentena até ${new Date(inst.quarentena_ate).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}` +
          `${inst.quarentena_motivo ? ` (${inst.quarentena_motivo})` : ''}`,
        );
        continue;
      }

      // Modo recuperação: número só faz aquecimento interno, nunca campanha.
      if (inst.recuperacao_ativa === true && !ignoraQualidadeGlobal) {
        descartados.push(`${rotulo}: em recuperação de qualidade (aquecimento automático em andamento)`);
        continue;
      }



      // Reset diário (telemetria — não bloqueia envio)
      let uso = inst.enviados_hoje || 0;
      if (inst.ultimo_reset !== hoje) uso = 0;

      const diasAtivo = inst.data_ativacao_api
        ? Math.floor((Date.now() - new Date(inst.data_ativacao_api).getTime()) / 86400000) + 1
        : 0;
      const fase = inst.data_ativacao_api ? faseFromDias(diasAtivo) : 'livre';

      // ===== Teto diário efetivo + teto horário =====
      // Modo "sem teto": números GREEN enviam até a cota da própria Meta.
      // YELLOW/RED/quarentena/recuperação continuam com todas as travas.
      const qualidadeUp = String(inst.saude_quality || '').toUpperCase();
      const semTeto = cfg?.sem_teto_global === true && qualidadeUp === 'GREEN';
      if (freioAtivo && !semTeto) {
        const freio = freioMap.get(inst.id);
        const tetoDia = freio ? Number(freio.teto_efetivo) : tetoBase(inst, cfg, fase);
        const enviadosDia = await enviadosHojeBrt(supabase, inst.id);
        if (tetoDia <= 0) {
          descartados.push(`${rotulo}: freio de qualidade — ${freio?.motivo_reducao || 'sem cota hoje'}`);
          continue;
        }
        if (enviadosDia >= tetoDia) {
          descartados.push(`${rotulo}: teto diário atingido (${enviadosDia}/${tetoDia})`);
          continue;
        }
        const naHora = await enviadosUltimaHora(supabase, inst.id);
        if (naHora >= cotaMaxHora) {
          descartados.push(`${rotulo}: teto por hora atingido (${naHora}/${cotaMaxHora})`);
          continue;
        }
      }



      // Guardrails baseados em métricas de ontem.
      // Só bloqueios REAIS de usuário (mo.bloqueadas) reprovam a instância —
      // falhas técnicas (template, mídia, rede) apenas reduzem o teto de uso.
      const mo = metricaMap.get(inst.id);
      let tetoQualidade = 1.0;
      let reprovadaGuardrail: string | null = null;
      if (mo && mo.enviadas > volumeMinGuardrail) {
        const blockRate = (mo.bloqueadas || 0) / Math.max(1, mo.enviadas) * 100;
        if (blockRate > blockMaxPct) {
          reprovadaGuardrail = `${rotulo}: ${blockRate.toFixed(1)}% de bloqueios de usuário ontem (limite ${blockMaxPct}%)`;
        }
        const failRate = (mo.falharam || 0) / Math.max(1, mo.enviadas) * 100;
        if (failRate > blockMaxPct) tetoQualidade = Math.min(tetoQualidade, 0.5); // falha técnica: só reduz ritmo
      }
      if (guardrailRatio && mo && mo.enviadas > volumeMinGuardrail) {
        const ratio = mo.inbound / Math.max(1, mo.enviadas) * 100;
        if (ratio < ratioMinPct) tetoQualidade = 0.3; // sem inbound = teto 30% da cota
      }
      const q = pesoQualidade(inst.saude_quality, ignoraQualidadeGate);
      if (q === 0) { descartados.push(`${rotulo}: qualidade ${String(inst.saude_quality || 'desconhecida').toUpperCase()}`); continue; }
      if (String(inst.saude_quality || '').toUpperCase() === 'YELLOW') tetoQualidade = Math.min(tetoQualidade, 0.3);
      if (String(inst.saude_quality || '').toUpperCase() === 'RED' && ignoraQualidadeGate) tetoQualidade = Math.min(tetoQualidade, 0.3);

      const tierEfetivo = inst.messaging_limit_manual || inst.saude_tier;
      // Score prioriza chips com menos uso hoje para distribuição no round-robin.
      const score = q * pesoTier(tierEfetivo) * fatorIdade(diasAtivo) * tetoQualidade * (1 / (1 + uso));
      const candidato = { inst, score, fase, cota: 999999, uso, diasAtivo };
      if (reprovadaGuardrail) {
        descartados.push(reprovadaGuardrail);
        reprovadosGuardrail.push({ ...candidato, score: score * 0.3 });
        continue;
      }
      candidates.push(candidato);
    }

    // Fallback: se todo mundo caiu apenas no guardrail interno (e não em
    // qualidade/pausa/restrição da Meta), usa o melhor com ritmo reduzido.
    let usouFallbackGuardrail = false;
    if (!candidates.length && reprovadosGuardrail.length) {
      reprovadosGuardrail.sort((a, b) => b.score - a.score);
      candidates.push(reprovadosGuardrail[0]);
      usouFallbackGuardrail = true;
    }

    if (!candidates.length) {
      return new Response(JSON.stringify({
        success: false,
        blocked: 'sem_disponivel',
        error: descartados.length
          ? `Nenhuma instância disponível — ${descartados.join(' | ')}`
          : 'Nenhuma instância disponível (cota, pausa ou qualidade)',
        motivos: descartados,
      }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }


    candidates.sort((a, b) => b.score - a.score);
    // Round-robin estrito: se o chamador passar excluir_id (última instância usada)
    // e houver mais de um candidato, força alternância removendo essa instância do topo.
    let winner = candidates[0];
    if (excluir_id && candidates.length > 1 && winner.inst.id === excluir_id) {
      winner = candidates[1];
    }

    // Cacheia score
    await supabase.from('meta_whatsapp_instances').update({
      score_saude_cache: winner.score,
      fase_rampup: winner.fase,
    }).eq('id', winner.inst.id);

    return new Response(JSON.stringify({
      success: true,
      instancia_id: winner.inst.id,
      nome: winner.inst.nome,
      score: winner.score,
      fase: winner.fase,
      cota_efetiva: winner.cota,
      enviados_hoje: winner.uso,
      dias_ativo: winner.diasAtivo,
      total_candidatos: candidates.length,
      fallback_guardrail: usouFallbackGuardrail,
      motivos_descartes: descartados,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : 'erro' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

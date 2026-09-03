// Aquecimento dos números Meta saudáveis (cron a cada 10 min).
// Cada número segue a trilha planejada por meta-aquecimento-planejar: um alvo
// diário de destinatários ÚNICOS, distribuído entre os números UAZAPI da pasta
// AQUECIMENTO (respondidos pelo IAGO) e leads reais do Google Maps de nichos
// que respondem bem. Tudo limitado pelo orçamento diário em reais.
// A recuperação de números YELLOW/RED continua em meta-recuperacao-tick.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  dentroJanelaAquecimento,
  destinosAquecimento,
  enviarTemplateAquecimento,
  erroFatalMeta,
  escolherTemplateAprovado,
  hojeBrt,
  sorteio,
} from '../_shared/meta-aquecimento-alvo.ts';
import {
  carregarOrcamento,
  custoDoTemplate,
  leadsParaAquecimento,
  marcarLeadUsado,
  registrarGasto,
} from '../_shared/meta-aquecimento-inteligente.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_POR_RUN = 5;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const body = await req.json().catch(() => ({}));
    const forcar = body?.forcar === true;

    const { data: cfg } = await supabase
      .from('meta_envio_pool_config').select('*').eq('id', 1).maybeSingle();
    if (!cfg?.aquecimento_ativo && !forcar) {
      return json({ ok: true, skipped: 'aquecimento_desativado' });
    }

    const hIni = Number(String(cfg?.horario_inicio || '09:00').split(':')[0]) || 9;
    const hFim = Number(String(cfg?.horario_fim || '19:00').split(':')[0]) || 19;
    const janela = dentroJanelaAquecimento(Math.max(8, hIni), Math.min(19, hFim));
    if (!janela.ok && !forcar) return json({ ok: true, skipped: janela.motivo });

    const dia = hojeBrt();

    // ===== Orçamento do dia (circuit breaker de custo) =====
    const orc = await carregarOrcamento(supabase, dia);
    if (Number(orc.gasto_reais) >= Number(orc.teto_reais)) {
      return json({ ok: true, skipped: 'orcamento_esgotado', gasto: orc.gasto_reais, teto: orc.teto_reais });
    }

    const metaDiaPadrao = Math.max(1, Number(cfg?.preventivo_msgs_dia ?? 3));
    const intMin = Math.max(60, Number(cfg?.recuperacao_intervalo_min_seg ?? 1200));
    const intMax = Math.max(intMin, Number(cfg?.recuperacao_intervalo_max_seg ?? 2400));
    const maxPorDestino = Math.max(1, Number(cfg?.recuperacao_max_por_destino_dia ?? 2));

    const { data: insts } = await supabase
      .from('meta_whatsapp_instances')
      .select('id, nome, display_phone, phone_number_id, access_token, waba_id, saude_quality, estado_pool, pausa_automatica_ate, quarentena_ate, recuperacao_ativa, recuperacao_proximo_envio_em, ativo, provider')
      .eq('ativo', true)
      .eq('provider', 'meta')
      .eq('aquecimento_meta_ativo', true);

    const elegiveis = (insts || []).filter((i: any) => {
      if (i.recuperacao_ativa === true) return false; // cuidado por meta-recuperacao-tick
      if (i.estado_pool && i.estado_pool !== 'ativo') return false;
      if (i.pausa_automatica_ate && new Date(i.pausa_automatica_ate) > new Date()) return false;
      if (i.quarentena_ate && new Date(i.quarentena_ate) > new Date()) return false;
      const q = String(i.saude_quality || 'UNKNOWN').toUpperCase();
      if (q === 'RED' || q === 'YELLOW') return false;
      if (!i.phone_number_id || !i.access_token) return false;
      return true;
    });

    if ((insts || []).length === 0) return json({ ok: true, skipped: 'nenhuma_selecionada' });
    if (elegiveis.length === 0) return json({ ok: true, skipped: 'nenhuma_elegivel' });

    const destinos = await destinosAquecimento(supabase);

    // Trilha planejada do dia
    const { data: trilhas } = await supabase
      .from('meta_aquecimento_trilha')
      .select('instancia_id, alvo_unicos_dia, mix_uazapi_pct, status')
      .eq('dia', dia);
    const trilhaMap = new Map<string, any>();
    (trilhas || []).forEach((t: any) => trilhaMap.set(t.instancia_id, t));

    // Log do dia (destinos já usados)
    const { data: logsHoje } = await supabase
      .from('meta_aquecimento_destino_log')
      .select('instancia_id, destino_instancia_id, destino_telefone, fonte, status, enviado_em')
      .eq('dia', dia)
      .limit(10000);

    const usoDestinoUazapi = new Map<string, number>();
    (logsHoje || []).forEach((l: any) => {
      if (l.status === 'falha' || l.fonte !== 'uazapi' || !l.destino_instancia_id) return;
      usoDestinoUazapi.set(l.destino_instancia_id, (usoDestinoUazapi.get(l.destino_instancia_id) || 0) + 1);
    });

    let leadsDisponiveis = await leadsParaAquecimento(supabase, 60);

    const resultados: any[] = [];
    let processadas = 0;
    let gastoRun = 0;

    for (const inst of elegiveis as any[]) {
      if (processadas >= MAX_POR_RUN) break;
      if (Number(orc.gasto_reais) + gastoRun >= Number(orc.teto_reais)) {
        resultados.push({ instancia: inst.nome, skipped: 'orcamento_esgotado' });
        break;
      }
      if (!forcar && inst.recuperacao_proximo_envio_em &&
          new Date(inst.recuperacao_proximo_envio_em) > new Date()) continue;

      const trilha = trilhaMap.get(inst.id);
      if (trilha && trilha.status !== 'ativa') continue;
      const alvoDia = Math.max(1, Number(trilha?.alvo_unicos_dia ?? metaDiaPadrao));
      const mixUazapi = Math.max(0, Math.min(100, Number(trilha?.mix_uazapi_pct ?? 100)));

      const meus = (logsHoje || []).filter(
        (l: any) => l.instancia_id === inst.id && l.status !== 'falha',
      );
      if (meus.length >= alvoDia) continue;

      const ultimo = meus
        .sort((a: any, b: any) => new Date(b.enviado_em).getTime() - new Date(a.enviado_em).getTime())[0];

      // ===== Escolha da fonte respeitando o mix planejado =====
      const feitosUazapi = meus.filter((l: any) => l.fonte === 'uazapi').length;
      const pctUazapiAtual = meus.length > 0 ? (feitosUazapi / meus.length) * 100 : 0;
      const querUazapi = meus.length === 0 ? mixUazapi > 0 : pctUazapiAtual < mixUazapi;

      const destinosUazapiOk = destinos.filter((d) =>
        (usoDestinoUazapi.get(d.id) || 0) < maxPorDestino && d.id !== ultimo?.destino_instancia_id
      );

      let fonte: 'uazapi' | 'lead' | null = null;
      if (querUazapi && destinosUazapiOk.length > 0) fonte = 'uazapi';
      else if (mixUazapi < 100 && leadsDisponiveis.length > 0) fonte = 'lead';
      else if (destinosUazapiOk.length > 0) fonte = 'uazapi';
      else if (leadsDisponiveis.length > 0) fonte = 'lead';

      if (!fonte) {
        resultados.push({ instancia: inst.nome, skipped: 'sem_destino_disponivel' });
        continue;
      }

      const tpl = await escolherTemplateAprovado(inst, cfg?.aquecimento_template_utility);
      if (!tpl) {
        resultados.push({ instancia: inst.nome, erro: 'sem_template_aprovado' });
        continue;
      }
      const custo = custoDoTemplate(orc, tpl.categoria);
      if (Number(orc.gasto_reais) + gastoRun + custo > Number(orc.teto_reais)) {
        resultados.push({ instancia: inst.nome, skipped: 'orcamento_esgotado' });
        break;
      }

      let telefone = '';
      let nomeDestino: string | null = null;
      let destinoInstanciaId: string | null = null;
      let leadId: string | null = null;
      let nicho: string | null = null;
      let cidade: string | null = null;

      if (fonte === 'uazapi') {
        const d = destinosUazapiOk[Math.floor(Math.random() * destinosUazapiOk.length)];
        telefone = d.telefone;
        nomeDestino = d.nome;
        destinoInstanciaId = d.id;
      } else {
        const lead = leadsDisponiveis.shift()!;
        telefone = lead.telefone;
        nomeDestino = lead.nome;
        leadId = lead.id;
        nicho = lead.nicho;
        cidade = lead.cidade;
      }

      const envio = await enviarTemplateAquecimento(inst, telefone, tpl, nomeDestino);

      await supabase.from('meta_aquecimento_destino_log').insert({
        dia,
        instancia_id: inst.id,
        fonte,
        destino_telefone: telefone,
        destino_instancia_id: destinoInstanciaId,
        lead_id: leadId,
        nicho,
        cidade,
        template: tpl.name,
        custo_estimado: envio.ok ? custo : 0,
        wamid: envio.wamid || null,
        status: envio.ok ? 'enviado' : 'falha',
        erro: envio.ok ? null : envio.erro,
      });

      // Compatibilidade com o painel de recuperação/preventivo já existente.
      if (fonte === 'uazapi') {
        await supabase.from('meta_recuperacao_log').insert({
          instancia_id: inst.id,
          destino_instancia_id: destinoInstanciaId,
          destino_telefone: telefone,
          tipo: `preventivo:${tpl.name}`,
          status: envio.ok ? 'enviado' : 'falha',
          erro: envio.ok ? null : envio.erro,
          wamid: envio.wamid || null,
          dia,
        });
      }

      if (leadId) {
        await marcarLeadUsado(supabase, leadId, envio.ok ? 'enviado' : `falha: ${String(envio.erro || '').slice(0, 120)}`);
      }

      if (envio.ok) {
        gastoRun += custo;
        (logsHoje as any[]).push({
          instancia_id: inst.id, fonte, destino_instancia_id: destinoInstanciaId,
          destino_telefone: telefone, status: 'enviado', enviado_em: new Date().toISOString(),
        });
        if (destinoInstanciaId) {
          usoDestinoUazapi.set(destinoInstanciaId, (usoDestinoUazapi.get(destinoInstanciaId) || 0) + 1);
        }
      }

      await supabase.from('meta_whatsapp_instances').update({
        recuperacao_ultimo_envio_em: new Date().toISOString(),
        recuperacao_proximo_envio_em: new Date(Date.now() + sorteio(intMin, intMax) * 1000).toISOString(),
      }).eq('id', inst.id);

      if (!envio.ok && erroFatalMeta(envio.codigo, envio.erro)) {
        console.log('[aquecimento] erro fatal, parando ciclo:', envio.erro);
        resultados.push({ instancia: inst.nome, ok: false, erro: envio.erro, parado: true });
        break;
      }

      processadas++;
      resultados.push({
        instancia: inst.nome || inst.display_phone,
        fonte,
        destino: nomeDestino || telefone,
        nicho,
        template: tpl.name,
        custo: envio.ok ? custo : 0,
        ok: envio.ok,
        erro: envio.erro || null,
      });
    }

    if (gastoRun > 0) await registrarGasto(supabase, dia, gastoRun);

    return json({ ok: true, total: resultados.length, gasto_run: gastoRun, resultados });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : 'erro' }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

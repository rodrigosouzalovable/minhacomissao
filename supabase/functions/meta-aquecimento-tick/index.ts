// Aquecimento dos números Meta saudáveis (cron a cada 10 min).
// Cada número segue a trilha planejada por meta-aquecimento-planejar: um alvo
// diário de destinatários ÚNICOS, distribuído entre os números UAZAPI da pasta
// AQUECIMENTO (respondidos pelo IAGO) e leads reais do Google Maps de nichos
// que respondem bem. Tudo limitado pelo orçamento diário em reais.
//
// Modo intensivo (números de nova BM): envia em lotes por rodada para alcançar
// o alvo do dia (ex.: 450 únicos/dia → ~1.300 em 3 dias), sempre em UTILITY.
// A recuperação de números YELLOW/RED continua em meta-recuperacao-tick.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  dentroJanelaAquecimento,
  destinosAquecimento,
  enviarTemplateAquecimento,
  erroFatalMeta,
  escolherTemplateAprovado,
  escolherTemplateLead,
  hojeBrt,
  renderTemplateBody,
  sorteio,
} from '../_shared/meta-aquecimento-alvo.ts';
import {
  carregarOrcamento,
  proximoTier,
  tierAtual,
  custoDoTemplate,
  devolverLead,
  leadsParaAquecimento,
  marcarLeadUsado,
  pausarInstanciasDaBm,
  recalcularScoreNichos,
  registrarConversaLead,
  registrarGasto,
  taxaRespostaRecenteLeads,
} from '../_shared/meta-aquecimento-inteligente.ts';
import { notificarNumeros } from '../_shared/notificar-numeros.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DESTINATARIOS_AVISO = ['62991672674'];
/** Teto de envios em uma única rodada (todas as instâncias somadas). */
const MAX_ENVIOS_POR_RUN = 80;
/** Teto de envios por instância em uma única rodada. */
const MAX_POR_INSTANCIA_RUN = 15;
/** Taxa mínima de resposta dos leads na última meia hora antes de corrigir a rota. */
const TAXA_MINIMA_LEADS = 0.15;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
      .select('id, user_id, nome, display_phone, phone_number_id, access_token, waba_id, meta_bm_id, saude_quality, estado_pool, pausa_automatica_ate, quarentena_ate, recuperacao_ativa, recuperacao_proximo_envio_em, ativo, provider')
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

    // ===== Aprendizado intradiário: refaz o placar de nichos a cada ~3h =====
    const { data: scoreRecente } = await supabase
      .from('aquecimento_nicho_score')
      .select('atualizado_em')
      .order('atualizado_em', { ascending: false })
      .limit(1)
      .maybeSingle();
    const idadeScoreH = scoreRecente?.atualizado_em
      ? (Date.now() - new Date(scoreRecente.atualizado_em).getTime()) / 3600000
      : 99;
    if (idadeScoreH >= 3) {
      try { await recalcularScoreNichos(supabase); } catch (_) { /* segue */ }
    }

    // ===== Correção de rota: leads não estão respondendo? =====
    const recente = await taxaRespostaRecenteLeads(supabase, 30);
    const corrigirRota = recente.envios >= 10 && recente.taxa < TAXA_MINIMA_LEADS;

    const destinos = await destinosAquecimento(supabase);

    // Trilha planejada do dia
    const { data: trilhas } = await supabase
      .from('meta_aquecimento_trilha')
      .select('instancia_id, alvo_unicos_dia, mix_uazapi_pct, mix_leads_pct, status, motivo, modo_intensivo')
      .eq('dia', dia);
    const trilhaMap = new Map<string, any>();
    (trilhas || []).forEach((t: any) => trilhaMap.set(t.instancia_id, t));

    // Número novo (ou template aprovado agora) sem plano do dia: cria a trilha na
    // hora, para começar a aquecer sem esperar o planejamento da manhã seguinte.
    const semTrilha = (elegiveis as any[]).filter((i: any) => !trilhaMap.get(i.id));
    if (semTrilha.length > 0) {
      const novas = semTrilha.map((i: any) => {
        const tier = tierAtual(i);
        const intensivo = tier < 10000;
        const alvo = intensivo
          ? Math.max(5, Math.min(450, Math.round(tier * 0.6)))
          : Math.max(5, metaDiaPadrao);
        return {
          instancia_id: i.id,
          dia,
          tier_atual: tier,
          tier_alvo: proximoTier(tier),
          alvo_unicos_dia: alvo,
          modo_intensivo: intensivo,
          mix_uazapi_pct: intensivo ? 25 : 80,
          mix_leads_pct: intensivo ? 75 : 20,
          status: 'ativa',
          decisao_ia: { fonte: 'tick_automatico' },
          atualizado_em: new Date().toISOString(),
        };
      });
      await supabase.from('meta_aquecimento_trilha').upsert(novas, { onConflict: 'instancia_id,dia' });
      novas.forEach((t: any) => trilhaMap.set(t.instancia_id, t));
    }

    // Log do dia (destinos já usados)
    const { data: logsHoje } = await supabase
      .from('meta_aquecimento_destino_log')
      .select('instancia_id, destino_instancia_id, destino_telefone, fonte, status, enviado_em')
      .eq('dia', dia)
      .limit(20000);

    const usoDestinoUazapi = new Map<string, number>();
    (logsHoje || []).forEach((l: any) => {
      if (l.status === 'falha' || l.fonte !== 'uazapi' || !l.destino_instancia_id) return;
      usoDestinoUazapi.set(l.destino_instancia_id, (usoDestinoUazapi.get(l.destino_instancia_id) || 0) + 1);
    });

    // Estoque de leads dimensionado pelo alvo do dia (modo intensivo pede mais).
    const alvoTotalDia = (elegiveis as any[]).reduce(
      (s, i) => s + Math.max(1, Number(trilhaMap.get(i.id)?.alvo_unicos_dia ?? metaDiaPadrao)), 0,
    );
    const limiteLeads = Math.min(600, Math.max(60, Math.ceil(alvoTotalDia / 2)));
    let leadsDisponiveis = await leadsParaAquecimento(supabase, limiteLeads);

    // Estoque baixo de contatos do Google Maps: pede reabastecimento.
    if (leadsDisponiveis.length < Math.min(40, limiteLeads)) {
      try {
        await supabase.functions.invoke('google-maps-leads-abastecer', { body: { dia } });
        leadsDisponiveis = await leadsParaAquecimento(supabase, limiteLeads);
      } catch (err) {
        console.log('[aquecimento] abastecer falhou:', String(err).slice(0, 200));
      }
    }

    // Rodadas restantes na janela do dia (para dimensionar o lote da rodada).
    const spNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const horaAtual = spNow.getHours() + spNow.getMinutes() / 60;
    const rodadasRestantes = Math.max(1, Math.ceil(((Math.min(19, hFim) - horaAtual) * 60) / 10));

    const resultados: any[] = [];
    const bmsPausadas = new Set<string>();
    let enviosRun = 0;
    let gastoRun = 0;

    // Números em resgate de campanha (resposta baixa) vão na frente da fila.
    const ordenadas = (elegiveis as any[]).slice().sort((a, b) => {
      const ra = trilhaMap.get(a.id)?.motivo === 'resgate_campanha' ? 1 : 0;
      const rb = trilhaMap.get(b.id)?.motivo === 'resgate_campanha' ? 1 : 0;
      return rb - ra;
    });

    for (const inst of ordenadas) {
      if (enviosRun >= MAX_ENVIOS_POR_RUN) break;
      if (Number(orc.gasto_reais) + gastoRun >= Number(orc.teto_reais)) {
        resultados.push({ instancia: inst.nome, skipped: 'orcamento_esgotado' });
        break;
      }

      const trilha = trilhaMap.get(inst.id);
      if (trilha && trilha.status !== 'ativa') continue;
      const intensivo = trilha?.modo_intensivo === true;

      if (!forcar && !intensivo && inst.recuperacao_proximo_envio_em &&
          new Date(inst.recuperacao_proximo_envio_em) > new Date()) continue;

      const alvoDia = Math.max(1, Number(trilha?.alvo_unicos_dia ?? metaDiaPadrao));
      const mixLeadsPlan = trilha?.mix_leads_pct != null
        ? Math.max(0, Math.min(100, Number(trilha.mix_leads_pct)))
        : null;
      let mixUazapi = mixLeadsPlan != null
        ? 100 - mixLeadsPlan
        : Math.max(0, Math.min(100, Number(trilha?.mix_uazapi_pct ?? 100)));
      // Ninguém respondendo: volta para os destinos que respondem garantido.
      if (corrigirRota) mixUazapi = Math.max(mixUazapi, 70);

      const feitos = (logsHoje || []).filter(
        (l: any) => l.instancia_id === inst.id && l.status !== 'falha',
      );
      const faltam = alvoDia - feitos.length;
      if (faltam <= 0) continue;

      const loteInstancia = Math.max(
        1,
        Math.min(
          MAX_POR_INSTANCIA_RUN,
          MAX_ENVIOS_POR_RUN - enviosRun,
          intensivo ? Math.ceil(faltam / rodadasRestantes) : 1,
        ),
      );

      let paradaFatal = false;

      for (let n = 0; n < loteInstancia; n++) {
        if (enviosRun >= MAX_ENVIOS_POR_RUN) break;
        if (Number(orc.gasto_reais) + gastoRun >= Number(orc.teto_reais)) break;

        const meus = (logsHoje || []).filter(
          (l: any) => l.instancia_id === inst.id && l.status !== 'falha',
        );
        if (meus.length >= alvoDia) break;

        const ultimo = meus
          .slice()
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
          break;
        }

        // Leads do Google Maps usam apenas templates UTILITY marcados como
        // "usar em leads"; sem template elegível, o envio ao lead é pulado.
        const tpl = fonte === 'lead'
          ? await escolherTemplateLead(supabase, inst)
          : await escolherTemplateAprovado(inst, cfg?.aquecimento_template_utility);
        if (!tpl) {
          resultados.push({
            instancia: inst.nome,
            erro: fonte === 'lead' ? 'sem_template_lead' : 'sem_template_aprovado',
          });
          break;
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
          // Falha não gasta o lead: ele volta para a fila.
          if (envio.ok) await marcarLeadUsado(supabase, leadId, 'enviado');
          else await devolverLead(supabase, leadId);
        }

        // Conversa do lead fica na caixa AQUECIMENTO, com a mensagem real enviada.
        if (fonte === 'lead' && envio.ok) {
          await registrarConversaLead(
            supabase, inst, telefone, nomeDestino, tpl.name, envio.wamid,
            renderTemplateBody(tpl, nomeDestino),
          );
        }

        if (envio.ok) {
          enviosRun++;
          gastoRun += custo;
          (logsHoje as any[]).push({
            instancia_id: inst.id, fonte, destino_instancia_id: destinoInstanciaId,
            destino_telefone: telefone, status: 'enviado', enviado_em: new Date().toISOString(),
          });
          if (destinoInstanciaId) {
            usoDestinoUazapi.set(destinoInstanciaId, (usoDestinoUazapi.get(destinoInstanciaId) || 0) + 1);
          }
        }

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

        if (!envio.ok && erroFatalMeta(envio.codigo, envio.erro)) {
          // BM bloqueada / pendência: tira todos os números dessa BM do aquecimento.
          const info = await pausarInstanciasDaBm(
            supabase, inst, String(envio.erro || 'erro fatal da Meta').slice(0, 200), 12,
          );
          if (!bmsPausadas.has(info.bm)) {
            bmsPausadas.add(info.bm);
            try {
              await notificarNumeros(supabase, {
                tipo: 'aquecimento_bm_bloqueada',
                destinatarios: DESTINATARIOS_AVISO,
                chaveIdempotencia: `bm-bloqueada:${info.bm}:${dia}`,
                mensagem:
                  `🛑 *Aquecimento pausado por bloqueio da Meta*\n\n` +
                  `BM: *${info.bm}*\n` +
                  `Números pausados: *${info.pausadas}*\n` +
                  `Erro: ${String(envio.erro || '').slice(0, 160)}\n\n` +
                  `Nenhuma mensagem chega enquanto a BM estiver bloqueada. ` +
                  `Assim que ela for liberada, o aquecimento volta sozinho.`,
              });
            } catch (_) { /* aviso é best-effort */ }
          }
          console.log('[aquecimento] erro fatal, pausando BM:', info.bm, envio.erro);
          paradaFatal = true;
          break;
        }

        // Intervalo curto e aleatório entre mensagens do mesmo número.
        if (n + 1 < loteInstancia) await sleep(sorteio(2, 6) * 1000);
      }

      // Próximo envio: intensivo mantém ritmo alto; o restante segue o intervalo antigo.
      const proximo = intensivo
        ? new Date(Date.now() + sorteio(60, 180) * 1000)
        : new Date(Date.now() + sorteio(intMin, intMax) * 1000);
      await supabase.from('meta_whatsapp_instances').update({
        recuperacao_ultimo_envio_em: new Date().toISOString(),
        recuperacao_proximo_envio_em: proximo.toISOString(),
      }).eq('id', inst.id);

      if (paradaFatal) continue;
    }

    if (gastoRun > 0) await registrarGasto(supabase, dia, gastoRun);

    return json({
      ok: true,
      envios: enviosRun,
      gasto_run: gastoRun,
      corrigindo_rota: corrigirRota,
      taxa_resposta_30min: Math.round(recente.taxa * 100),
      resultados,
    });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : 'erro' }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

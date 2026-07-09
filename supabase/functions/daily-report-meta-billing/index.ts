// Relatório diário de custo Meta WhatsApp enviado no WhatsApp do admin.
// Roda via pg_cron às 08:30 BRT. Sincroniza billing primeiro (meta-billing-sync)
// e depois lê meta_billing_snapshot + envios_log para montar o resumo.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.88.0';
import { notificarAdmin } from '../_shared/notificar-admin.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const usd = (v: number) => v.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    // Config
    const { data: cfg } = await supabase
      .from('meta_billing_relatorio_config')
      .select('*')
      .eq('id', 1)
      .maybeSingle();

    if (cfg && cfg.ativo === false) {
      return new Response(JSON.stringify({ success: false, skipped: 'desativado' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Sincroniza billing (best-effort — se falhar, seguimos com o que já está no snapshot)
    try {
      await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/meta-billing-sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({ days: 35 }),
      });
    } catch (e) {
      console.warn('[daily-report-meta-billing] sync falhou, prosseguindo', e);
    }

    // Datas em BRT
    const nowBRT = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const ontem = new Date(nowBRT); ontem.setDate(ontem.getDate() - 1);
    const ontemStr = ontem.toISOString().slice(0, 10);
    const mesAno = `${nowBRT.getFullYear()}-${String(nowBRT.getMonth() + 1).padStart(2, '0')}`;
    const inicioMes = `${mesAno}-01`;
    const diaAtual = nowBRT.getDate();
    const diasNoMes = new Date(nowBRT.getFullYear(), nowBRT.getMonth() + 1, 0).getDate();

    // Snapshot de ontem
    const { data: snapOntem } = await supabase
      .from('meta_billing_snapshot')
      .select('conversation_category, conversations_count, cost_usd, cost_brl')
      .eq('dia', ontemStr);

    const agrup = { MARKETING: { qtd: 0, brl: 0, usd: 0 }, UTILITY: { qtd: 0, brl: 0, usd: 0 }, AUTHENTICATION: { qtd: 0, brl: 0, usd: 0 }, SERVICE: { qtd: 0, brl: 0, usd: 0 } } as Record<string, { qtd: number; brl: number; usd: number }>;
    let totalOntemBrl = 0, totalOntemUsd = 0;
    for (const r of snapOntem || []) {
      const cat = String(r.conversation_category || '').toUpperCase();
      const bucket = agrup[cat] || (agrup[cat] = { qtd: 0, brl: 0, usd: 0 });
      bucket.qtd += Number(r.conversations_count || 0);
      bucket.brl += Number(r.cost_brl || 0);
      bucket.usd += Number(r.cost_usd || 0);
      totalOntemBrl += Number(r.cost_brl || 0);
      totalOntemUsd += Number(r.cost_usd || 0);
    }

    // Snapshot do mês
    const { data: snapMes } = await supabase
      .from('meta_billing_snapshot')
      .select('cost_brl, dia')
      .gte('dia', inicioMes)
      .lte('dia', nowBRT.toISOString().slice(0, 10));
    let totalMesBrl = 0;
    const diasComGasto = new Set<string>();
    for (const r of snapMes || []) {
      totalMesBrl += Number(r.cost_brl || 0);
      diasComGasto.add(r.dia);
    }
    const mediaDia = diasComGasto.size > 0 ? totalMesBrl / diasComGasto.size : 0;
    const projecao = mediaDia * diasNoMes;

    // Grátis (CSW) — via envios_log (pricing capturado do webhook)
    const inicioOntemIso = `${ontemStr}T00:00:00-03:00`;
    const fimOntemIso = `${ontemStr}T23:59:59-03:00`;
    const { count: qtdGratis } = await supabase
      .from('meta_whatsapp_envios_log')
      .select('id', { count: 'exact', head: true })
      .gte('enviado_em', inicioOntemIso)
      .lte('enviado_em', fimOntemIso)
      .eq('foi_gratis', true);

    // Top templates ontem (por volume)
    let topLinha = '';
    if (cfg?.incluir_top_templates !== false) {
      const { data: envios } = await supabase
        .from('meta_whatsapp_envios_log')
        .select('template_nome, pricing_category, foi_gratis')
        .gte('enviado_em', inicioOntemIso)
        .lte('enviado_em', fimOntemIso)
        .eq('status', 'sent')
        .limit(50000);
      const contagem = new Map<string, { qtd: number; cat: string; gratis: number }>();
      for (const e of envios || []) {
        if (!e.template_nome) continue;
        const cur = contagem.get(e.template_nome) || { qtd: 0, cat: '', gratis: 0 };
        cur.qtd++;
        if (!cur.cat && e.pricing_category) cur.cat = String(e.pricing_category).toUpperCase();
        if (e.foi_gratis) cur.gratis++;
        contagem.set(e.template_nome, cur);
      }
      const top = [...contagem.entries()].sort((a, b) => b[1].qtd - a[1].qtd).slice(0, 3);
      if (top.length) {
        topLinha = '\n📋 *Templates mais enviados ontem:*\n';
        for (const [nome, info] of top) {
          const catTag = info.cat ? ` [${info.cat === 'MARKETING' ? 'MKT' : info.cat === 'UTILITY' ? 'UTIL' : info.cat === 'AUTHENTICATION' ? 'AUTH' : info.cat}]` : '';
          topLinha += `• ${nome}${catTag} — ${info.qtd} envios${info.gratis ? ` (${info.gratis} grátis)` : ''}\n`;
        }
      }
    }

    // Meta mensal / alerta de projeção
    const { data: metaMensal } = await supabase
      .from('meta_billing_meta_mensal')
      .select('*')
      .eq('mes_ano', mesAno)
      .maybeSingle();

    let linhaMeta = '';
    let alertaMeta = '';
    if (metaMensal) {
      const limite = Number(metaMensal.limite_brl || 0);
      const pct = limite > 0 ? (totalMesBrl / limite) * 100 : 0;
      const pctProj = limite > 0 ? (projecao / limite) * 100 : 0;
      linhaMeta = `\n🎯 Meta do mês: ${brl(limite)} — usado ${pct.toFixed(0)}%\n`;
      if (pctProj > 100) alertaMeta = `⚠️ *Projeção EXCEDE a meta em ${(pctProj - 100).toFixed(0)}%*\n`;
      else if (pctProj > 80) alertaMeta = `⚠️ Projeção próxima da meta (${pctProj.toFixed(0)}%)\n`;
    }

    // Monta mensagem
    const dataFmt = ontem.toLocaleDateString('pt-BR');
    let msg = `💰 *Custo Meta WhatsApp — ${dataFmt}*\n\n`;
    msg += `*Ontem:* ${brl(totalOntemBrl)}  (${usd(totalOntemUsd)})\n`;
    if (agrup.MARKETING.qtd) msg += `  📢 Marketing: ${agrup.MARKETING.qtd} conv · ${brl(agrup.MARKETING.brl)}\n`;
    if (agrup.UTILITY.qtd) msg += `  🔧 Utility: ${agrup.UTILITY.qtd} conv · ${brl(agrup.UTILITY.brl)}\n`;
    if (agrup.AUTHENTICATION.qtd) msg += `  🔐 Auth: ${agrup.AUTHENTICATION.qtd} conv · ${brl(agrup.AUTHENTICATION.brl)}\n`;
    if (agrup.SERVICE.qtd) msg += `  💬 Service: ${agrup.SERVICE.qtd} conv · grátis\n`;
    if (qtdGratis) msg += `  ✅ Grátis (janela 24h): ${qtdGratis} envios\n`;

    msg += `\n*Mês (${mesAno}):* ${brl(totalMesBrl)} em ${diasComGasto.size} dia(s)`;
    if (cfg?.incluir_projecao !== false && mediaDia > 0) {
      msg += `\n📈 Projeção fim do mês: ${brl(projecao)}`;
    }
    if (linhaMeta) msg += linhaMeta;
    if (alertaMeta) msg += `\n${alertaMeta}`;
    if (topLinha) msg += topLinha;

    msg += `\n_Rate BR (jul/2026): UTIL/AUTH US$0,0068 · MKT US$0,0625_`;

    // Envia
    const telefone = String(cfg?.telefone_destino || '62991672674').replace(/\D/g, '');
    const chave = `meta-billing-report:${ontemStr}`;

    const r = await notificarAdmin(supabase, {
      tipo: 'custom',
      mensagem: msg,
      chaveIdempotencia: chave,
    });

    // Marca alertas de meta como enviados
    if (metaMensal) {
      const limite = Number(metaMensal.limite_brl || 0);
      if (limite > 0) {
        const pctProj = (projecao / limite) * 100;
        const patch: any = {};
        if (pctProj > 100 && !metaMensal.alerta_100pct_enviado) patch.alerta_100pct_enviado = true;
        if (pctProj > 80 && !metaMensal.alerta_80pct_enviado) patch.alerta_80pct_enviado = true;
        if (pctProj > 50 && !metaMensal.alerta_50pct_enviado) patch.alerta_50pct_enviado = true;
        if (Object.keys(patch).length) {
          await supabase.from('meta_billing_meta_mensal').update(patch).eq('id', metaMensal.id);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, telefone, totalOntemBrl, totalMesBrl, projecao, resultado: r }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[daily-report-meta-billing] erro', err);
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});

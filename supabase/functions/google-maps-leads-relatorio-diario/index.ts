// Relatório diário (20h BRT) da base de leads do Google Maps e do aquecimento com esses contatos
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.88.0";
import { notificarNumeros } from "../_shared/notificar-numeros.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DESTINATARIOS = ["62991672674"];

const count = async (q: any) => {
  const { count: c } = await q;
  return c ?? 0;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const nowBrt = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const hojeStr = nowBrt.toISOString().slice(0, 10);
    const inicioDia = `${hojeStr}T00:00:00-03:00`;
    const fimDia = `${hojeStr}T23:59:59-03:00`;
    const dataFmt = nowBrt.toLocaleDateString("pt-BR");
    const carencia = new Date(Date.now() - 15 * 86400000).toISOString();

    const L = () => supabase.from("google_maps_leads").select("id", { count: "exact", head: true });

    const [
      totalBase,
      totalTel,
      totalWa,
      capHoje,
      capHojeWa,
      usados,
      responderam,
      estoque,
      pendentesWa,
    ] = await Promise.all([
      count(L()),
      count(L().not("telefone", "is", null)),
      count(L().eq("tem_whatsapp", true)),
      count(L().gte("created_at", inicioDia).lte("created_at", fimDia)),
      count(L().gte("created_at", inicioDia).lte("created_at", fimDia).eq("tem_whatsapp", true)),
      count(L().not("usado_aquecimento_em", "is", null)),
      count(L().eq("resultado_aquecimento", "respondeu")),
      count(
        L().eq("tem_whatsapp", true).or(`usado_aquecimento_em.is.null,usado_aquecimento_em.lt.${carencia}`),
      ),
      count(L().not("telefone", "is", null).is("tem_whatsapp", null)),
    ]);

    // Captação de hoje por nicho
    const { data: leadsHoje } = await supabase
      .from("google_maps_leads")
      .select("categoria, endereco")
      .gte("created_at", inicioDia)
      .lte("created_at", fimDia)
      .limit(1000);

    const porNicho = new Map<string, number>();
    for (const l of (leadsHoje as any[]) || []) {
      const k = (l.categoria || "sem nicho").toString();
      porNicho.set(k, (porNicho.get(k) ?? 0) + 1);
    }

    // Buscas do dia (inclui reabastecimento automático)
    const { data: buscasHoje } = await supabase
      .from("google_maps_buscas")
      .select("categoria, localizacao, total_resultados, status, custo_estimado_usd")
      .gte("created_at", inicioDia)
      .lte("created_at", fimDia);
    const buscas = (buscasHoje as any[]) || [];
    const custoDia = buscas.reduce((s, b) => s + Number(b.custo_estimado_usd || 0), 0);

    // Disparos de hoje para leads do Maps
    const { data: logsLead } = await supabase
      .from("meta_aquecimento_destino_log")
      .select("instancia_id, status, respondeu_em, entregue_em, lido_em, nicho, custo_estimado, enviado_em")
      .eq("dia", hojeStr)
      .eq("fonte", "lead");
    const logs = (logsLead as any[]) || [];
    const enviadas = logs.filter((l) => l.status !== "falha").length;
    const falhas = logs.filter((l) => l.status === "falha").length;
    const entregues = logs.filter((l) => l.entregue_em).length;
    const lidas = logs.filter((l) => l.lido_em).length;
    const respostas = logs.filter((l) => l.respondeu_em).length;
    const taxa = enviadas > 0 ? (respostas / enviadas) * 100 : 0;

    // ===== Gasto do dia com mensagens para leads do Maps =====
    const gastoLeads = logs
      .filter((l) => l.status !== "falha")
      .reduce((s, l) => s + Number(l.custo_estimado || 0), 0);
    const gastoPorInstancia = new Map<string, { brl: number; qtd: number }>();
    for (const lg of logs) {
      if (lg.status === "falha" || !lg.instancia_id) continue;
      const cur = gastoPorInstancia.get(lg.instancia_id) || { brl: 0, qtd: 0 };
      cur.brl += Number(lg.custo_estimado || 0);
      cur.qtd += 1;
      gastoPorInstancia.set(lg.instancia_id, cur);
    }
    const custoPorResposta = respostas > 0 ? gastoLeads / respostas : 0;

    const { data: orcHoje } = await supabase
      .from("meta_aquecimento_orcamento")
      .select("teto_reais, gasto_reais")
      .eq("dia", hojeStr)
      .maybeSingle();
    const teto = Number(orcHoje?.teto_reais ?? 120);
    const gastoTotalDia = Number(orcHoje?.gasto_reais ?? gastoLeads);
    const restante = Math.max(0, teto - gastoTotalDia);
    // Horário do último envio antes de o teto ser atingido (se atingiu)
    let horaTetoAtingido = "";
    if (gastoTotalDia >= teto && logs.length) {
      const ultimo = logs
        .filter((l) => l.status !== "falha" && l.enviado_em)
        .sort((a, b) => new Date(b.enviado_em).getTime() - new Date(a.enviado_em).getTime())[0];
      if (ultimo) {
        horaTetoAtingido = new Date(ultimo.enviado_em).toLocaleTimeString("pt-BR", {
          timeZone: "America/Sao_Paulo",
          hour: "2-digit",
          minute: "2-digit",
        });
      }
    }


    // Instâncias em aquecimento/resgate hoje
    const { data: trilhas } = await supabase
      .from("meta_aquecimento_trilha")
      .select("instancia_id, status, motivo, mix_leads_pct, alvo_unicos_dia, tier_atual, tier_alvo")
      .eq("dia", hojeStr);
    const listaTrilhas = (trilhas as any[]) || [];

    const nomeMap = new Map<string, string>();
    const idsInstancias = [
      ...new Set([...listaTrilhas.map((t) => t.instancia_id), ...gastoPorInstancia.keys()].filter(Boolean)),
    ];
    if (idsInstancias.length) {
      const { data: insts } = await supabase
        .from("meta_whatsapp_instances")
        .select("id, nome, display_phone")
        .in("id", idsInstancias);
      for (const i of (insts as any[]) || []) {
        nomeMap.set(i.id, i.nome || i.display_phone || String(i.id).slice(0, 8));
      }
    }


    // Ranking de nichos
    const { data: scores } = await supabase
      .from("aquecimento_nicho_score")
      .select("nicho, cidade, envios, respostas, score, bloqueado")
      .order("score", { ascending: false })
      .limit(200);
    const listaScores = (scores as any[]) || [];
    const melhores = listaScores.filter((s) => !s.bloqueado && (s.envios ?? 0) > 0).slice(0, 5);
    const bloqueados = listaScores.filter((s) => s.bloqueado);

    // ===== Diagnóstico =====
    const diagnostico: string[] = [];
    if (listaTrilhas.length === 0) {
      diagnostico.push("nenhum número marcado para aquecimento/resgate hoje");
    } else if (enviadas === 0) {
      diagnostico.push("números em aquecimento, mas nenhum disparo saiu hoje");
    }
    if (estoque < 80) diagnostico.push(`lista curta: só ${estoque} contatos disponíveis (o reabastecimento deve entrar)`);
    if (buscas.length === 0) diagnostico.push("nenhuma nova busca de empresas foi feita hoje");
    if (pendentesWa > 0)
      diagnostico.push(
        `${pendentesWa} telefone(s) ainda sem verificação de WhatsApp (se continuar assim, confira se há número UAZAPI conectado)`,
      );

    // ===== Mensagem =====
    const l: string[] = [];
    l.push(`🗺️ *Relatório diário — Google Maps Leads* — ${dataFmt}`);
    l.push("");
    l.push("*📥 Captação de hoje*");
    l.push(`• ${capHoje} empresas novas (${capHojeWa} já com WhatsApp confirmado)`);
    if (porNicho.size > 0) {
      const top = [...porNicho.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
      for (const [nicho, qtd] of top) l.push(`   – ${nicho}: ${qtd}`);
    }
    l.push(`• ${buscas.length} busca(s) no Google hoje · custo ~US$ ${custoDia.toFixed(2)}`);

    l.push("");
    l.push("*📇 Base acumulada*");
    l.push(`• ${totalBase} empresas · ${totalTel} com telefone · ${totalWa} com WhatsApp`);
    l.push(`• ${usados} já usadas no aquecimento · ${responderam} responderam`);
    l.push(`• ${estoque} contatos prontos para usar agora`);
    l.push(`• ${pendentesWa} telefone(s) aguardando verificação de WhatsApp`);

    l.push("");
    l.push("*🔥 Aquecimento com esses contatos (hoje)*");
    if (enviadas === 0 && falhas === 0) {
      l.push("_Nenhuma mensagem enviada para contatos do Maps hoje._");
    } else {
      l.push(`• ${enviadas} mensagens enviadas · ${entregues} entregues · ${lidas} lidas`);
      l.push(`• ${respostas} respostas (${taxa.toFixed(1)}% de resposta)${falhas ? ` · ${falhas} falha(s)` : ""}`);
    }

    l.push("");
    l.push("*💰 Gasto de hoje com os contatos do Maps*");
    l.push(`• Mensagens para leads: ${brl(gastoLeads)}`);
    if (respostas > 0) l.push(`• Custo por resposta: ${brl(custoPorResposta)}`);
    if (gastoPorInstancia.size > 0) {
      const ordenado = [...gastoPorInstancia.entries()].sort((a, b) => b[1].brl - a[1].brl).slice(0, 10);
      for (const [instId, info] of ordenado) {
        const nome = nomeMap.get(instId) || String(instId).slice(0, 8);
        l.push(`   – ${nome}: ${brl(info.brl)} (${info.qtd} msg)`);
      }
    }
    l.push(`• Teto do dia: ${brl(teto)} · gasto total ${brl(gastoTotalDia)} · restam ${brl(restante)}`);
    if (horaTetoAtingido) l.push(`⛔ Teto atingido às ${horaTetoAtingido} — envios retomam amanhã.`);
    l.push(`• Buscas no Google (separado): ~US$ ${custoDia.toFixed(2)}`);


    if (listaTrilhas.length > 0) {
      l.push("");
      l.push("*📱 Números em aquecimento*");
      for (const t of listaTrilhas.slice(0, 15)) {
        const nome = nomeMap.get(t.instancia_id) || String(t.instancia_id).slice(0, 8);
        const situacao = t.status === "ativa" ? "ativo" : t.status;
        const resgate = t.motivo === "resgate_campanha" ? " · resgate de campanha" : "";
        l.push(`• *${nome}* — ${situacao}${resgate} · ${t.mix_leads_pct ?? 0}% Maps · meta ${t.alvo_unicos_dia ?? 0}/dia`);
        if (t.tier_atual || t.tier_alvo) l.push(`   tier ${t.tier_atual ?? "?"} ➜ ${t.tier_alvo ?? "?"}`);
      }
    }

    if (melhores.length > 0) {
      l.push("");
      l.push("*🏆 Melhores nichos*");
      for (const m of melhores) {
        const tx = (m.envios ?? 0) > 0 ? ((m.respostas ?? 0) / m.envios) * 100 : 0;
        l.push(`• ${m.nicho}${m.cidade ? ` (${m.cidade})` : ""} — ${tx.toFixed(0)}% resposta em ${m.envios} envios`);
      }
    }
    if (bloqueados.length > 0) {
      l.push(`🚫 Nichos bloqueados: ${bloqueados.slice(0, 6).map((b) => b.nicho).join(", ")}`);
    }

    l.push("");
    if (diagnostico.length === 0) {
      l.push("✅ *Situação:* funcionando normalmente.");
    } else {
      l.push(`⚠️ *Atenção:* ${diagnostico.join("; ")}.`);
    }

    const mensagem = l.join("\n");

    const result = await notificarNumeros(supabase, {
      tipo: "google_maps_leads_relatorio",
      mensagem,
      destinatarios: DESTINATARIOS,
      chaveIdempotencia: `gm-leads-diario-${hojeStr}`,
    });

    return new Response(JSON.stringify({ ok: true, ...result, capHoje, enviadas, respostas, estoque }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

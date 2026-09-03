// Relatório diário de aquecimento Meta - enviado às 12h e 18h BRT
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.88.0";
import { notificarNumeros } from "../_shared/notificar-numeros.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DESTINATARIOS = ["62991672674", "62994300880"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const nowBrt = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const hojeStr = nowBrt.toISOString().slice(0, 10);
    const horaLabel = `${String(nowBrt.getHours()).padStart(2, "0")}h`;

    // Config
    const { data: cfg } = await supabase
      .from("meta_envio_pool_config")
      .select("*")
      .eq("id", 1)
      .maybeSingle();

    // Instâncias — somente números oficiais (provider meta) e que NÃO são de parceiros
    const { data: parceirosRows } = await supabase
      .from("meta_instance_parceiros")
      .select("instancia_id");
    const idsParceiros = new Set<string>((parceirosRows || []).map((p: any) => p.instancia_id));

    const { data: instsRaw } = await supabase
      .from("meta_whatsapp_instances")
      .select("id, nome, display_phone, saude_quality, saude_status, saude_ban_info, estado_pool, pausa_automatica_ate, data_ativacao_api, ativo")
      .eq("ativo", true)
      .eq("provider", "meta");
    const insts = (instsRaw || []).filter((i: any) => !idsParceiros.has(i.id));

    // Pares (últimas 24h)
    const desde24h = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { data: pares } = await supabase
      .from("meta_aquecimento_pares")
      .select("emissor_id, receptor_id, trocas_hoje, trocas_total, ultima_troca_em, ultimo_reset")
      .gte("ultima_troca_em", desde24h);

    // Métricas do dia
    const { data: metricas } = await supabase
      .from("meta_instance_daily_metrics")
      .select("instancia_id, enviadas, entregues, lidas, falharam, bloqueadas, inbound")
      .eq("data", hojeStr);

    const nomeMap = new Map<string, string>();
    (insts || []).forEach((i: any) => nomeMap.set(i.id, i.nome || i.display_phone || i.id.slice(0, 8)));

    const metricasMap = new Map<string, any>();
    (metricas || []).forEach((m: any) => metricasMap.set(m.instancia_id, m));

    // Trocas por emissor nas últimas 24h
    const enviadasPorInst: Record<string, number> = {};
    const recebidasPorInst: Record<string, number> = {};
    const matriz: Record<string, Record<string, number>> = {};
    let totalTrocas24h = 0;

    (pares || []).forEach((p: any) => {
      const troca = p.ultimo_reset === hojeStr ? (p.trocas_hoje || 0) : 1; // aproximação
      enviadasPorInst[p.emissor_id] = (enviadasPorInst[p.emissor_id] || 0) + troca;
      recebidasPorInst[p.receptor_id] = (recebidasPorInst[p.receptor_id] || 0) + troca;
      matriz[p.emissor_id] ??= {};
      matriz[p.emissor_id][p.receptor_id] = (matriz[p.emissor_id][p.receptor_id] || 0) + troca;
      totalTrocas24h += troca;
    });

    // Monta mensagem
    const linhas: string[] = [];
    linhas.push(`📊 *Relatório Aquecimento Meta* — ${horaLabel}`);
    linhas.push(`_${hojeStr}_`);
    linhas.push("");

    if (!cfg?.aquecimento_ativo) {
      linhas.push("⚠️ *Aquecimento DESATIVADO*");
    } else if (!cfg?.aquecimento_template_utility) {
      linhas.push("⚠️ *Template utility não configurado*");
    } else {
      linhas.push(`✅ Ativo • Template: \`${cfg.aquecimento_template_utility}\``);
      linhas.push(`Limite/par/dia: ${cfg.aquecimento_max_pares_dia ?? 20}`);
    }
    linhas.push("");
    linhas.push(`🔄 *Trocas últimas 24h:* ${totalTrocas24h}`);
    linhas.push("");

    // Status por instância
    linhas.push("*📱 Instâncias:*");
    for (const inst of insts || []) {
      const nome = nomeMap.get(inst.id)!;
      const q = String(inst.saude_quality || "?").toUpperCase();
      const qIcon = q === "GREEN" ? "🟢" : q === "YELLOW" ? "🟡" : q === "RED" ? "🔴" : "⚪";
      const pausada = inst.pausa_automatica_ate && new Date(inst.pausa_automatica_ate) > new Date();
      const banida = inst.saude_status && String(inst.saude_status).toUpperCase().includes("BAN");
      const estado = pausada ? " ⏸PAUSADA" : banida ? " 🚫BANIDA" : (inst.estado_pool && inst.estado_pool !== "ativo" ? ` [${inst.estado_pool}]` : "");
      const env = enviadasPorInst[inst.id] || 0;
      const rec = recebidasPorInst[inst.id] || 0;
      const met = metricasMap.get(inst.id);
      const totMet = met ? ` • enviadas dia: ${met.enviadas || 0} / inbound: ${met.inbound || 0} / falhas: ${met.falharam || 0}` : "";
      linhas.push(`${qIcon} *${nome}*${estado}`);
      linhas.push(`   Aquec 24h: enviou ${env} • recebeu ${rec}${totMet}`);
    }

    // Matriz emissor → receptor
    if (Object.keys(matriz).length > 0) {
      linhas.push("");
      linhas.push("*↔️ Quem mandou pra quem (24h):*");
      for (const emissor of Object.keys(matriz)) {
        const nEm = nomeMap.get(emissor) || emissor.slice(0, 8);
        for (const receptor of Object.keys(matriz[emissor])) {
          const nRe = nomeMap.get(receptor) || receptor.slice(0, 8);
          linhas.push(`  ${nEm} → ${nRe}: ${matriz[emissor][receptor]}x`);
        }
      }
    } else {
      linhas.push("");
      linhas.push("_Nenhuma troca registrada nas últimas 24h._");
    }

    // ===== Aquecimento de tier (novas BMs) =====
    linhas.push("");
    linhas.push("*🔥 Aquecimento de tier (novas BMs)*");
    const { data: instAqRaw } = await supabase
      .from("meta_whatsapp_instances")
      .select("id, nome, display_phone, saude_quality, saude_tier, tier_diario, estado_pool, pausa_automatica_ate")
      .eq("provider", "meta")
      .eq("ativo", true)
      .eq("aquecimento_meta_ativo", true);
    const instAq = (instAqRaw || []).filter((i: any) => !idsParceiros.has(i.id));

    if (!instAq || instAq.length === 0) {
      linhas.push("_Motor parado — nenhum número selecionado._");
    } else {
      const idsAq = instAq.map((i: any) => i.id);
      const desde7d = new Date(Date.now() - 7 * 86400000).toISOString();
      const [{ data: trilhas }, { data: logsAqDia }, { data: logsAq7d }, { data: orcAq }] = await Promise.all([
        supabase
          .from("meta_aquecimento_trilha")
          .select("instancia_id, tier_atual, tier_alvo, alvo_unicos_dia, unicos_7d, status, mix_uazapi_pct, mix_leads_pct")
          .eq("dia", hojeStr)
          .in("instancia_id", idsAq),
        supabase
          .from("meta_aquecimento_destino_log")
          .select("instancia_id, status, respondeu_em, entregue_em, lido_em, destino_telefone")
          .eq("dia", hojeStr)
          .in("instancia_id", idsAq),
        supabase
          .from("meta_aquecimento_destino_log")
          .select("instancia_id, destino_telefone, status")
          .gte("enviado_em", desde7d)
          .in("instancia_id", idsAq),
        supabase.from("meta_aquecimento_orcamento").select("*").eq("dia", hojeStr).maybeSingle(),
      ]);

      const trilhaMap = new Map<string, any>();
      (trilhas || []).forEach((t: any) => trilhaMap.set(t.instancia_id, t));

      const unicos7d = new Map<string, Set<string>>();
      for (const l of (logsAq7d || []) as any[]) {
        if (l.status === "falha") continue;
        const s = unicos7d.get(l.instancia_id) || new Set<string>();
        s.add(String(l.destino_telefone || "").replace(/\D/g, "").slice(-8));
        unicos7d.set(l.instancia_id, s);
      }

      for (const inst of instAq as any[]) {
        const nome = inst.nome || inst.display_phone || inst.id.slice(0, 8);
        const t = trilhaMap.get(inst.id);
        const meus = ((logsAqDia || []) as any[]).filter((l) => l.instancia_id === inst.id);
        const feitos = meus.filter((l) => l.status !== "falha").length;
        const entregues = meus.filter((l) => l.entregue_em).length;
        const lidas = meus.filter((l) => l.lido_em).length;
        const resp = meus.filter((l) => l.respondeu_em).length;
        const falhas = meus.filter((l) => l.status === "falha").length;
        const q = String(inst.saude_quality || "?").toUpperCase();
        const qIcon = q === "GREEN" ? "🟢" : q === "YELLOW" ? "🟡" : q === "RED" ? "🔴" : "⚪";

        linhas.push(`${qIcon} *${nome}* — ${feitos}/${t?.alvo_unicos_dia ?? "?"} hoje · únicos 7d: ${unicos7d.get(inst.id)?.size ?? 0}`);
        linhas.push(`   entregues ${entregues} · lidas ${lidas} · respostas ${resp} · falhas ${falhas}`);
        if (t) {
          linhas.push(`   tier ${Number(t.tier_atual).toLocaleString("pt-BR")} → ${Number(t.tier_alvo).toLocaleString("pt-BR")} · mix ${t.mix_uazapi_pct}% UAZAPI / ${t.mix_leads_pct}% leads`);
          const tierHoje = Number(inst.tier_diario || 0);
          if (tierHoje && tierHoje > Number(t.tier_atual)) {
            linhas.push(`   ⬆️ *tier subiu para ${tierHoje.toLocaleString("pt-BR")}/dia hoje*`);
          }
          if (t.status && t.status !== "ativa") {
            linhas.push(`   ⏸ trilha ${t.status}`);
          }
        } else {
          linhas.push("   _sem trilha planejada hoje_");
        }
        if (inst.pausa_automatica_ate && new Date(inst.pausa_automatica_ate) > new Date()) {
          linhas.push("   ⛔ número pausado automaticamente (erro da Meta)");
        }
        if (q === "YELLOW" || q === "RED") {
          linhas.push(`   ⚠️ qualidade caiu para ${q} — aquecimento reduzido`);
        }
      }

      const gasto = Number(orcAq?.gasto_reais ?? 0);
      const teto = Number(orcAq?.teto_reais ?? 50);
      linhas.push(`   💰 Gasto do dia: R$ ${gasto.toFixed(2)} / R$ ${teto.toFixed(2)}${gasto >= teto ? " ⛔ teto atingido" : ""}`);
    }

    const mensagem = linhas.join("\n");
    const chave = `aquecimento-meta-${hojeStr}-${nowBrt.getHours() < 15 ? "12h" : "18h"}`;


    const result = await notificarNumeros(supabase, {
      tipo: "aquecimento_meta_relatorio",
      mensagem,
      destinatarios: DESTINATARIOS,
      chaveIdempotencia: chave,
    });

    return new Response(JSON.stringify({ ok: true, ...result, totalTrocas24h }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

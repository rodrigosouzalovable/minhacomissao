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

    // Instâncias
    const { data: insts } = await supabase
      .from("meta_whatsapp_instances")
      .select("id, nome, display_phone, saude_quality, saude_status, saude_ban_info, estado_pool, pausa_automatica_ate, data_ativacao_api, ativo")
      .eq("ativo", true);

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

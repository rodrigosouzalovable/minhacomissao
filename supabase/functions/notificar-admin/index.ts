// Edge function pública para enviar notificações ao admin (manual ou cron)
// Tipos suportados: 'teste', 'resumo_diario', 'proxies_faltando', 'custom'
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.88.0";
import { notificarAdmin } from "../_shared/notificar-admin.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json().catch(() => ({}));
    const tipo: string = body.tipo || "teste";

    if (tipo === "teste") {
      const r = await notificarAdmin(supabase, {
        tipo: "teste",
        mensagem: `✅ Notificação de teste — ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`,
      });
      return json(r);
    }

    if (tipo === "custom") {
      const r = await notificarAdmin(supabase, {
        tipo: "custom",
        mensagem: String(body.mensagem || "(sem mensagem)"),
        chaveIdempotencia: body.chave_idempotencia,
      });
      return json(r);
    }

    if (tipo === "resumo_diario") {
      const sp = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
      const inicioDia = new Date(sp); inicioDia.setHours(0, 0, 0, 0);
      const inicioDiaIso = inicioDia.toISOString();
      const dataChave = sp.toISOString().slice(0, 10);

      // Métricas chips
      const { data: aquecInsts } = await supabase
        .from("whatsapp_aquecimento_instancias")
        .select("status, mensagens_sem_resposta, pausado_motivo");

      const totalChips = aquecInsts?.length || 0;
      const ativos = aquecInsts?.filter((a: any) => ["EM_AQUECIMENTO", "AQUECIDO"].includes(a.status)).length || 0;
      const pausados = aquecInsts?.filter((a: any) => a.status === "PAUSADO").length || 0;
      const aguardando = aquecInsts?.filter((a: any) => a.status === "AGUARDANDO_MATURACAO").length || 0;

      // Envios autosave hoje
      const { count: envHoje } = await supabase
        .from("aquecimento_envios_autosave")
        .select("id", { count: "exact", head: true })
        .eq("status", "enviado")
        .gte("enviado_em", inicioDiaIso);

      const { count: errosHoje } = await supabase
        .from("aquecimento_envios_autosave")
        .select("id", { count: "exact", head: true })
        .in("status", ["erro", "exception", "skipped_disconnected"])
        .gte("enviado_em", inicioDiaIso);

      // Eventos chip 24h (quedas)
      const corte24h = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const { count: quedas24h } = await supabase
        .from("whatsapp_chip_eventos")
        .select("id", { count: "exact", head: true })
        .eq("tipo_evento", "desconexao")
        .gte("registrado_em", corte24h);

      // Chips sem proxy ativo
      const { data: instsAtivas } = await supabase
        .from("user_whatsapp_instances")
        .select("id, nome, proxy_host, proxy_enabled")
        .eq("ativo", true);
      const semProxy = (instsAtivas || []).filter((i: any) => !i.proxy_enabled || !i.proxy_host);

      const taxaErro = (envHoje || 0) > 0
        ? Math.round(((errosHoje || 0) / ((envHoje || 0) + (errosHoje || 0))) * 100)
        : 0;

      const linhas: string[] = [];
      linhas.push(`📊 *Resumo Diário Aquecimento*`);
      linhas.push(`📅 ${sp.toLocaleDateString("pt-BR")}\n`);
      linhas.push(`*Chips:* ${totalChips} total`);
      linhas.push(`  ✅ Ativos: ${ativos}`);
      linhas.push(`  ⏸️ Pausados: ${pausados}`);
      linhas.push(`  🕒 Maturando: ${aguardando}\n`);
      linhas.push(`*Envios hoje:*`);
      linhas.push(`  ✓ Sucesso: ${envHoje || 0}`);
      linhas.push(`  ✗ Erros: ${errosHoje || 0} (${taxaErro}%)\n`);
      linhas.push(`*Saúde 24h:*`);
      linhas.push(`  📡 Quedas: ${quedas24h || 0}`);
      linhas.push(`  🛡️ Sem proxy: ${semProxy.length}`);
      if (semProxy.length > 0 && semProxy.length <= 8) {
        linhas.push(`     ${semProxy.map((i: any) => i.nome?.match(/^\d+/)?.[0] || "?").join(", ")}`);
      }

      const r = await notificarAdmin(supabase, {
        tipo: "resumo_diario",
        mensagem: linhas.join("\n"),
        chaveIdempotencia: dataChave,
        forcarFlag: "notificar_resumo_diario",
      });
      return json({ ...r, dataChave });
    }

    if (tipo === "proxies_faltando") {
      const { data: insts } = await supabase
        .from("user_whatsapp_instances")
        .select("id, nome, proxy_host, proxy_enabled")
        .eq("ativo", true);
      const semProxy = (insts || []).filter((i: any) => !i.proxy_enabled || !i.proxy_host);
      if (!semProxy.length) return json({ success: true, skipped: "todos_com_proxy" });

      const dataChave = new Date().toISOString().slice(0, 10);
      const lista = semProxy.slice(0, 15).map((i: any) => `• ${i.nome?.match(/^\d+/)?.[0] || i.id.slice(0, 6)}`).join("\n");
      const msg = `🛡️ *Chips sem proxy:* ${semProxy.length}\n\n${lista}\n\n_Aplicar proxy para evitar cluster de banimento_`;
      const r = await notificarAdmin(supabase, {
        tipo: "proxies_faltando",
        mensagem: msg,
        chaveIdempotencia: dataChave,
        forcarFlag: "notificar_proxies_faltando",
      });
      return json(r);
    }

    return json({ error: "tipo desconhecido" }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.88.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    let body: any = {};
    try { body = await req.json(); } catch (_) {}

    // ========== MANUAL TEST MODE ==========
    if (body?.action === "manual-test") {
      return await handleManualTest(supabase, body, supabaseUrl, supabaseKey);
    }

    console.log("[AQUECIMENTO] Iniciando ciclo...");

    const now = new Date();
    const spTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const hour = spTime.getHours();
    const dayOfWeek = spTime.getDay();

    // Check business hours (7h-21h)
    if (hour < 7 || hour >= 21) {
      console.log(`[AQUECIMENTO] Fora do horário (${hour}h). Pulando.`);
      return json({ message: "Fora do horário" });
    }

    // Load config
    const { data: configRows } = await supabase.from("whatsapp_aquecimento_config").select("*");
    const config: Record<string, any> = {};
    (configRows || []).forEach((c: any) => { config[c.chave] = c.valor; });

    const adminUserId = config.admin_user_id || null;
    if (!adminUserId) {
      console.log("[AQUECIMENTO] admin_user_id não configurado.");
      return json({ error: "admin_user_id não configurado" });
    }

    const diasAtivos: number[] = config.dias_ativos || [1, 2, 3, 4, 5, 6];
    if (!diasAtivos.includes(dayOfWeek)) {
      console.log(`[AQUECIMENTO] Dia ${dayOfWeek} não ativo.`);
      return json({ message: "Dia não ativo" });
    }

    // ========== AUTO-ENROLLMENT ==========
    const { data: allActiveInstances } = await supabase
      .from("user_whatsapp_instances")
      .select("id, nome, server_url, instance_token, criado_em, ativo")
      .eq("ativo", true)
      .eq("user_id", adminUserId);

    const { data: existingAquec } = await supabase
      .from("whatsapp_aquecimento_instancias")
      .select("instancia_id, status")
      .neq("status", "REMOVIDO");

    const existingIds = new Set((existingAquec || []).map((e: any) => e.instancia_id));

    for (const inst of (allActiveInstances || []).filter((i: any) => !existingIds.has(i.id))) {
      const { data: removed } = await supabase
        .from("whatsapp_aquecimento_instancias")
        .select("id")
        .eq("instancia_id", inst.id)
        .eq("status", "REMOVIDO")
        .maybeSingle();

      if (removed) {
        await supabase.from("whatsapp_aquecimento_instancias").update({
          status: "EM_AQUECIMENTO", fase: 1, limite_diario: 15,
        }).eq("id", removed.id);
      } else {
        await supabase.from("whatsapp_aquecimento_instancias").insert({
          instancia_id: inst.id, status: "EM_AQUECIMENTO", fase: 1,
          fase_auto: true, limite_diario: 15, dias_na_fase: 0,
          interacoes_hoje: 0, interacoes_total: 0, respostas_recebidas: 0,
        });
      }
      console.log(`[AQUECIMENTO] Auto-enrolled: ${inst.nome}`);
    }

    // ========== GET ALL WARMING INSTANCES ==========
    const { data: instancias } = await supabase
      .from("whatsapp_aquecimento_instancias")
      .select("*")
      .in("status", ["EM_AQUECIMENTO", "AQUECIDO"]);

    if (!instancias || instancias.length < 2) {
      console.log("[AQUECIMENTO] Menos de 2 instâncias ativas.");
      return json({ message: "Menos de 2 instâncias" });
    }

    const instanciaIds = instancias.map((i: any) => i.instancia_id);
    const { data: whatsappInstances } = await supabase
      .from("user_whatsapp_instances")
      .select("id, nome, server_url, instance_token, criado_em")
      .in("id", instanciaIds);

    const instanceMap = new Map((whatsappInstances || []).map((i: any) => [i.id, i]));

    // Today's start for counting
    const todayStart = new Date(spTime);
    todayStart.setHours(0, 0, 0, 0);
    const todayStartISO = todayStart.toISOString();

    const TARGET_MESSAGES_PER_DAY = 15;
    const HOURS_ACTIVE = 14; // 7h-21h
    const MSGS_PER_CYCLE = Math.max(1, Math.ceil(TARGET_MESSAGES_PER_DAY / (HOURS_ACTIVE * 4))); // ~1 per 15min cycle

    let totalEnviados = 0;

    // Process ALL eligible instances each cycle
    for (const inst of instancias) {
      const instDetails = instanceMap.get(inst.instancia_id);
      if (!instDetails) continue;

      // Reset daily counter if new day
      if (inst.ultima_interacao) {
        const lastDate = new Date(inst.ultima_interacao).toLocaleDateString("en-US", { timeZone: "America/Sao_Paulo" });
        const todayDate = spTime.toLocaleDateString("en-US");
        if (lastDate !== todayDate) {
          await supabase.from("whatsapp_aquecimento_instancias")
            .update({ interacoes_hoje: 0 }).eq("id", inst.id);
          inst.interacoes_hoje = 0;
        }
      }

      // Check daily limit
      if (inst.interacoes_hoje >= TARGET_MESSAGES_PER_DAY) {
        console.log(`[AQUECIMENTO] ${instDetails.nome}: limite diário atingido (${inst.interacoes_hoje}/${TARGET_MESSAGES_PER_DAY})`);
        continue;
      }

      // Health check
      const connected = await checkInstanceHealth(instDetails);
      if (!connected) {
        console.log(`[AQUECIMENTO] ${instDetails.nome}: DESCONECTADO. Pausando.`);
        await supabase.from("whatsapp_aquecimento_instancias")
          .update({ status: "PAUSADO" }).eq("id", inst.id);
        await supabase.from("aquecimento_notificacoes").insert({
          tipo: "desconexao", instancia_id: inst.instancia_id,
          mensagem: `🚫 "${instDetails.nome}" desconectado. Aquecimento pausado.`,
        });
        continue;
      }

      // Pick a random destination (different from self)
      const possibleDestinos = instancias.filter((d: any) => d.instancia_id !== inst.instancia_id);
      if (possibleDestinos.length === 0) continue;

      const destInst = possibleDestinos[Math.floor(Math.random() * possibleDestinos.length)];
      const destDetails = instanceMap.get(destInst.instancia_id);
      if (!destDetails) continue;

      // Get phone number of destination
      const destPhone = destDetails.nome?.match(/^\d+/)?.[0] || "";
      if (!destPhone) {
        console.log(`[AQUECIMENTO] ${destDetails.nome}: sem telefone no nome.`);
        continue;
      }

      const destNum = `55${destPhone}@s.whatsapp.net`;

      // Initiate AI conversation via whatsapp-ia-responder
      const fromPhone = instDetails.nome?.match(/^\d+/)?.[0] || "";

      console.log(`[AQUECIMENTO] Iniciando conversa IA: ${instDetails.nome} → ${destDetails.nome}`);

      const iaPayload = {
        action: "iniciar-conversa",
        instancia_origem_id: inst.instancia_id,
        instancia_destino_id: destInst.instancia_id,
        server_url: instDetails.server_url,
        instance_token: instDetails.instance_token,
        numero_destino: destNum,
        numero_origem: fromPhone ? `55${fromPhone}@s.whatsapp.net` : "",
        dest_server_url: destDetails.server_url,
        dest_instance_token: destDetails.instance_token,
      };

      // Fire and forget - let IA responder handle the chain
      fetch(`${supabaseUrl}/functions/v1/whatsapp-ia-responder`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${supabaseKey}` },
        body: JSON.stringify(iaPayload),
      }).then(r => r.text().then(t => console.log(`[AQUECIMENTO] IA response for ${instDetails.nome}: ${t.substring(0, 200)}`)))
        .catch(e => console.error("[AQUECIMENTO] IA call error:", e));

      // Update counters
      await supabase.from("whatsapp_aquecimento_instancias").update({
        interacoes_hoje: (inst.interacoes_hoje || 0) + 1,
        interacoes_total: (inst.interacoes_total || 0) + 1,
        ultima_interacao: new Date().toISOString(),
      }).eq("id", inst.id);

      totalEnviados++;

      // Small delay between instances to avoid burst
      await new Promise(r => setTimeout(r, 2000 + Math.random() * 3000));
    }

    console.log(`[AQUECIMENTO] Ciclo concluído. ${totalEnviados} conversas iniciadas.`);
    return json({ success: true, conversas_iniciadas: totalEnviados });

  } catch (err) {
    console.error("[AQUECIMENTO] Erro:", err);
    return json({ error: String(err) }, 500);
  }
});

// ========== HEALTH CHECK ==========
async function checkInstanceHealth(inst: any): Promise<boolean> {
  try {
    const cleanUrl = inst.server_url.replace(/\/+$/, "");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${cleanUrl}/instance/status`, {
      headers: { token: inst.instance_token },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const data = await res.json().catch(() => ({}));
    return data?.connected || data?.status === "CONNECTED" || data?.state === "open";
  } catch {
    return false;
  }
}

// ========== MANUAL TEST ==========
async function handleManualTest(supabase: any, body: any, supabaseUrl: string, supabaseKey: string) {
  const instanceIds: string[] = body.instance_ids || [];
  if (instanceIds.length < 2) {
    return json({ error: "Selecione pelo menos 2 instâncias" }, 400);
  }

  const { data: whatsappInsts } = await supabase
    .from("user_whatsapp_instances")
    .select("id, nome, server_url, instance_token")
    .in("id", instanceIds);

  if (!whatsappInsts || whatsappInsts.length < 2) {
    return json({ error: "Instâncias não encontradas" }, 404);
  }

  let enviados = 0;
  const results: any[] = [];

  for (let i = 0; i < whatsappInsts.length; i++) {
    const from = whatsappInsts[i];
    const to = whatsappInsts[(i + 1) % whatsappInsts.length];
    const toPhone = to.nome?.match(/^\d+/)?.[0] || "";
    if (!toPhone) {
      results.push({ from: from.nome, to: to.nome, status: "ERRO", motivo: "Sem telefone" });
      continue;
    }

    const fromPhone = from.nome?.match(/^\d+/)?.[0] || "";
    const destNum = `55${toPhone}@s.whatsapp.net`;

    // Use IA to start conversation
    const iaPayload = {
      action: "iniciar-conversa",
      instancia_origem_id: from.id,
      instancia_destino_id: to.id,
      server_url: from.server_url,
      instance_token: from.instance_token,
      numero_destino: destNum,
      numero_origem: fromPhone ? `55${fromPhone}@s.whatsapp.net` : "",
      dest_server_url: to.server_url,
      dest_instance_token: to.instance_token,
    };

    try {
      const iaRes = await fetch(`${supabaseUrl}/functions/v1/whatsapp-ia-responder`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${supabaseKey}` },
        body: JSON.stringify(iaPayload),
      });
      const iaData = await iaRes.json().catch(() => ({}));
      enviados++;
      results.push({ from: from.nome, to: to.nome, status: "INICIADO", resposta: iaData });
    } catch (err) {
      results.push({ from: from.nome, to: to.nome, status: "ERRO", motivo: String(err) });
    }
  }

  return json({ success: true, enviados, results });
}

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

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

    // ========== SYNC: PAUSE DEACTIVATED INSTANCES (backup do trigger) ==========
    const { data: allInstances } = await supabase
      .from("user_whatsapp_instances")
      .select("id, ativo")
      .eq("user_id", adminUserId);

    const activeInstanceIds = new Set((allActiveInstances || []).map((i: any) => i.id));

    const { data: allAquecInstances } = await supabase
      .from("whatsapp_aquecimento_instancias")
      .select("id, instancia_id, status")
      .not("status", "eq", "REMOVIDO");

    for (const aquec of (allAquecInstances || [])) {
      const mainInst = (allInstances || []).find((i: any) => i.id === aquec.instancia_id);
      if (mainInst && !mainInst.ativo && aquec.status !== "PAUSADO") {
        await supabase.from("whatsapp_aquecimento_instancias")
          .update({ status: "PAUSADO" }).eq("id", aquec.id);
        console.log(`[AQUECIMENTO] ⏸️ Pausado (desativado): ${aquec.instancia_id}`);
      }
    }

    // ========== AUTO-REACTIVATE PAUSED INSTANCES ==========
    // NEW: Reactivate ALL paused instances whose main instance is ativo=true
    // WITHOUT requiring a health check — health check moves to send-time
    const { data: pausedInstances } = await supabase
      .from("whatsapp_aquecimento_instancias")
      .select("id, instancia_id")
      .eq("status", "PAUSADO");

    let reativados = 0;
    for (const paused of (pausedInstances || [])) {
      // Only reactivate if the main instance is active
      if (activeInstanceIds.has(paused.instancia_id)) {
        await supabase.from("whatsapp_aquecimento_instancias")
          .update({ status: "EM_AQUECIMENTO" }).eq("id", paused.id);
        reativados++;
      }
    }
    if (reativados > 0) {
      console.log(`[AQUECIMENTO] ✅ Reativados ${reativados} instâncias PAUSADO → EM_AQUECIMENTO (sem health check)`);
    }

    // ========== GET ALL WARMING INSTANCES ==========
    const { data: instancias } = await supabase
      .from("whatsapp_aquecimento_instancias")
      .select("*")
      .in("status", ["EM_AQUECIMENTO", "AQUECIDO"]);

    if (!instancias || instancias.length < 2) {
      console.log(`[AQUECIMENTO] Menos de 2 instâncias ativas (${instancias?.length || 0}).`);
      return json({ message: "Menos de 2 instâncias" });
    }

    console.log(`[AQUECIMENTO] ${instancias.length} instâncias ativas para aquecimento.`);

    const instanciaIds = instancias.map((i: any) => i.instancia_id);
    const { data: whatsappInstances } = await supabase
      .from("user_whatsapp_instances")
      .select("id, nome, server_url, instance_token, criado_em")
      .in("id", instanciaIds);

    const instanceMap = new Map((whatsappInstances || []).map((i: any) => [i.id, i]));

    const TARGET_MESSAGES_PER_DAY = 15;

    // ========== RESET DAILY COUNTERS ==========
    for (const inst of instancias) {
      if (inst.ultima_interacao) {
        const lastDate = new Date(inst.ultima_interacao).toLocaleDateString("en-US", { timeZone: "America/Sao_Paulo" });
        const todayDate = spTime.toLocaleDateString("en-US");
        if (lastDate !== todayDate) {
          await supabase.from("whatsapp_aquecimento_instancias")
            .update({ interacoes_hoje: 0 }).eq("id", inst.id);
          inst.interacoes_hoje = 0;
        }
      }
    }

    // Filter eligible instances (not at daily limit)
    const eligible = instancias.filter((inst: any) => {
      if (inst.interacoes_hoje >= TARGET_MESSAGES_PER_DAY) {
        return false;
      }
      return true;
    });

    if (eligible.length < 2) {
      console.log("[AQUECIMENTO] Menos de 2 instâncias elegíveis neste ciclo.");
      return json({ message: "Menos de 2 instâncias elegíveis" });
    }

    // ========== HEALTH CHECK IN PARALLEL BATCHES ==========
    // Check up to 30 instances, 10 at a time in parallel
    const maxToCheck = Math.min(eligible.length, 30);
    const toCheck = eligible.slice(0, maxToCheck);
    const healthyInstances: any[] = [];

    for (let i = 0; i < toCheck.length; i += 10) {
      const batch = toCheck.slice(i, i + 10);
      const results = await Promise.allSettled(
        batch.map(async (inst: any) => {
          const details = instanceMap.get(inst.instancia_id);
          if (!details) return { inst, connected: false, reason: "no details" };
          const connected = await checkInstanceHealth(details);
          return { inst, connected, details };
        })
      );

      for (const result of results) {
        if (result.status === "fulfilled") {
          const { inst, connected, details } = result.value;
          if (connected) {
            healthyInstances.push(inst);
          } else if (details) {
            console.log(`[AQUECIMENTO] ${details.nome}: DESCONECTADO → PAUSADO`);
            await supabase.from("whatsapp_aquecimento_instancias")
              .update({ status: "PAUSADO" }).eq("id", inst.id);
          }
        }
      }
    }

    // Also add remaining eligible instances that weren't health-checked (trust them)
    if (eligible.length > maxToCheck) {
      const unchecked = eligible.slice(maxToCheck);
      healthyInstances.push(...unchecked);
      console.log(`[AQUECIMENTO] ${unchecked.length} instâncias extras não verificadas (confiadas).`);
    }

    console.log(`[AQUECIMENTO] ${healthyInstances.length} instâncias saudáveis de ${eligible.length} elegíveis.`);

    if (healthyInstances.length < 2) {
      console.log("[AQUECIMENTO] Menos de 2 instâncias saudáveis.");
      return json({ message: "Menos de 2 instâncias saudáveis" });
    }

    // ========== GENERATE PAIRS ==========
    const shuffled = [...healthyInstances].sort(() => Math.random() - 0.5);
    const pairs: [any, any][] = [];
    for (let i = 0; i + 1 < shuffled.length; i += 2) {
      pairs.push([shuffled[i], shuffled[i + 1]]);
    }

    console.log(`[AQUECIMENTO] Gerados ${pairs.length} pares de ${healthyInstances.length} instâncias.`);

    let totalEnviados = 0;

    for (const [instA, instB] of pairs) {
      const detailsA = instanceMap.get(instA.instancia_id);
      const detailsB = instanceMap.get(instB.instancia_id);
      if (!detailsA || !detailsB) continue;

      // Check if same pair already had conversation today
      const todayStart = new Date(spTime);
      todayStart.setHours(0, 0, 0, 0);
      const { data: conversaHoje } = await supabase
        .from("whatsapp_conversas_ia")
        .select("id")
        .or(`and(instancia_origem_id.eq.${instA.instancia_id},instancia_destino_id.eq.${instB.instancia_id}),and(instancia_origem_id.eq.${instB.instancia_id},instancia_destino_id.eq.${instA.instancia_id})`)
        .gte("inicio_em", todayStart.toISOString())
        .limit(1)
        .maybeSingle();

      if (conversaHoje) {
        continue;
      }

      // Get phone numbers
      const phoneA = detailsA.nome?.match(/^\d+/)?.[0] || "";
      const phoneB = detailsB.nome?.match(/^\d+/)?.[0] || "";
      if (!phoneA || !phoneB) continue;

      const destNum = `55${phoneB}@s.whatsapp.net`;
      const origNum = `55${phoneA}@s.whatsapp.net`;

      console.log(`[AQUECIMENTO] 🤝 Par: ${detailsA.nome} → ${detailsB.nome}`);

      const iaPayload = {
        action: "iniciar-conversa",
        instancia_origem_id: instA.instancia_id,
        instancia_destino_id: instB.instancia_id,
        server_url: detailsA.server_url,
        instance_token: detailsA.instance_token,
        numero_destino: destNum,
        numero_origem: origNum,
        dest_server_url: detailsB.server_url,
        dest_instance_token: detailsB.instance_token,
      };

      // Fire and forget
      fetch(`${supabaseUrl}/functions/v1/whatsapp-ia-responder`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${supabaseKey}` },
        body: JSON.stringify(iaPayload),
      }).then(r => r.text().then(t => console.log(`[AQUECIMENTO] IA response ${detailsA.nome}→${detailsB.nome}: ${t.substring(0, 200)}`)))
        .catch(e => console.error("[AQUECIMENTO] IA call error:", e));

      // Update counters
      await supabase.from("whatsapp_aquecimento_instancias").update({
        interacoes_hoje: (instA.interacoes_hoje || 0) + 1,
        interacoes_total: (instA.interacoes_total || 0) + 1,
        ultima_interacao: new Date().toISOString(),
        ultimo_parceiro_id: instB.instancia_id,
      }).eq("id", instA.id);

      await supabase.from("whatsapp_aquecimento_instancias").update({
        ultimo_parceiro_id: instA.instancia_id,
      }).eq("id", instB.id);

      totalEnviados++;

      // Small delay between pairs
      await new Promise(r => setTimeout(r, 2000 + Math.random() * 3000));
    }

    console.log(`[AQUECIMENTO] Ciclo concluído. ${totalEnviados} conversas iniciadas de ${pairs.length} pares.`);
    return json({ success: true, conversas_iniciadas: totalEnviados, total_pares: pairs.length, reativados });

  } catch (err) {
    console.error("[AQUECIMENTO] Erro:", err);
    return json({ error: String(err) }, 500);
  }
});

// ========== HEALTH CHECK (RESILIENT) ==========
async function checkInstanceHealth(inst: any): Promise<boolean> {
  try {
    const cleanUrl = inst.server_url.replace(/\/+$/, "");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${cleanUrl}/instance/status`, {
      headers: { token: inst.instance_token },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const text = await res.text();
    let data: any = {};
    try { data = JSON.parse(text); } catch { return false; }

    // Accept multiple UAZAPI response formats
    const connected =
      data?.connected === true ||
      data?.status === "CONNECTED" ||
      data?.status === "open" ||
      data?.state === "open" ||
      data?.instance?.state === "open" ||
      data?.instance?.status === "CONNECTED" ||
      (typeof data?.status === "object" && data?.status?.state === "open");

    if (!connected) {
      console.log(`[AQUECIMENTO] Health check failed for ${inst.nome}: ${text.substring(0, 150)}`);
    }
    return connected;
  } catch (e) {
    console.log(`[AQUECIMENTO] Health check error for ${inst.nome}: ${e}`);
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

  const shuffled = [...whatsappInsts].sort(() => Math.random() - 0.5);
  const pairs: [any, any][] = [];
  for (let i = 0; i + 1 < shuffled.length; i += 2) {
    pairs.push([shuffled[i], shuffled[i + 1]]);
  }

  let enviados = 0;
  const results: any[] = [];

  for (const [from, to] of pairs) {
    const toPhone = to.nome?.match(/^\d+/)?.[0] || "";
    const fromPhone = from.nome?.match(/^\d+/)?.[0] || "";
    if (!toPhone || !fromPhone) {
      results.push({ from: from.nome, to: to.nome, status: "ERRO", motivo: "Sem telefone" });
      continue;
    }

    const destNum = `55${toPhone}@s.whatsapp.net`;
    const origNum = `55${fromPhone}@s.whatsapp.net`;

    const iaPayload = {
      action: "iniciar-conversa",
      instancia_origem_id: from.id,
      instancia_destino_id: to.id,
      server_url: from.server_url,
      instance_token: from.instance_token,
      numero_destino: destNum,
      numero_origem: origNum,
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

  return json({ success: true, enviados, pares: pairs.length, results });
}

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

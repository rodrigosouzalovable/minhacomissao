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

    // ========== DAILY VARIANCE: randomize target (0, 1 or 2 conversations) ==========
    // 20% chance: 0 (busy day), 60% chance: 1 (normal), 20% chance: 2 (relaxed day)
    const dailyRoll = Math.random();
    const TARGET_MESSAGES_PER_DAY = dailyRoll < 0.20 ? 0 : dailyRoll < 0.80 ? 1 : 2;
    const MAX_PAIRS_PER_CYCLE = 3;

    if (TARGET_MESSAGES_PER_DAY === 0) {
      console.log("[AQUECIMENTO] 📵 Dia de folga (sorteio 20%). Nenhuma conversa hoje.");
      return json({ message: "Rest day - no conversations", skipped: true, daily_target: 0 });
    }

    console.log(`[AQUECIMENTO] 🎯 Target do dia: ${TARGET_MESSAGES_PER_DAY} conversa(s) por instância.`);

    // 50% chance to skip this cycle for natural, unpredictable pattern
    if (Math.random() > 0.5) {
      console.log("[AQUECIMENTO] ⏭️ Skip aleatório para padrão natural.");
      return json({ message: "Random skip for natural pattern", skipped: true });
    }

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
    const eligible = instancias.filter((inst: any) => inst.interacoes_hoje < TARGET_MESSAGES_PER_DAY);

    if (eligible.length < 2) {
      console.log(`[AQUECIMENTO] ⏭️ Skip rápido: ${instancias.length - eligible.length}/${instancias.length} já atingiram target. Elegíveis: ${eligible.length}`);
      return json({ message: "Menos de 2 instâncias elegíveis", skipped: true, total: instancias.length, at_target: instancias.length - eligible.length });
    }

    console.log(`[AQUECIMENTO] ${eligible.length} elegíveis de ${instancias.length} (${instancias.length - eligible.length} já no target).`);

    // ========== GENERATE PAIRS (sem health check — só pausa em falha de envio) ==========
    const shuffled = [...eligible].sort(() => Math.random() - 0.5);
    const allPairs: [any, any][] = [];
    for (let i = 0; i + 1 < shuffled.length; i += 2) {
      allPairs.push([shuffled[i], shuffled[i + 1]]);
    }

    // Limit to MAX_PAIRS_PER_CYCLE random pairs
    const pairs = allPairs.sort(() => Math.random() - 0.5).slice(0, MAX_PAIRS_PER_CYCLE);

    console.log(`[AQUECIMENTO] Selecionados ${pairs.length} pares de ${allPairs.length} disponíveis (max ${MAX_PAIRS_PER_CYCLE}/ciclo).`);

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

      // Await response to detect disconnection errors
      try {
        const iaRes = await fetch(`${supabaseUrl}/functions/v1/whatsapp-ia-responder`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${supabaseKey}` },
          body: JSON.stringify(iaPayload),
        });
        const iaText = await iaRes.text();
        console.log(`[AQUECIMENTO] IA response ${detailsA.nome}→${detailsB.nome}: ${iaText.substring(0, 200)}`);

        // Only pause if explicit disconnection error
        const lower = iaText.toLowerCase();
        if (lower.includes("disconnected") || lower.includes("desconectado") || lower.includes("not connected")) {
          if (lower.includes(phoneA) || iaText.includes(instA.instancia_id)) {
            console.log(`[AQUECIMENTO] ⚠️ ${detailsA.nome} desconectado → PAUSADO`);
            await supabase.from("whatsapp_aquecimento_instancias").update({ status: "PAUSADO" }).eq("id", instA.id);
          }
          if (lower.includes(phoneB) || iaText.includes(instB.instancia_id)) {
            console.log(`[AQUECIMENTO] ⚠️ ${detailsB.nome} desconectado → PAUSADO`);
            await supabase.from("whatsapp_aquecimento_instancias").update({ status: "PAUSADO" }).eq("id", instB.id);
          }
        }
      } catch (e) {
        console.error(`[AQUECIMENTO] IA call error ${detailsA.nome}→${detailsB.nome}:`, e);
      }

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
      await new Promise(r => setTimeout(r, 30000 + Math.random() * 90000));
    }

    console.log(`[AQUECIMENTO] Ciclo concluído. ${totalEnviados} conversas iniciadas de ${pairs.length} pares.`);
    return json({ success: true, conversas_iniciadas: totalEnviados, total_pares: pairs.length, reativados });

  } catch (err) {
    console.error("[AQUECIMENTO] Erro:", err);
    return json({ error: String(err) }, 500);
  }
});

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

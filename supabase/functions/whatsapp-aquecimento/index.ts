import { createClient } from "https://esm.sh/@supabase/supabase-js@2.88.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Phase config: limits and allowed types per phase (age-based)
const PHASE_CONFIG: Record<number, { limite: number; tipos: string[]; statusTipos: string[] }> = {
  1: { limite: 1, tipos: ["texto"], statusTipos: ["text"] },
  2: { limite: 3, tipos: ["texto", "audio"], statusTipos: ["text", "image"] },
  3: { limite: 7, tipos: ["texto", "audio"], statusTipos: ["text", "image"] },
  4: { limite: 15, tipos: ["texto", "audio"], statusTipos: ["text", "image"] },
  5: { limite: 25, tipos: ["texto", "audio"], statusTipos: ["text", "image", "video"] },
};

function calcFaseByAge(diasConectado: number): number {
  if (diasConectado < 7) return 1;
  if (diasConectado < 14) return 2;
  if (diasConectado < 21) return 3;
  if (diasConectado < 28) return 4;
  return 5;
}

// ========== DETERMINISTIC HASH UTILITY ==========
function deterministicHash(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

// ========== ANTI-BAN: Read-only day (15% chance) — skips messages only, keeps status/contacts ==========
function isReadOnlyDay(instanceId: string, dateStr: string): boolean {
  return (deterministicHash(instanceId + "readonly" + dateStr) % 100) < 15;
}

// ========== ANTI-BAN: Burst morning (30% chance) — 2-3 fast messages between 8-9h ==========
function isBurstMorning(instanceId: string, dateStr: string): boolean {
  return (deterministicHash(instanceId + "burst" + dateStr) % 100) < 30;
}

// ========== ANTI-BAN: Random skip (30% chance per cycle) ==========
function shouldSkipCycle(instanceId: string, minuteKey: string): boolean {
  return (deterministicHash(instanceId + "skip" + minuteKey) % 100) < 30;
}

// ========== DYNAMIC IMAGE URL (per-instance per-day, no shared fingerprint) ==========
function getStatusImageUrl(instanceId: string, dateStr: string, index: number): string {
  const seed = deterministicHash(instanceId + dateStr + String(index));
  // Use Lorem Picsum with deterministic seed per instance/day
  return `https://picsum.photos/seed/${seed}/800/600`;
}

// ========== STATUS CONTENT POOLS ==========
const STATUS_TEXTOS_FASE1 = [
  "Bom dia! 🌞", "Ótimo dia para todos!", "Boa noite! 🌙",
  "Final de semana chegando! 🎉", "Mais um dia produtivo pela frente! 💪",
  "Que a semana seja incrível! ✨", "Bom dia, pessoal! ☀️",
  "Boa tarde! 🌤️", "Desejando um ótimo dia a todos! 🙏",
  "Que Deus abençoe nosso dia! 🙌",
  "Começando mais uma semana com energia! ⚡", "Boa noite e bons sonhos! 💤",
  "Vamos que vamos! 🚀", "Feliz dia! 😊", "Gratidão por mais um dia! 🌻",
  "Sexta-feira finalmente! 🥳", "Bom descanso a todos! 😴",
  "Aproveitando o dia ☕", "Que venham coisas boas! 🍀",
  "Dia lindo hoje! 🌈", "Tudo no tempo certo 🕐",
  "Bom começo de semana! 📅", "Boa semana pra geral! 🙂",
  "Mais um dia, mais uma oportunidade! 🌅",
  "Renovando as energias! 🔋", "Curtindo o momento 😌",
  "Paz e saúde pra todos! 💚", "Hoje é dia de agradecer 🙏",
  "Segunda cheia de energia! 💥", "Metade da semana já! ⏳",
  "Foco total hoje 🎯", "Dia de recomeçar! 🌱",
  "Que a tarde seja produtiva! ☀️", "Noite tranquila 🌃",
  "Cada dia é uma nova chance! 🌟",
];

const STATUS_TEXTOS_FASE3 = [
  "Novidades em breve... fiquem ligados! 📱",
  "Estamos trabalhando para melhorar ainda mais! 🚀",
  "Tecnologia transformando vidas! 💡",
  "Mais um dia de conquistas! 🏆",
  "Inovação é o caminho! 💻",
  "Foco, força e fé! 🎯", "Resultados que fazem a diferença! 📊",
  "Compromisso com a excelência! ⭐", "Transformando desafios em oportunidades! 💼",
  "Crescendo juntos, dia após dia! 📈",
  "O futuro é agora! 🌍", "Conectando pessoas, gerando valor! 🤝",
  "Sempre em evolução! 🔄", "Qualidade em primeiro lugar! ✅",
  "Fazendo acontecer! 🔥",
  "Trabalho duro compensa! 💎", "Construindo o futuro hoje 🏗️",
  "Cada detalhe importa! 🔍", "Disciplina gera resultado! 📋",
  "O caminho é longo mas vale a pena! 🛤️",
  "Confiança no processo! 🔑", "Metas sendo alcançadas! 🏅",
  "Progresso, não perfeição! 📐", "Time forte, resultado forte! 👊",
  "Dedicação é tudo! 💯", "Evoluindo sempre! 🧬",
  "Planejamento é a base! 📝", "Persistência vence! 🏋️",
  "Um passo de cada vez! 👣", "Vencer é questão de tempo! ⏰",
  "Oportunidades aparecem pra quem trabalha! 🔧",
  "Produtividade em alta! ⚡", "Objetivo claro, mente focada! 🧠",
  "Superação diária! 🦅", "Gratidão pelo progresso! 🌻",
];

// Fallback static images (only used if Picsum fails)
const STATUS_IMAGENS_FALLBACK = [
  "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&q=80",
  "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800&q=80",
  "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80",
  "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800&q=80",
  "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=800&q=80",
];

const BG_COLORS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
const FONTS = [1, 2, 3, 4, 5];

function isWithinStatusHours(hour: number): boolean {
  return hour >= 7 && hour < 21;
}

function shouldPostStatus(hour: number): boolean {
  if (!isWithinStatusHours(hour)) return false;
  const rand = Math.random();
  if (hour >= 8 && hour < 12) return rand < 0.08;
  if (hour >= 12 && hour < 18) return rand < 0.07;
  if (hour >= 18 && hour < 21) return rand < 0.05;
  return rand < 0.03;
}

// Deterministic "silent day" check: 20% chance per instance per day
function isSilentDay(instanceId: string, dateStr: string): boolean {
  return (deterministicHash(instanceId + dateStr) % 100) < 20;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // ========== MANUAL TEST MODE ==========
    let body: any = {};
    try { body = await req.json(); } catch (_) { /* no body = auto mode */ }

    if (body?.action === "manual-test") {
      const instanceIds: string[] = body.instance_ids || [];
      if (instanceIds.length < 2) {
        return new Response(JSON.stringify({ error: "Selecione pelo menos 2 instâncias" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log(`[AQUECIMENTO-MANUAL] Teste manual com ${instanceIds.length} instâncias`);

      const { data: whatsappInsts } = await supabase
        .from("user_whatsapp_instances")
        .select("id, nome, server_url, instance_token")
        .in("id", instanceIds);

      if (!whatsappInsts || whatsappInsts.length < 2) {
        return new Response(JSON.stringify({ error: "Instâncias não encontradas" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Auto-reconfigure webhook for each instance (remove wasSentByApi filter)
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const adminToken = Deno.env.get("UAZAPI_ADMIN_TOKEN") || "";
      const webhookUrl = `${supabaseUrl}/functions/v1/whatsapp-chatbot`;
      for (const inst of whatsappInsts) {
        const cleanBase = inst.server_url.replace(/\/+$/, "");
        const whPayload = JSON.stringify({ url: webhookUrl, enabled: true, events: ["messages"], excludeMessages: [] });
        const attempts = [
          { url: `${cleanBase}/webhook/${inst.instance_token}`, headers: { "Content-Type": "application/json" } as Record<string, string> },
          { url: `${cleanBase}/webhook`, headers: { "Content-Type": "application/json", token: inst.instance_token } as Record<string, string> },
          { url: `${cleanBase}/globalwebhook`, headers: { "Content-Type": "application/json", admintoken: adminToken } as Record<string, string> },
        ];
        let webhookOk = false;
        for (const attempt of attempts) {
          try {
            const whRes = await fetch(attempt.url, { method: "POST", headers: attempt.headers, body: whPayload });
            const whText = await whRes.text();
            console.log(`[AQUECIMENTO-MANUAL] Webhook ${attempt.url} para ${inst.nome}: ${whRes.status} - ${whText.substring(0, 200)}`);
            if (whRes.ok) { webhookOk = true; break; }
          } catch (e) {
            console.warn(`[AQUECIMENTO-MANUAL] Erro webhook ${attempt.url}:`, e.message);
          }
        }
        if (!webhookOk) {
          console.error(`[AQUECIMENTO-MANUAL] FALHA ao reconfigurar webhook de ${inst.nome} - nenhum endpoint respondeu OK`);
        }
      }

      // Get dialogues pool
      const { data: dialogos } = await supabase
        .from("whatsapp_aquecimento_dialogos")
        .select("*")
        .eq("ativo", true)
        .eq("tipo", "texto");

      const fallbackTexts = [
        "Oi, tudo bem? 😊", "Bom dia! Como vai? ☀️", "E aí, como está?",
        "Boa tarde! Tudo certo? 🙂", "Oi! Quanto tempo! 👋",
      ];

      let enviados = 0;
      const results: any[] = [];

      // Round-robin: each instance sends to the next one
      for (let i = 0; i < whatsappInsts.length; i++) {
        const from = whatsappInsts[i];
        const to = whatsappInsts[(i + 1) % whatsappInsts.length];

        const toPhone = to.nome?.match(/^\d+/)?.[0] || "";
        if (!toPhone) {
          results.push({ from: from.nome, to: to.nome, status: "ERRO", motivo: "Sem telefone" });
          continue;
        }

        const texto = dialogos && dialogos.length > 0
          ? dialogos[Math.floor(Math.random() * dialogos.length)].conteudo
          : fallbackTexts[Math.floor(Math.random() * fallbackTexts.length)];

        const cleanUrl = from.server_url.replace(/\/+$/, "");
        const destNum = `55${toPhone}@s.whatsapp.net`;

        try {
          const sendRes = await fetch(`${cleanUrl}/send/text`, {
            method: "POST",
            headers: { "Content-Type": "application/json", token: from.instance_token },
            body: JSON.stringify({ number: destNum, text: texto }),
          });

          const sendData = await sendRes.json().catch(() => ({}));
          const status = sendRes.ok ? "ENVIADO" : "FALHOU";

          await supabase.from("whatsapp_aquecimento_interacoes").insert({
            instancia_origem_id: from.id,
            instancia_destino_id: to.id,
            tipo: "texto",
            conteudo: texto,
            status,
            mensagem_id: sendData?.key?.id || null,
            enviado_em: new Date().toISOString(),
            tipo_interacao: "mensagem",
          });

          if (sendRes.ok) {
            enviados++;

            // Direct IA call: B responds to A (bypass webhook dependency)
            const fromPhone = from.nome?.match(/^\d+/)?.[0] || "";
            if (fromPhone) {
              const { data: toAquec } = await supabase
                .from("whatsapp_aquecimento_instancias")
                .select("fase")
                .eq("instancia_id", to.id)
                .maybeSingle();
              const fase = toAquec?.fase || 1;
              const probMap: Record<number, number> = { 1: 0.30, 2: 0.60 };
              const probabilidade = probMap[fase] ?? 0.90;
              if (Math.random() <= probabilidade) {
                const delay = 15000 + Math.random() * 75000;
                console.log(`[AQUECIMENTO-MANUAL] IA: ${to.nome} responderá a ${from.nome} em ${Math.round(delay / 1000)}s`);
                const iaPayload = {
                  action: "gerar-resposta",
                  mensagem: texto,
                  fase,
                  instancia_origem_id: to.id,
                  instancia_destino_id: from.id,
                  delay_ms: delay,
                  server_url: to.server_url,
                  instance_token: to.instance_token,
                  numero_destino: `55${fromPhone}@s.whatsapp.net`,
                };
                // Fire-and-forget: don't await (would block the loop)
                fetch(`${supabaseUrl}/functions/v1/whatsapp-ia-responder`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", Authorization: `Bearer ${supabaseKey}` },
                  body: JSON.stringify(iaPayload),
                }).then(r => r.text()).catch(e => console.error("[AQUECIMENTO-MANUAL] IA call error:", e));
              } else {
                console.log(`[AQUECIMENTO-MANUAL] IA: ${to.nome} não respondeu (prob ${probabilidade})`);
              }
            }
          }
          results.push({ from: from.nome, to: to.nome, status, texto });
          console.log(`[AQUECIMENTO-MANUAL] ${from.nome} → ${to.nome}: ${status}`);
        } catch (err) {
          results.push({ from: from.nome, to: to.nome, status: "ERRO", motivo: String(err) });
          console.error(`[AQUECIMENTO-MANUAL] Erro: ${err}`);
        }
      }

      return new Response(JSON.stringify({ success: true, enviados, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========== ANTI-BAN: Jitter 0-180 seconds ==========
    const jitterSeconds = Math.floor(Math.random() * 180);
    console.log(`[AQUECIMENTO-AUTO] Jitter de ${jitterSeconds}s antes de iniciar...`);
    await new Promise(resolve => setTimeout(resolve, jitterSeconds * 1000));

    console.log("[AQUECIMENTO-AUTO] Iniciando ciclo automático...");

    const now = new Date();
    const spTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const hour = spTime.getHours();
    const dayOfWeek = spTime.getDay();
    const todayDateStr = spTime.toISOString().slice(0, 10);
    const minuteKey = spTime.toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM for skip seed

    // ========== ANTI-BAN: Lunch break (12h-14h) ==========
    if (hour >= 12 && hour < 14) {
      console.log(`[AQUECIMENTO-AUTO] Pausa de almoço (${hour}h). Pulando ciclo.`);
      return new Response(JSON.stringify({ message: "Pausa de almoço" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Load config
    const { data: configRows } = await supabase.from("whatsapp_aquecimento_config").select("*");
    const config: Record<string, any> = {};
    (configRows || []).forEach((c: any) => { config[c.chave] = c.valor; });

    const adminUserId = config.admin_user_id || null;
    if (!adminUserId) {
      console.log("[AQUECIMENTO-AUTO] admin_user_id não configurado. Abortando.");
      return new Response(JSON.stringify({ error: "admin_user_id não configurado" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const horario = config.horario_comercial || { inicio: "08:00", fim: "18:00" };
    const [hInicio] = (horario.inicio || "08:00").split(":").map(Number);
    const [hFim] = (horario.fim || "18:00").split(":").map(Number);
    const diasAtivos: number[] = config.dias_ativos || [1, 2, 3, 4, 5, 6];
    const delayConfig = config.delay_config || { min_segundos: 30, max_segundos: 180 };
    const diasCarencia: number = config.dias_carencia ?? 2;

    const postarStatusAuto = config.postar_status_auto !== false;
    const salvarContatosAuto = config.salvar_contatos_auto !== false;
    const statusIncluirImagens = config.status_incluir_imagens !== false;
    const statusIncluirVideos = config.status_incluir_videos === true;

    // ========== ANTI-BAN: Weekend reduction from config ==========
    const reducaoFimSemana = config.reducao_fim_semana ?? { sabado: 60, domingo: 40 };

    // Helper: generate a deterministic offset ±60min from instance ID
    function getInstanceHourOffset(instanceId: string): number {
      return (deterministicHash(instanceId + "offset") % 121) - 60;
    }

    if (!diasAtivos.includes(dayOfWeek)) {
      console.log(`[AQUECIMENTO-AUTO] Dia ${dayOfWeek} não é ativo. Pulando.`);
      return new Response(JSON.stringify({ message: "Dia não ativo" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (hour < (hInicio - 1) || hour >= (hFim + 1)) {
      console.log(`[AQUECIMENTO-AUTO] Fora do horário comercial (${hour}h). Pulando.`);
      return new Response(JSON.stringify({ message: "Fora do horário comercial" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ========== CLEANUP: Remove instances no longer active ==========
    const { data: existingAquecimento } = await supabase
      .from("whatsapp_aquecimento_instancias")
      .select("id, instancia_id, status")
      .in("status", ["EM_AQUECIMENTO", "AQUECIDO", "PAUSADO"]);

    if (existingAquecimento && existingAquecimento.length > 0) {
      const aquecInstIds = existingAquecimento.map((e: any) => e.instancia_id);
      const { data: stillActive } = await supabase
        .from("user_whatsapp_instances")
        .select("id")
        .in("id", aquecInstIds)
        .eq("ativo", true);
      
      const stillActiveIds = new Set((stillActive || []).map((i: any) => i.id));
      
      for (const aquecInst of existingAquecimento) {
        if (!stillActiveIds.has(aquecInst.instancia_id)) {
          await supabase
            .from("whatsapp_aquecimento_instancias")
            .update({ status: "REMOVIDO" })
            .eq("id", aquecInst.id);
          console.log(`[AQUECIMENTO-AUTO] Instância ${aquecInst.instancia_id} removida (não mais ativa)`);
        }
      }
    }

    // ========== AUTO-ENROLLMENT ==========
    const { data: allActiveInstances } = await supabase
      .from("user_whatsapp_instances")
      .select("id, nome, server_url, instance_token, criado_em, ativo")
      .eq("ativo", true)
      .eq("user_id", adminUserId);

    const { data: existingAquecimentoEnroll } = await supabase
      .from("whatsapp_aquecimento_instancias")
      .select("instancia_id")
      .neq("status", "REMOVIDO");

    const existingIds = new Set((existingAquecimentoEnroll || []).map((e: any) => e.instancia_id));
    const newInstances = (allActiveInstances || []).filter((i: any) => !existingIds.has(i.id));

    for (const newInst of newInstances) {
      const diasConectado = Math.floor((Date.now() - new Date(newInst.criado_em).getTime()) / 86400000);
      const fase = calcFaseByAge(diasConectado);
      const phaseConfig = PHASE_CONFIG[fase] || PHASE_CONFIG[1];

      const { data: removedEntry } = await supabase
        .from("whatsapp_aquecimento_instancias")
        .select("id")
        .eq("instancia_id", newInst.id)
        .eq("status", "REMOVIDO")
        .maybeSingle();

      if (removedEntry) {
        await supabase.from("whatsapp_aquecimento_instancias").update({
          status: "EM_AQUECIMENTO",
          fase,
          limite_diario: phaseConfig.limite,
        }).eq("id", removedEntry.id);
        console.log(`[AQUECIMENTO-AUTO] Reativado: ${newInst.nome} (Fase ${fase})`);
      } else {
        await supabase.from("whatsapp_aquecimento_instancias").insert({
          instancia_id: newInst.id,
          status: "EM_AQUECIMENTO",
          fase,
          fase_auto: true,
          limite_diario: phaseConfig.limite,
          dias_na_fase: 0,
          interacoes_hoje: 0,
          interacoes_total: 0,
          respostas_recebidas: 0,
        });
      }

      await supabase.from("aquecimento_notificacoes").insert({
        tipo: "novo_numero",
        instancia_id: newInst.id,
        mensagem: `🔌 Número "${newInst.nome || newInst.id.slice(0, 8)}" conectado. Aquecimento iniciado automaticamente na Fase ${fase}.`,
      });

      console.log(`[AQUECIMENTO-AUTO] Auto-enrolled: ${newInst.nome} (Fase ${fase}, ${diasConectado} dias)`);
    }

    // ========== GET ALL WARMING INSTANCES ==========
    const { data: instancias } = await supabase
      .from("whatsapp_aquecimento_instancias")
      .select("*")
      .in("status", ["EM_AQUECIMENTO", "AQUECIDO"]);

    if (!instancias || instancias.length < 2) {
      console.log("[AQUECIMENTO-AUTO] Menos de 2 instâncias ativas.");
      return new Response(JSON.stringify({ message: "Necessário pelo menos 2 instâncias ativas", enrolled: newInstances.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const instanciaIds = instancias.map((i: any) => i.instancia_id);
    const { data: whatsappInstances } = await supabase
      .from("user_whatsapp_instances")
      .select("id, nome, server_url, instance_token, criado_em")
      .in("id", instanciaIds);

    const instanceMap = new Map((whatsappInstances || []).map((i: any) => [i.id, i]));

    let totalEnviados = 0;
    let totalStatusPostados = 0;
    let totalContatosSalvos = 0;

    const instanciasAquecimento = instancias.filter((i: any) => i.status === "EM_AQUECIMENTO");

    // ========== GRACE PERIOD + SILENT DAY + READ-ONLY DAY + SINGLE INSTANCE PER CYCLE ==========
    const eligibleInstances = instanciasAquecimento.filter((inst: any) => {
      const instDetails = instanceMap.get(inst.instancia_id);
      if (!instDetails) return false;
      const diasConectado = Math.floor((Date.now() - new Date(instDetails.criado_em).getTime()) / 86400000);
      if (diasConectado < diasCarencia) {
        console.log(`[AQUECIMENTO-AUTO] ${instDetails.nome}: em carência (${diasConectado}/${diasCarencia} dias). Pulando.`);
        return false;
      }
      // Silent day: 20% chance of skipping entire day (messages + status + contacts)
      if (isSilentDay(inst.instancia_id, todayDateStr)) {
        console.log(`[AQUECIMENTO-AUTO] ${instDetails.nome}: dia silencioso. Pulando.`);
        return false;
      }
      // Read-only day: 15% chance — skip messages only (status/contacts still run)
      if (isReadOnlyDay(inst.instancia_id, todayDateStr)) {
        console.log(`[AQUECIMENTO-AUTO] ${instDetails.nome}: dia somente-leitura. Pulando mensagens.`);
        return false;
      }
      // Per-instance hour offset
      const offset = getInstanceHourOffset(inst.instancia_id);
      const adjustedMinute = spTime.getMinutes() + offset;
      const adjustedHour = hour + Math.floor(adjustedMinute / 60);
      if (adjustedHour < hInicio || adjustedHour >= hFim) {
        console.log(`[AQUECIMENTO-AUTO] ${instDetails.nome}: fora do horário ajustado (offset ${offset}min). Pulando.`);
        return false;
      }
      return true;
    });

    // Process only 1 random instance per cycle
    const selectedInstance = eligibleInstances.length > 0
      ? eligibleInstances[Math.floor(Math.random() * eligibleInstances.length)]
      : null;

    const instanciasToProcess = selectedInstance ? [selectedInstance] : [];

    for (const inst of instanciasToProcess) {
      const instDetails = instanceMap.get(inst.instancia_id);
      if (!instDetails) continue;

      // ========== ANTI-BAN: 30% skip chance per cycle ==========
      if (shouldSkipCycle(inst.instancia_id, minuteKey)) {
        console.log(`[AQUECIMENTO-AUTO] ${instDetails.nome}: skip aleatório (30%). Pulando.`);
        continue;
      }

      // ========== HEALTH CHECK with timeout ==========
      const cleanServerUrlCheck = instDetails.server_url.replace(/\/+$/, "");
      try {
        const healthController = new AbortController();
        const healthTimeout = setTimeout(() => healthController.abort(), 8000);
        const healthRes = await fetch(`${cleanServerUrlCheck}/instance/status`, {
          method: "GET",
          headers: { token: instDetails.instance_token },
          signal: healthController.signal,
        });
        clearTimeout(healthTimeout);
        const healthData = await healthRes.json().catch(() => ({}));
        const connected = healthData?.connected || healthData?.status === "CONNECTED" || healthData?.state === "open";
        if (!connected) {
          console.log(`[AQUECIMENTO-AUTO] ${instDetails.nome}: DESCONECTADO/BANIDO. Pausando.`);
          await supabase.from("whatsapp_aquecimento_instancias")
            .update({ status: "PAUSADO" })
            .eq("id", inst.id);
          await supabase.from("aquecimento_notificacoes").insert({
            tipo: "desconexao",
            instancia_id: inst.instancia_id,
            mensagem: `🚫 Número "${instDetails.nome || inst.instancia_id.slice(0, 8)}" está desconectado ou banido. Aquecimento pausado automaticamente.`,
          });
          continue;
        }
      } catch (healthErr) {
        console.error(`[AQUECIMENTO-AUTO] Health check falhou para ${instDetails.nome}: ${healthErr}`);
      }

      // ========== AGE-BASED PHASE CALCULATION ==========
      if (inst.fase_auto) {
        const diasConectado = Math.floor((Date.now() - new Date(instDetails.criado_em).getTime()) / 86400000);
        const faseCalculada = calcFaseByAge(diasConectado);
        const phaseConfig = PHASE_CONFIG[faseCalculada] || PHASE_CONFIG[1];

        if (faseCalculada !== inst.fase) {
          const faseAnterior = inst.fase;
          await supabase
            .from("whatsapp_aquecimento_instancias")
            .update({ fase: faseCalculada, limite_diario: phaseConfig.limite, dias_na_fase: 0 })
            .eq("id", inst.id);
          inst.fase = faseCalculada;
          inst.limite_diario = phaseConfig.limite;

          if (faseCalculada === 5) {
            await supabase.from("aquecimento_notificacoes").insert({
              tipo: "aquecido",
              instancia_id: inst.instancia_id,
              mensagem: `✅ Número "${instDetails.nome || inst.instancia_id.slice(0, 8)}" está AQUECIDO! Pronto para enviar até ${phaseConfig.limite} mensagens/dia.`,
            });
            await supabase
              .from("whatsapp_aquecimento_instancias")
              .update({ status: "AQUECIDO" })
              .eq("id", inst.id);
            console.log(`[AQUECIMENTO-AUTO] ${instDetails.nome} está AQUECIDO!`);
            continue;
          } else {
            await supabase.from("aquecimento_notificacoes").insert({
              tipo: "mudanca_fase",
              instancia_id: inst.instancia_id,
              mensagem: `📈 Número "${instDetails.nome || inst.instancia_id.slice(0, 8)}" avançou de Fase ${faseAnterior} para Fase ${faseCalculada}. Agora enviará ${phaseConfig.limite} mensagens/dia.`,
            });
          }
          console.log(`[AQUECIMENTO-AUTO] ${instDetails.nome}: Fase ${faseAnterior} → ${faseCalculada}`);
        }
      }

      // ========== RESET DAILY COUNTER ==========
      if (inst.ultima_interacao) {
        const lastDate = new Date(inst.ultima_interacao).toLocaleDateString("en-US", { timeZone: "America/Sao_Paulo" });
        const todayDate = spTime.toLocaleDateString("en-US");
        if (lastDate !== todayDate) {
          await supabase
            .from("whatsapp_aquecimento_instancias")
            .update({ interacoes_hoje: 0 })
            .eq("id", inst.id);
          inst.interacoes_hoje = 0;
        }
      }

      // ========== CHECK DAILY LIMIT (with weekend reduction) ==========
      const phaseConfig = PHASE_CONFIG[inst.fase] || PHASE_CONFIG[1];
      let limite = phaseConfig.limite;

      // Weekend reduction
      if (dayOfWeek === 6) { // Saturday
        limite = Math.max(1, Math.floor(limite * (reducaoFimSemana.sabado ?? 60) / 100));
        console.log(`[AQUECIMENTO-AUTO] ${instDetails.nome}: sábado, limite reduzido para ${limite}`);
      } else if (dayOfWeek === 0) { // Sunday
        limite = Math.max(1, Math.floor(limite * (reducaoFimSemana.domingo ?? 40) / 100));
        console.log(`[AQUECIMENTO-AUTO] ${instDetails.nome}: domingo, limite reduzido para ${limite}`);
      }

      if (inst.interacoes_hoje >= limite) {
        console.log(`[AQUECIMENTO-AUTO] ${instDetails.nome}: limite atingido (${inst.interacoes_hoje}/${limite})`);
        continue;
      }

      // ========== ANTI-BAN: Burst morning (30% of days, 8-9h, send 2-3 fast) ==========
      const isBurst = isBurstMorning(inst.instancia_id, todayDateStr);
      let burstCount = 0;
      const maxBurst = isBurst && hour >= 8 && hour < 9 ? (2 + (deterministicHash(inst.instancia_id + "burstN" + todayDateStr) % 2)) : 0;

      // If burst morning and hour 9-11, skip (post-burst cooldown)
      if (isBurst && hour >= 9 && hour < 11) {
        console.log(`[AQUECIMENTO-AUTO] ${instDetails.nome}: cooldown pós-burst matinal. Pulando.`);
        continue;
      }

      // ========== SELECT DESTINATION ==========
      const twoHoursAgo = new Date(Date.now() - 2 * 3600000).toISOString();
      const { data: recentInteractions } = await supabase
        .from("whatsapp_aquecimento_interacoes")
        .select("instancia_destino_id")
        .eq("instancia_origem_id", inst.instancia_id)
        .gte("enviado_em", twoHoursAgo);

      const recentDestinos = new Set((recentInteractions || []).map((r: any) => r.instancia_destino_id));
      
      // ========== DESTINATION FREQUENCY CAP (max 3 received/day) ==========
      const todayStartISO = new Date(new Date(spTime).setHours(0, 0, 0, 0)).toISOString();
      const possibleDestinosAll = instanciasAquecimento.filter((d: any) => d.instancia_id !== inst.instancia_id && !recentDestinos.has(d.instancia_id));
      
      const filteredDestinos: any[] = [];
      for (const d of possibleDestinosAll) {
        const { count: receivedToday } = await supabase
          .from("whatsapp_aquecimento_interacoes")
          .select("id", { count: "exact", head: true })
          .eq("instancia_destino_id", d.instancia_id)
          .eq("tipo_interacao", "mensagem")
          .gte("enviado_em", todayStartISO);
        if ((receivedToday || 0) < 3) {
          filteredDestinos.push(d);
        }
      }
      const possibleDestinos = filteredDestinos;

      if (possibleDestinos.length === 0) {
        console.log(`[AQUECIMENTO-AUTO] Sem destino disponível para ${instDetails.nome}`);
        continue;
      }

      // ========== SEND MESSAGE(S) — single or burst ==========
      const messagesToSend = maxBurst > 0 ? maxBurst : 1;

      for (let msgIdx = 0; msgIdx < messagesToSend; msgIdx++) {
        if (inst.interacoes_hoje + msgIdx >= limite) break;

        const destino = possibleDestinos[Math.floor(Math.random() * possibleDestinos.length)];
        const destinoDetails = instanceMap.get(destino.instancia_id);
        if (!destinoDetails) continue;

        // ========== SELECT DIALOGUE ==========
        const tiposPermitidos = (PHASE_CONFIG[inst.fase] || PHASE_CONFIG[1]).tipos;
        const { data: dialogos } = await supabase
          .from("whatsapp_aquecimento_dialogos")
          .select("*")
          .eq("ativo", true)
          .lte("fase_minima", inst.fase)
          .in("tipo", tiposPermitidos);

        if (!dialogos || dialogos.length === 0) {
          console.log("[AQUECIMENTO-AUTO] Sem diálogos disponíveis");
          break;
        }

        const oneDayAgo = new Date(Date.now() - 24 * 3600000).toISOString();
        const { data: recentContent } = await supabase
          .from("whatsapp_aquecimento_interacoes")
          .select("conteudo")
          .eq("instancia_origem_id", inst.instancia_id)
          .eq("instancia_destino_id", destino.instancia_id)
          .gte("enviado_em", oneDayAgo);

        const usedContent = new Set((recentContent || []).map((r: any) => r.conteudo));
        const availableDialogos = dialogos.filter((d: any) => !usedContent.has(d.conteudo));
        const dialogo = availableDialogos.length > 0
          ? availableDialogos[Math.floor(Math.random() * availableDialogos.length)]
          : dialogos[Math.floor(Math.random() * dialogos.length)];

        // ========== SEND MESSAGE ==========
        const destinoPhone = destinoDetails.nome?.match(/^\d+/)?.[0] || "";
        if (!destinoPhone) {
          console.log(`[AQUECIMENTO-AUTO] Não extrair telefone de ${destinoDetails.nome}`);
          continue;
        }

        // ========== AUTO-RECONFIGURE WEBHOOK on destination (remove wasSentByApi filter) ==========
        try {
          const destCleanBase = destinoDetails.server_url.replace(/\/+$/, "");
          const whPayload = JSON.stringify({ url: `${supabaseUrl}/functions/v1/whatsapp-chatbot`, enabled: true, events: ["messages"], excludeMessages: [] });
          const adminToken = Deno.env.get("UAZAPI_ADMIN_TOKEN") || "";
          const whAttempts = [
            { url: `${destCleanBase}/webhook/${destinoDetails.instance_token}`, headers: { "Content-Type": "application/json" } as Record<string, string> },
            { url: `${destCleanBase}/webhook`, headers: { "Content-Type": "application/json", token: destinoDetails.instance_token } as Record<string, string> },
            { url: `${destCleanBase}/globalwebhook`, headers: { "Content-Type": "application/json", admintoken: adminToken } as Record<string, string> },
          ];
          let whOk = false;
          for (const attempt of whAttempts) {
            try {
              const whRes = await fetch(attempt.url, { method: "POST", headers: attempt.headers, body: whPayload });
              if (whRes.ok) { whOk = true; console.log(`[AQUECIMENTO-AUTO] Webhook reconfigurado para ${destinoDetails.nome}`); break; }
              await whRes.text();
            } catch (_) { /* fallback */ }
          }
          if (!whOk) console.warn(`[AQUECIMENTO-AUTO] Falha ao reconfigurar webhook de ${destinoDetails.nome}`);
        } catch (whErr) {
          console.warn(`[AQUECIMENTO-AUTO] Erro webhook reconfig: ${whErr}`);
        }

        const serverUrl = instDetails.server_url;
        const token = instDetails.instance_token;

        try {
          let sendRes: Response;
          const cleanServerUrl = serverUrl.replace(/\/+$/, "");
          const destinoNumero = `55${destinoPhone}@s.whatsapp.net`;

          if (dialogo.tipo === "audio") {
            sendRes = await fetch(`${cleanServerUrl}/send/media`, {
              method: "POST",
              headers: { "Content-Type": "application/json", token },
              body: JSON.stringify({ number: destinoNumero, type: "ptt", file: dialogo.conteudo }),
            });
          } else {
            sendRes = await fetch(`${cleanServerUrl}/send/text`, {
              method: "POST",
              headers: { "Content-Type": "application/json", token },
              body: JSON.stringify({ number: destinoNumero, text: dialogo.conteudo }),
            });
          }

          const sendData = await sendRes.json().catch(() => ({}));
          console.log(`[AQUECIMENTO-AUTO] ${dialogo.tipo} enviado: ${instDetails.nome} → ${destinoDetails.nome} (${sendRes.ok})`);

          await supabase.from("whatsapp_aquecimento_interacoes").insert({
            instancia_origem_id: inst.instancia_id,
            instancia_destino_id: destino.instancia_id,
            tipo: dialogo.tipo,
            conteudo: dialogo.conteudo,
            status: sendRes.ok ? "ENVIADO" : "FALHOU",
            mensagem_id: sendData?.key?.id || null,
            enviado_em: new Date().toISOString(),
            tipo_interacao: "mensagem",
          });

          if (sendRes.ok) {
            totalEnviados++;
            burstCount++;
            await supabase
              .from("whatsapp_aquecimento_instancias")
              .update({
                interacoes_hoje: inst.interacoes_hoje + burstCount,
                interacoes_total: inst.interacoes_total + 1,
                ultima_interacao: new Date().toISOString(),
              })
              .eq("id", inst.id);
          }

          // Burst delay: 30-60s between burst messages
          if (maxBurst > 0 && msgIdx < messagesToSend - 1) {
            const burstDelay = 30 + Math.floor(Math.random() * 30);
            console.log(`[AQUECIMENTO-AUTO] Burst delay: ${burstDelay}s`);
            await new Promise(resolve => setTimeout(resolve, burstDelay * 1000));
          }
        } catch (sendErr) {
          console.error(`[AQUECIMENTO-AUTO] Erro ao enviar: ${sendErr}`);
          await supabase.from("whatsapp_aquecimento_interacoes").insert({
            instancia_origem_id: inst.instancia_id,
            instancia_destino_id: destino.instancia_id,
            tipo: dialogo.tipo,
            conteudo: dialogo.conteudo,
            status: "FALHOU",
            enviado_em: new Date().toISOString(),
            tipo_interacao: "mensagem",
          });
        }
      }
    }

    // ========== STATUS POSTING (uses dynamic Picsum images) ==========
    if (postarStatusAuto) {
      console.log("[AQUECIMENTO-AUTO] Verificando postagem de status...");
      const todayStart = new Date(spTime);
      todayStart.setHours(0, 0, 0, 0);
      const todayISO = todayStart.toISOString();

      // Select only 1 random eligible instance for status per cycle
      // Note: read-only day instances CAN post status (only messages are skipped)
      const statusEligible = instancias.filter((i: any) => {
        const d = instanceMap.get(i.instancia_id);
        if (!d) return false;
        const dias = Math.floor((Date.now() - new Date(d.criado_em).getTime()) / 86400000);
        if (dias < diasCarencia) return false;
        // Silent day skips everything including status
        if (isSilentDay(i.instancia_id, todayDateStr)) return false;
        return true;
      });
      const statusInst = statusEligible.length > 0
        ? statusEligible[Math.floor(Math.random() * statusEligible.length)]
        : null;

      for (const inst of (statusInst ? [statusInst] : [])) {
        const instDetails = instanceMap.get(inst.instancia_id);
        if (!instDetails) continue;

        const fase = inst.fase;

        const { count: statusHoje } = await supabase
          .from("whatsapp_aquecimento_status_log")
          .select("id", { count: "exact", head: true })
          .eq("instancia_id", inst.instancia_id)
          .gte("postado_em", todayISO);

        const maxStatusDia = fase >= 3 ? 2 : 1;
        if ((statusHoje || 0) >= maxStatusDia) continue;

        if (!shouldPostStatus(hour)) continue;

        let allowedStatusTypes = ["text"];
        if (fase >= 2 && statusIncluirImagens) allowedStatusTypes.push("image");
        if (fase >= 5 && statusIncluirVideos) allowedStatusTypes.push("video");

        const statusType = allowedStatusTypes[Math.floor(Math.random() * allowedStatusTypes.length)];

        const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
        const { data: recentStatusLogs } = await supabase
          .from("whatsapp_aquecimento_status_log")
          .select("conteudo, conteudo_url")
          .eq("instancia_id", inst.instancia_id)
          .gte("postado_em", sevenDaysAgo);

        const usedTexts = new Set((recentStatusLogs || []).map((s: any) => s.conteudo));

        const cleanServerUrl = instDetails.server_url.replace(/\/+$/, "");
        const token = instDetails.instance_token;

        try {
          let statusBody: any;
          let logConteudo = "";
          let logUrl = "";

          if (statusType === "text") {
            const pool = fase >= 3 ? [...STATUS_TEXTOS_FASE1, ...STATUS_TEXTOS_FASE3] : STATUS_TEXTOS_FASE1;
            const available = pool.filter(t => !usedTexts.has(t));
            const text = available.length > 0
              ? available[Math.floor(Math.random() * available.length)]
              : pool[Math.floor(Math.random() * pool.length)];

            statusBody = {
              type: "text",
              text,
              background_color: BG_COLORS[Math.floor(Math.random() * BG_COLORS.length)],
              font: FONTS[Math.floor(Math.random() * FONTS.length)],
            };
            logConteudo = text;
          } else if (statusType === "image") {
            // Dynamic image URL per instance per day (no shared fingerprint)
            const imgUrl = getStatusImageUrl(inst.instancia_id, todayDateStr, statusHoje || 0);

            const captionPool = fase >= 3 ? STATUS_TEXTOS_FASE3 : STATUS_TEXTOS_FASE1;
            const caption = captionPool[Math.floor(Math.random() * captionPool.length)];

            statusBody = { type: "image", file: imgUrl, text: caption };
            logConteudo = caption;
            logUrl = imgUrl;
          } else {
            continue;
          }

          const statusRes = await fetch(`${cleanServerUrl}/send/status`, {
            method: "POST",
            headers: { "Content-Type": "application/json", token },
            body: JSON.stringify(statusBody),
          });

          await statusRes.text();
          const resultado = statusRes.ok ? "ENVIADO" : "FALHOU";

          await supabase.from("whatsapp_aquecimento_status_log").insert({
            instancia_id: inst.instancia_id,
            tipo: statusType,
            conteudo: logConteudo,
            conteudo_url: logUrl || null,
            resultado,
          });

          await supabase.from("whatsapp_aquecimento_interacoes").insert({
            instancia_origem_id: inst.instancia_id,
            instancia_destino_id: inst.instancia_id,
            tipo: statusType,
            conteudo: logConteudo,
            status: resultado,
            enviado_em: new Date().toISOString(),
            tipo_interacao: "status",
          });

          if (statusRes.ok) {
            totalStatusPostados++;
            console.log(`[AQUECIMENTO-STATUS] ${instDetails.nome}: ${statusType} status postado`);

            const { count: totalStatus } = await supabase
              .from("whatsapp_aquecimento_status_log")
              .select("id", { count: "exact", head: true })
              .eq("instancia_id", inst.instancia_id)
              .eq("resultado", "ENVIADO");

            if (totalStatus === 1) {
              await supabase.from("aquecimento_notificacoes").insert({
                tipo: "primeiro_status",
                instancia_id: inst.instancia_id,
                mensagem: `📸 Número "${instDetails.nome || inst.instancia_id.slice(0, 8)}" postou seu primeiro status (Fase ${fase})`,
              });
            }
          } else {
            console.error(`[AQUECIMENTO-STATUS] ${instDetails.nome}: falha ao postar status`);

            const { data: recentFails } = await supabase
              .from("whatsapp_aquecimento_status_log")
              .select("resultado")
              .eq("instancia_id", inst.instancia_id)
              .order("postado_em", { ascending: false })
              .limit(3);

            if (recentFails && recentFails.length >= 3 && recentFails.every((f: any) => f.resultado === "FALHOU")) {
              await supabase.from("aquecimento_notificacoes").insert({
                tipo: "falha_status",
                instancia_id: inst.instancia_id,
                mensagem: `⚠️ Número "${instDetails.nome || inst.instancia_id.slice(0, 8)}" não consegue postar status. 3 falhas seguidas. Verificar conexão.`,
              });
            }
          }
        } catch (statusErr) {
          console.error(`[AQUECIMENTO-STATUS] Erro: ${statusErr}`);
        }
      }
    }

    // ========== CONTACT SAVING (1 random instance per cycle) ==========
    if (salvarContatosAuto) {
      console.log("[AQUECIMENTO-AUTO] Verificando contatos para salvar...");

      const contactEligible = instancias.filter((i: any) => {
        const d = instanceMap.get(i.instancia_id);
        if (!d) return false;
        if (isSilentDay(i.instancia_id, todayDateStr)) return false;
        return true;
      });
      const contactInst = contactEligible.length > 0
        ? contactEligible[Math.floor(Math.random() * contactEligible.length)]
        : null;

      for (const inst of (contactInst ? [contactInst] : [])) {
        const instDetails = instanceMap.get(inst.instancia_id);
        if (!instDetails) continue;

        const cleanServerUrl = instDetails.server_url.replace(/\/+$/, "");
        const token = instDetails.instance_token;

        // Fallback: use recent warming interaction partners as contacts to save
        const twoHoursAgo = new Date(Date.now() - 2 * 3600000).toISOString();
        
        // Try whatsapp_contatos first
        const { data: recentContatos } = await supabase
          .from("whatsapp_contatos" as any)
          .select("telefone")
          .eq("instancia_id", inst.instancia_id)
          .gte("criado_em", twoHoursAgo);

        // Fallback: use recent interaction destinations
        let phonesToSave: string[] = [];
        if (recentContatos && recentContatos.length > 0) {
          phonesToSave = (recentContatos as any[]).slice(0, 3).map((c: any) => c.telefone?.replace(/\D/g, "") || "").filter((p: string) => p.length >= 10);
        } else {
          // Fallback: get phone numbers from recent warming interaction partners
          const { data: recentPartners } = await supabase
            .from("whatsapp_aquecimento_interacoes")
            .select("instancia_destino_id")
            .eq("instancia_origem_id", inst.instancia_id)
            .eq("tipo_interacao", "mensagem")
            .eq("status", "ENVIADO")
            .gte("enviado_em", twoHoursAgo)
            .limit(3);
          
          if (recentPartners && recentPartners.length > 0) {
            for (const partner of recentPartners) {
              const partnerDetails = instanceMap.get(partner.instancia_destino_id);
              if (partnerDetails) {
                const phone = partnerDetails.nome?.match(/^\d+/)?.[0] || "";
                if (phone.length >= 10) phonesToSave.push(phone);
              }
            }
          }
        }

        if (phonesToSave.length === 0) continue;

        let savedCount = 0;
        for (const phone of phonesToSave) {
          try {
            const addRes = await fetch(`${cleanServerUrl}/contact/add`, {
              method: "POST",
              headers: { "Content-Type": "application/json", token },
              body: JSON.stringify({ number: phone, name: phone }),
            });

            await addRes.text();

            if (addRes.ok) {
              savedCount++;
              totalContatosSalvos++;

              await supabase.from("whatsapp_aquecimento_interacoes").insert({
                instancia_origem_id: inst.instancia_id,
                instancia_destino_id: inst.instancia_id,
                tipo: "contato",
                conteudo: `Contato ${phone} salvo na agenda`,
                status: "ENVIADO",
                enviado_em: new Date().toISOString(),
                tipo_interacao: "contato_salvo",
              });
            }
          } catch (contactErr) {
            console.error(`[AQUECIMENTO-CONTATO] Erro: ${contactErr}`);
          }
        }

        if (savedCount > 0) {
          console.log(`[AQUECIMENTO-CONTATO] ${instDetails.nome}: ${savedCount} contatos salvos`);

          const { count: totalContatos } = await supabase
            .from("whatsapp_aquecimento_interacoes")
            .select("id", { count: "exact", head: true })
            .eq("instancia_origem_id", inst.instancia_id)
            .eq("tipo_interacao", "contato_salvo");

          if (totalContatos && totalContatos >= 50 && totalContatos < 53) {
            await supabase.from("aquecimento_notificacoes").insert({
              tipo: "marco_contatos",
              instancia_id: inst.instancia_id,
              mensagem: `📇 Número "${instDetails.nome || inst.instancia_id.slice(0, 8)}" já salvou ${totalContatos} contatos durante o aquecimento`,
            });
          }
        }
      }
    }

    // ========== FAILURE RATE CHECK ==========
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
    const { data: lastHourInteracoes } = await supabase
      .from("whatsapp_aquecimento_interacoes")
      .select("status")
      .eq("tipo_interacao", "mensagem")
      .gte("enviado_em", oneHourAgo);

    if (lastHourInteracoes && lastHourInteracoes.length > 10) {
      const falhas = lastHourInteracoes.filter((i: any) => i.status === "FALHOU").length;
      const taxaFalha = falhas / lastHourInteracoes.length;
      if (taxaFalha > 0.15) {
        console.log(`[AQUECIMENTO-AUTO] Taxa de falha alta (${Math.round(taxaFalha * 100)}%). Pausando.`);
        await supabase
          .from("whatsapp_aquecimento_instancias")
          .update({ status: "PAUSADO" })
          .eq("status", "EM_AQUECIMENTO");

        await supabase.from("aquecimento_notificacoes").insert({
          tipo: "risco_bloqueio",
          mensagem: `⚠️ Taxa de falha ${Math.round(taxaFalha * 100)}% na última hora. Todos os números foram pausados automaticamente.`,
        });
      }
    }

    console.log(`[AQUECIMENTO-AUTO] Ciclo concluído. ${totalEnviados} msgs, ${totalStatusPostados} status, ${totalContatosSalvos} contatos, ${newInstances.length} novos.`);
    return new Response(JSON.stringify({
      success: true,
      enviados: totalEnviados,
      status_postados: totalStatusPostados,
      contatos_salvos: totalContatosSalvos,
      novos: newInstances.length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[AQUECIMENTO-AUTO] Erro:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

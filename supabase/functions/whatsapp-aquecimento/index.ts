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

// ========== STATUS CONTENT POOLS (expanded for anti-fingerprint) ==========
const STATUS_TEXTOS_FASE1 = [
  "Bom dia! 🌞", "Ótimo dia para todos!", "Boa noite! 🌙",
  "Final de semana chegando! 🎉", "Mais um dia produtivo pela frente! 💪",
  "Que a semana seja incrível! ✨", "Bom dia, pessoal! ☀️",
  "Boa tarde! 🌤️", "Desejando um ótimo dia a todos! 🙏",
  "Que Deus abençoe nosso dia! 🙌",
  "Começando mais uma semana com energia! ⚡", "Boa noite e bons sonhos! 💤",
  "Vamos que vamos! 🚀", "Feliz dia! 😊", "Gratidão por mais um dia! 🌻",
  // Expanded pool
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
  // Expanded pool
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

const STATUS_IMAGENS = [
  "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&q=80",
  "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800&q=80",
  "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80",
  "https://images.unsplash.com/photo-1497935586351-b67a49e012bf?w=800&q=80",
  "https://images.unsplash.com/photo-1504198453319-5ce911bafcde?w=800&q=80",
  "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800&q=80",
  "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=800&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80",
  "https://images.unsplash.com/photo-1518173946687-a1e13f60320e?w=800&q=80",
  "https://images.unsplash.com/photo-1497436072909-60f360e1d4b1?w=800&q=80",
  "https://images.unsplash.com/photo-1540206395-68808572332f?w=800&q=80",
  "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800&q=80",
  "https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=800&q=80",
  "https://images.unsplash.com/photo-1433086966358-54859d0ed716?w=800&q=80",
  "https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=800&q=80",
  // Expanded pool — diversified categories to reduce fingerprint
  "https://images.unsplash.com/photo-1542281286-9e0a16bb7366?w=800&q=80",
  "https://images.unsplash.com/photo-1532274402911-5a369e4c4bb5?w=800&q=80",
  "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=800&q=80",
  "https://images.unsplash.com/photo-1475924156734-496f6cac6ec1?w=800&q=80",
  "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&q=80",
  "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80",
  "https://images.unsplash.com/photo-1494500764479-0c8f2919a3d8?w=800&q=80",
  "https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?w=800&q=80",
  "https://images.unsplash.com/photo-1490750967868-88aa4f44baee?w=800&q=80",
  "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=800&q=80",
  "https://images.unsplash.com/photo-1476610182048-b716b8518aae?w=800&q=80",
  "https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?w=800&q=80",
  "https://images.unsplash.com/photo-1439853949127-fa647821eba0?w=800&q=80",
  "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800&q=80",
  "https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=800&q=80",
];

const BG_COLORS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
const FONTS = [1, 2, 3, 4, 5];

function isWithinStatusHours(hour: number): boolean {
  return hour >= 7 && hour < 21;
}

function shouldPostStatus(hour: number): boolean {
  if (!isWithinStatusHours(hour)) return false;
  const rand = Math.random();
  if (hour >= 8 && hour < 12) return rand < 0.035;
  if (hour >= 12 && hour < 18) return rand < 0.035;
  if (hour >= 18 && hour < 21) return rand < 0.02;
  return rand < 0.01;
}

// Deterministic "silent day" check: 20% chance per instance per day
function isSilentDay(instanceId: string, dateStr: string): boolean {
  let hash = 0;
  const seed = instanceId + dateStr;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  return (Math.abs(hash) % 100) < 20; // 20% chance
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    console.log("[AQUECIMENTO-AUTO] Iniciando ciclo automático...");

    const now = new Date();
    const spTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const hour = spTime.getHours();
    const dayOfWeek = spTime.getDay();
    const todayDateStr = spTime.toISOString().slice(0, 10); // YYYY-MM-DD for silent day seed

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

    // Helper: generate a deterministic offset ±60min from instance ID
    function getInstanceHourOffset(instanceId: string): number {
      let hash = 0;
      for (let i = 0; i < instanceId.length; i++) {
        hash = ((hash << 5) - hash) + instanceId.charCodeAt(i);
        hash |= 0;
      }
      return (Math.abs(hash) % 121) - 60;
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

    // ========== GRACE PERIOD + SILENT DAY + SINGLE INSTANCE PER CYCLE ==========
    const eligibleInstances = instanciasAquecimento.filter((inst: any) => {
      const instDetails = instanceMap.get(inst.instancia_id);
      if (!instDetails) return false;
      const diasConectado = Math.floor((Date.now() - new Date(instDetails.criado_em).getTime()) / 86400000);
      if (diasConectado < diasCarencia) {
        console.log(`[AQUECIMENTO-AUTO] ${instDetails.nome}: em carência (${diasConectado}/${diasCarencia} dias). Pulando.`);
        return false;
      }
      // Silent day: 20% chance of skipping entire day
      if (isSilentDay(inst.instancia_id, todayDateStr)) {
        console.log(`[AQUECIMENTO-AUTO] ${instDetails.nome}: dia silencioso. Pulando.`);
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
        // Continue anyway — network/timeout error doesn't mean banned
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

      // ========== CHECK DAILY LIMIT ==========
      const phaseConfig = PHASE_CONFIG[inst.fase] || PHASE_CONFIG[1];
      const limite = phaseConfig.limite;
      if (inst.interacoes_hoje >= limite) {
        console.log(`[AQUECIMENTO-AUTO] ${instDetails.nome}: limite atingido (${inst.interacoes_hoje}/${limite})`);
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

      const destino = possibleDestinos[Math.floor(Math.random() * possibleDestinos.length)];
      const destinoDetails = instanceMap.get(destino.instancia_id);
      if (!destinoDetails) continue;

      // ========== SELECT DIALOGUE ==========
      const tiposPermitidos = phaseConfig.tipos;
      const { data: dialogos } = await supabase
        .from("whatsapp_aquecimento_dialogos")
        .select("*")
        .eq("ativo", true)
        .lte("fase_minima", inst.fase)
        .in("tipo", tiposPermitidos);

      if (!dialogos || dialogos.length === 0) {
        console.log("[AQUECIMENTO-AUTO] Sem diálogos disponíveis");
        continue;
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
          await supabase
            .from("whatsapp_aquecimento_instancias")
            .update({
              interacoes_hoje: inst.interacoes_hoje + 1,
              interacoes_total: inst.interacoes_total + 1,
              ultima_interacao: new Date().toISOString(),
            })
            .eq("id", inst.id);
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

    // ========== STATUS POSTING ==========
    if (postarStatusAuto) {
      console.log("[AQUECIMENTO-AUTO] Verificando postagem de status...");
      const todayStart = new Date(spTime);
      todayStart.setHours(0, 0, 0, 0);
      const todayISO = todayStart.toISOString();

      // Select only 1 random eligible instance for status per cycle (anti-burst)
      const statusEligible = instancias.filter((i: any) => {
        const d = instanceMap.get(i.instancia_id);
        if (!d) return false;
        const dias = Math.floor((Date.now() - new Date(d.criado_em).getTime()) / 86400000);
        if (dias < diasCarencia) return false;
        // Silent day also skips status
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

        const phaseConfig = PHASE_CONFIG[fase] || PHASE_CONFIG[1];
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
        const usedUrls = new Set((recentStatusLogs || []).map((s: any) => s.conteudo_url));

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
            const availableImgs = STATUS_IMAGENS.filter(u => !usedUrls.has(u));
            const imgUrl = availableImgs.length > 0
              ? availableImgs[Math.floor(Math.random() * availableImgs.length)]
              : STATUS_IMAGENS[Math.floor(Math.random() * STATUS_IMAGENS.length)];

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

      // Select only 1 random instance for contact saving (same anti-burst logic)
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

        const twoHoursAgo = new Date(Date.now() - 2 * 3600000).toISOString();
        const { data: recentContatos } = await supabase
          .from("whatsapp_contatos")
          .select("telefone")
          .eq("instancia_id", inst.instancia_id)
          .gte("criado_em", twoHoursAgo);

        if (!recentContatos || recentContatos.length === 0) continue;

        let savedCount = 0;
        for (const contato of recentContatos.slice(0, 3)) {
          const phone = contato.telefone?.replace(/\D/g, "") || "";
          if (!phone || phone.length < 10) continue;

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

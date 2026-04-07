import { createClient } from "https://esm.sh/@supabase/supabase-js@2.88.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Phase config: limits and allowed types per phase (age-based)
const PHASE_CONFIG: Record<number, { limite: number; tipos: string[] }> = {
  1: { limite: 3, tipos: ["texto"] },
  2: { limite: 10, tipos: ["texto", "audio"] },
  3: { limite: 20, tipos: ["texto", "audio"] },
  4: { limite: 30, tipos: ["texto", "audio"] },
  5: { limite: 50, tipos: ["texto", "audio"] },
};

function calcFaseByAge(diasConectado: number): number {
  if (diasConectado < 7) return 1;
  if (diasConectado < 14) return 2;
  if (diasConectado < 21) return 3;
  if (diasConectado < 28) return 4;
  return 5;
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

    // Check business hours (São Paulo timezone)
    const now = new Date();
    const spTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const hour = spTime.getHours();
    const dayOfWeek = spTime.getDay();

    // Load config
    const { data: configRows } = await supabase.from("whatsapp_aquecimento_config").select("*");
    const config: Record<string, any> = {};
    (configRows || []).forEach((c: any) => { config[c.chave] = c.valor; });

    // Admin user filter - only process instances belonging to this user
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

    if (hour < hInicio || hour >= hFim) {
      console.log(`[AQUECIMENTO-AUTO] Fora do horário comercial (${hour}h). Pulando.`);
      return new Response(JSON.stringify({ message: "Fora do horário comercial" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!diasAtivos.includes(dayOfWeek)) {
      console.log(`[AQUECIMENTO-AUTO] Dia ${dayOfWeek} não é ativo. Pulando.`);
      return new Response(JSON.stringify({ message: "Dia não ativo" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ========== AUTO-ENROLLMENT ==========
    // Find active instances NOT yet in aquecimento table
    const { data: allActiveInstances } = await supabase
      .from("user_whatsapp_instances")
      .select("id, nome, server_url, instance_token, criado_em, ativo")
      .eq("ativo", true);

    const { data: existingAquecimento } = await supabase
      .from("whatsapp_aquecimento_instancias")
      .select("instancia_id");

    const existingIds = new Set((existingAquecimento || []).map((e: any) => e.instancia_id));
    const newInstances = (allActiveInstances || []).filter((i: any) => !existingIds.has(i.id));

    for (const newInst of newInstances) {
      const diasConectado = Math.floor((Date.now() - new Date(newInst.criado_em).getTime()) / 86400000);
      const fase = calcFaseByAge(diasConectado);
      const phaseConfig = PHASE_CONFIG[fase] || PHASE_CONFIG[1];

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

      // Notify
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
      .eq("status", "EM_AQUECIMENTO");

    if (!instancias || instancias.length < 2) {
      console.log("[AQUECIMENTO-AUTO] Menos de 2 instâncias ativas.");
      return new Response(JSON.stringify({ message: "Necessário pelo menos 2 instâncias ativas", enrolled: newInstances.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Load instance details
    const instanciaIds = instancias.map((i: any) => i.instancia_id);
    const { data: whatsappInstances } = await supabase
      .from("user_whatsapp_instances")
      .select("id, nome, server_url, instance_token, criado_em")
      .in("id", instanciaIds);

    const instanceMap = new Map((whatsappInstances || []).map((i: any) => [i.id, i]));

    let totalEnviados = 0;

    for (const inst of instancias) {
      const instDetails = instanceMap.get(inst.instancia_id);
      if (!instDetails) continue;

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

          // Notify phase change
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
            continue; // Don't send more messages for this instance
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

      // ========== SELECT DESTINATION (not interacted in last 2h) ==========
      const twoHoursAgo = new Date(Date.now() - 2 * 3600000).toISOString();
      const { data: recentInteractions } = await supabase
        .from("whatsapp_aquecimento_interacoes")
        .select("instancia_destino_id")
        .eq("instancia_origem_id", inst.instancia_id)
        .gte("enviado_em", twoHoursAgo);

      const recentDestinos = new Set((recentInteractions || []).map((r: any) => r.instancia_destino_id));
      const possibleDestinos = instancias.filter((d: any) => d.instancia_id !== inst.instancia_id && !recentDestinos.has(d.instancia_id));

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

      // Check content not sent to same destination recently (last 24h)
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
        : dialogos[Math.floor(Math.random() * dialogos.length)]; // fallback if all used

      // ========== SEND MESSAGE ==========
      const destinoPhone = destinoDetails.nome?.replace(/\D/g, "") || "";
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
        });
      }
    }

    // ========== FAILURE RATE CHECK ==========
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
    const { data: lastHourInteracoes } = await supabase
      .from("whatsapp_aquecimento_interacoes")
      .select("status")
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

    console.log(`[AQUECIMENTO-AUTO] Ciclo concluído. ${totalEnviados} mensagens, ${newInstances.length} novos números.`);
    return new Response(JSON.stringify({ success: true, enviados: totalEnviados, novos: newInstances.length }), {
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

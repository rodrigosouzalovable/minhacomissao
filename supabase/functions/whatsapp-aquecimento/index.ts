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
    console.log("[AQUECIMENTO] Iniciando ciclo de aquecimento...");

    // Check business hours (São Paulo timezone)
    const now = new Date();
    const spTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const hour = spTime.getHours();
    const dayOfWeek = spTime.getDay(); // 0=Sunday

    // Load config
    const { data: configRows } = await supabase.from("whatsapp_aquecimento_config").select("*");
    const config: Record<string, any> = {};
    (configRows || []).forEach((c: any) => { config[c.chave] = c.valor; });

    const horario = config.horario_comercial || { inicio: "08:00", fim: "18:00" };
    const [hInicio] = (horario.inicio || "08:00").split(":").map(Number);
    const [hFim] = (horario.fim || "18:00").split(":").map(Number);
    const diasAtivos: number[] = config.dias_ativos || [1, 2, 3, 4, 5, 6];

    if (hour < hInicio || hour >= hFim) {
      console.log(`[AQUECIMENTO] Fora do horário comercial (${hour}h). Pulando.`);
      return new Response(JSON.stringify({ message: "Fora do horário comercial" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!diasAtivos.includes(dayOfWeek)) {
      console.log(`[AQUECIMENTO] Dia da semana ${dayOfWeek} não é dia ativo. Pulando.`);
      return new Response(JSON.stringify({ message: "Dia não ativo" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get active warming instances
    const { data: instancias } = await supabase
      .from("whatsapp_aquecimento_instancias")
      .select("*")
      .eq("status", "EM_AQUECIMENTO");

    if (!instancias || instancias.length < 2) {
      console.log("[AQUECIMENTO] Menos de 2 instâncias em aquecimento. Necessário pelo menos 2.");
      return new Response(JSON.stringify({ message: "Necessário pelo menos 2 instâncias ativas" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Load instance details (server_url, instance_token)
    const instanciaIds = instancias.map((i: any) => i.instancia_id);
    const { data: whatsappInstances } = await supabase
      .from("user_whatsapp_instances")
      .select("id, nome, server_url, instance_token")
      .in("id", instanciaIds);

    const instanceMap = new Map((whatsappInstances || []).map((i: any) => [i.id, i]));

    // Load limits per phase
    const limitesPorFase = config.limites_por_fase || { fase1: 10, fase2: 15, fase3: 25, fase4: 30 };
    const diasPorFase = config.dias_por_fase || { fase1: 7, fase2: 7, fase3: 7, fase4: 7 };
    const delayConfig = config.delay_config || { min_segundos: 30, max_segundos: 180 };

    let totalEnviados = 0;

    for (const inst of instancias) {
      // Reset interacoes_hoje and increment dias_na_fase if last interaction was a different day
      if (inst.ultima_interacao) {
        const lastDate = new Date(inst.ultima_interacao).toLocaleDateString("en-US", { timeZone: "America/Sao_Paulo" });
        const todayDate = spTime.toLocaleDateString("en-US");
        if (lastDate !== todayDate) {
          await supabase
            .from("whatsapp_aquecimento_instancias")
            .update({ interacoes_hoje: 0, dias_na_fase: inst.dias_na_fase + 1 })
            .eq("id", inst.id);
          inst.interacoes_hoje = 0;
          inst.dias_na_fase = inst.dias_na_fase + 1;
        }
      }

      // Check daily limit
      const faseKey = `fase${inst.fase}`;
      const limite = limitesPorFase[faseKey] || inst.limite_diario;
      if (inst.interacoes_hoje >= limite) {
        console.log(`[AQUECIMENTO] Instância ${inst.instancia_id} atingiu limite diário (${inst.interacoes_hoje}/${limite})`);
        continue;
      }

      // Select random destination (different instance, not interacted in last 2h)
      const twoHoursAgo = new Date(Date.now() - 2 * 3600000).toISOString();
      const { data: recentInteractions } = await supabase
        .from("whatsapp_aquecimento_interacoes")
        .select("instancia_destino_id")
        .eq("instancia_origem_id", inst.instancia_id)
        .gte("enviado_em", twoHoursAgo);

      const recentDestinos = new Set((recentInteractions || []).map((r: any) => r.instancia_destino_id));
      const possibleDestinos = instancias.filter((d: any) => d.instancia_id !== inst.instancia_id && !recentDestinos.has(d.instancia_id));

      if (possibleDestinos.length === 0) {
        console.log(`[AQUECIMENTO] Sem destino disponível para ${inst.instancia_id}`);
        continue;
      }

      const destino = possibleDestinos[Math.floor(Math.random() * possibleDestinos.length)];
      const origemDetails = instanceMap.get(inst.instancia_id);
      const destinoDetails = instanceMap.get(destino.instancia_id);

      if (!origemDetails || !destinoDetails) continue;

      // Get dialogue for current phase (texto + audio for phase 2+)
      const tiposPermitidos = inst.fase >= 2 ? ["texto", "audio"] : ["texto"];
      const { data: dialogos } = await supabase
        .from("whatsapp_aquecimento_dialogos")
        .select("*")
        .eq("ativo", true)
        .lte("fase_minima", inst.fase)
        .in("tipo", tiposPermitidos);

      if (!dialogos || dialogos.length === 0) {
        console.log("[AQUECIMENTO] Sem diálogos disponíveis");
        continue;
      }

      const dialogo = dialogos[Math.floor(Math.random() * dialogos.length)];

      // Extract phone number from server_url or instance name
      // The destino phone is typically in the instance name or we need to extract from server_url
      // For UAZAPI, the phone is part of the instance configuration
      // We'll use the instance_token to send via the origin's API
      const destinoPhone = destinoDetails.nome?.replace(/\D/g, "") || "";
      if (!destinoPhone) {
        console.log(`[AQUECIMENTO] Não foi possível extrair telefone do destino ${destinoDetails.nome}`);
        continue;
      }

      // Send message via UAZAPI
      const serverUrl = origemDetails.server_url;
      const token = origemDetails.instance_token;

      try {
        const sendUrl = `${serverUrl}/send/text`;
        const sendRes = await fetch(sendUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            number: `55${destinoPhone}@s.whatsapp.net`,
            text: dialogo.conteudo,
          }),
        });

        const sendData = await sendRes.json();
        console.log(`[AQUECIMENTO] Mensagem enviada de ${origemDetails.nome} para ${destinoDetails.nome}: ${sendRes.ok}`);

        // Record interaction
        await supabase.from("whatsapp_aquecimento_interacoes").insert({
          instancia_origem_id: inst.instancia_id,
          instancia_destino_id: destino.instancia_id,
          tipo: "texto",
          conteudo: dialogo.conteudo,
          status: sendRes.ok ? "ENVIADO" : "FALHOU",
          mensagem_id: sendData?.key?.id || null,
          enviado_em: new Date().toISOString(),
        });

        // Update instance metrics
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
        console.error(`[AQUECIMENTO] Erro ao enviar: ${sendErr}`);
        await supabase.from("whatsapp_aquecimento_interacoes").insert({
          instancia_origem_id: inst.instancia_id,
          instancia_destino_id: destino.instancia_id,
          tipo: "texto",
          conteudo: dialogo.conteudo,
          status: "FALHOU",
          enviado_em: new Date().toISOString(),
        });
      }

      // Phase progression check
      const diasNecessarios = diasPorFase[faseKey] || 7;
      if (inst.dias_na_fase >= diasNecessarios && inst.fase < 4) {
        // Check response rate > 70%
        const taxaResposta = inst.interacoes_total > 0 ? inst.respostas_recebidas / inst.interacoes_total : 0;
        if (taxaResposta >= 0.7 || inst.interacoes_total < 5) {
          const novaFase = inst.fase + 1;
          const novoLimite = limitesPorFase[`fase${novaFase}`] || 30;
          await supabase
            .from("whatsapp_aquecimento_instancias")
            .update({ fase: novaFase, dias_na_fase: 0, limite_diario: novoLimite })
            .eq("id", inst.id);
          console.log(`[AQUECIMENTO] Instância ${origemDetails.nome} avançou para fase ${novaFase}`);
        }
      } else if (inst.dias_na_fase >= diasNecessarios && inst.fase >= 4) {
        await supabase
          .from("whatsapp_aquecimento_instancias")
          .update({ status: "AQUECIDO" })
          .eq("id", inst.id);
        console.log(`[AQUECIMENTO] Instância ${origemDetails.nome} marcada como AQUECIDO!`);
      }

      // Add random delay simulation (log only, actual delay between cron runs)
      const delay = Math.floor(Math.random() * (delayConfig.max_segundos - delayConfig.min_segundos) + delayConfig.min_segundos);
      console.log(`[AQUECIMENTO] Delay simulado: ${delay}s para próxima interação`);
    }

    // Check failure rate - auto-pause if > 10% failures in last hour
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
    const { data: lastHourInteracoes } = await supabase
      .from("whatsapp_aquecimento_interacoes")
      .select("status")
      .gte("enviado_em", oneHourAgo);

    if (lastHourInteracoes && lastHourInteracoes.length > 10) {
      const falhas = lastHourInteracoes.filter((i: any) => i.status === "FALHOU").length;
      const taxaFalha = falhas / lastHourInteracoes.length;
      if (taxaFalha > 0.1) {
        console.log(`[AQUECIMENTO] Taxa de falha alta (${Math.round(taxaFalha * 100)}%). Pausando todas as instâncias.`);
        await supabase
          .from("whatsapp_aquecimento_instancias")
          .update({ status: "PAUSADO" })
          .eq("status", "EM_AQUECIMENTO");
      }
    }

    console.log(`[AQUECIMENTO] Ciclo concluído. ${totalEnviados} mensagens enviadas.`);
    return new Response(JSON.stringify({ success: true, enviados: totalEnviados }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[AQUECIMENTO] Erro:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

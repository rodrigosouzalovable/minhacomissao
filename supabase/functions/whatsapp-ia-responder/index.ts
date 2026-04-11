import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FALLBACK_RESPOSTAS = [
  "Kkk verdade! 😂",
  "Sim sim, com certeza 👍",
  "Ah legal, massa!",
  "Entendi haha",
  "Boa! 🙏",
  "Aham, concordo",
  "Pois é né 😄",
  "Haha boa!",
  "Show de bola 👍",
  "Tá certo!",
  "Demais hein! 😁",
  "Kkkkk",
  "Verdade, penso igual",
  "Ah sim, faz sentido",
  "Top! 🔥",
];

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

function randomDelay(minMs: number, maxMs: number): number {
  return Math.floor(Math.random() * (maxMs - minMs)) + minMs;
}

function buildSystemPrompt(fase: number, totalTrocas: number, maxTrocas: number): string {
  const trocasRestantes = maxTrocas - totalTrocas;
  const estaFinalizando = trocasRestantes <= 3;

  let tamanhoInstrucao: string;
  if (fase <= 1) {
    tamanhoInstrucao = "Varie o tamanho: às vezes 1-3 palavras ('kkk', 'sério?', 'boa!'), às vezes 1 frase curta.";
  } else if (fase === 2) {
    tamanhoInstrucao = "Varie o tamanho: às vezes 1-3 palavras ('kkk', 'e aí?'), às vezes 1-2 frases curtas.";
  } else {
    tamanhoInstrucao = "Varie o tamanho BASTANTE: às vezes só 'kkk' ou 'sério??', às vezes 1-2 frases, raramente 3 frases.";
  }

  let instrucaoEncerramento = "";
  if (estaFinalizando) {
    if (trocasRestantes <= 1) {
      instrucaoEncerramento = `\nEsta é sua ÚLTIMA mensagem. Encerre a conversa de forma natural, como se tivesse que ir fazer algo. Exemplos: "bom, vou nessa, depois a gente se fala!", "tenho que resolver umas coisas aqui, tmj!", "vou almoçar, falo depois 👋". NÃO diga "tchau" formalmente.`;
    } else {
      instrucaoEncerramento = `\nA conversa está chegando ao fim naturalmente. Comece a dar sinais sutis de que vai sair, mas sem encerrar ainda. Exemplos: mencione que tem coisas pra fazer, diga "cara preciso ir daqui a pouco", "tô ficando sem bateria".`;
    }
  }

  return `Você é um brasileiro comum conversando no WhatsApp com um amigo/conhecido.
Responda de forma natural, informal e curta como uma pessoa real.
Use gírias brasileiras naturalmente (tipo "kkk", "kkkk", "massa", "show", "tmj", "mano", "cara", "bora", "top", "pô").
Use emojis de vez em quando (👍, 😂, 🙏, 😄, 🔥, 😎, 🤣) mas NÃO em toda mensagem.
${tamanhoInstrucao}
NÃO use formatação markdown. NÃO se apresente. NÃO seja formal. NÃO use pontuação perfeita.
Cometa pequenos "erros" naturais: abreviações (vc, tb, pq, qd, blz, vlw, ngm, td), minúsculas, sem ponto final.
Faça perguntas de vez em quando para manter a conversa fluindo ("e vc?", "e aí, como tá?", "sério? conta mais", "e o trabalho?").
Mude de assunto naturalmente às vezes, como numa conversa real.
Reaja com curiosidade ou humor ao que o outro diz.
NUNCA repita a mesma estrutura de frase duas vezes seguidas.${instrucaoEncerramento}`;
}

async function chamarIA(mensagem: string, historico: string, fase: number, totalTrocas: number, maxTrocas: number): Promise<string> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) {
    console.warn("[IA] LOVABLE_API_KEY não configurado, usando fallback");
    return FALLBACK_RESPOSTAS[Math.floor(Math.random() * FALLBACK_RESPOSTAS.length)];
  }

  const systemPrompt = buildSystemPrompt(fase, totalTrocas, maxTrocas);

  const messages: { role: string; content: string }[] = [
    { role: "system", content: systemPrompt },
  ];

  if (historico) {
    messages.push({ role: "user", content: `Histórico recente da conversa:\n${historico}` });
    messages.push({ role: "assistant", content: "Ok, entendi o contexto. Vou continuar naturalmente." });
  }

  messages.push({ role: "user", content: mensagem });

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages,
        stream: false,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[IA] Gateway retornou ${response.status}: ${errText.substring(0, 200)}`);
      return FALLBACK_RESPOSTAS[Math.floor(Math.random() * FALLBACK_RESPOSTAS.length)];
    }

    const data = await response.json();
    let resposta = (data.choices?.[0]?.message?.content || "").trim();

    resposta = resposta.replace(/^["']|["']$/g, "").trim();
    if (!resposta || resposta.length < 2) {
      return FALLBACK_RESPOSTAS[Math.floor(Math.random() * FALLBACK_RESPOSTAS.length)];
    }

    if (resposta.length > 200) {
      resposta = resposta.substring(0, 200).replace(/\s\S*$/, "");
    }

    console.log(`[IA] Resposta gerada (troca ${totalTrocas + 1}/${maxTrocas}): "${resposta}"`);
    return resposta;
  } catch (err) {
    console.error("[IA] Erro ao chamar Lovable AI Gateway:", err);
    return FALLBACK_RESPOSTAS[Math.floor(Math.random() * FALLBACK_RESPOSTAS.length)];
  }
}

async function enviarMensagemUAZAPI(serverUrl: string, instanceToken: string, numero: string, texto: string): Promise<boolean> {
  const cleanUrl = serverUrl.replace(/\/+$/, "");
  const endpoints = [`${cleanUrl}/send/text`, `${cleanUrl}/message/sendText`, `${cleanUrl}/sendText`];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", token: instanceToken },
        body: JSON.stringify({ number: numero, text: texto }),
      });
      if (res.ok) {
        await res.text();
        console.log(`[IA] ✅ Mensagem enviada para ${numero}: "${texto}"`);
        return true;
      }
      await res.text();
    } catch (e) {
      console.warn(`[IA] Endpoint ${url} falhou:`, e);
    }
  }
  console.error(`[IA] ❌ Falha ao enviar mensagem para ${numero}`);
  return false;
}

async function logToInbox(sb: any, instanciaId: string, telefoneRemoto: string, texto: string) {
  try {
    const { data: inst } = await sb
      .from("user_whatsapp_instances")
      .select("id")
      .eq("id", instanciaId)
      .single();

    if (!inst) return;

    // Clean phone number - remove @s.whatsapp.net if present
    const cleanPhone = telefoneRemoto.replace(/@s\.whatsapp\.net$/, "").replace(/\D/g, "");
    const phoneSuffix = cleanPhone.replace(/^55/, "").slice(-8);

    await sb.from("whatsapp_mensagens").insert({
      instancia_id: inst.id,
      telefone_remoto: cleanPhone,
      conteudo: texto,
      direcao: "saida",
      tipo_conteudo: "texto",
      timestamp_msg: new Date().toISOString(),
    });

    const { data: contato } = await sb
      .from("whatsapp_contatos")
      .select("id")
      .eq("instancia_id", inst.id)
      .or(`telefone.eq.${cleanPhone},telefone.ilike.%${phoneSuffix}`)
      .maybeSingle();

    if (contato) {
      await sb.from("whatsapp_contatos").update({
        ultima_mensagem: texto.slice(0, 200),
        ultima_mensagem_em: new Date().toISOString(),
      }).eq("id", contato.id);
    }
  } catch (e) {
    console.warn("[IA] Erro ao logar no inbox:", e);
  }
}

async function dispararProximaResposta(
  sb: any,
  instanciaQueResponde: string,
  instanciaQueRecebe: string,
  resposta: string,
  fase: number,
) {
  try {
    const { data: instResp } = await sb
      .from("user_whatsapp_instances")
      .select("id, server_url, instance_token")
      .eq("id", instanciaQueResponde)
      .eq("ativo", true)
      .single();

    if (!instResp) {
      console.log(`[IA] Instância ${instanciaQueResponde} não encontrada/inativa, cadeia encerrada`);
      return;
    }

    const { data: instDest } = await sb
      .from("user_whatsapp_instances")
      .select("id, server_url, instance_token")
      .eq("id", instanciaQueRecebe)
      .single();

    if (!instDest) {
      console.log(`[IA] Instância destino ${instanciaQueRecebe} não encontrada, cadeia encerrada`);
      return;
    }

    // Get phone number of the destination instance
    const { data: statusData } = await fetch(
      `${instDest.server_url.replace(/\/+$/, "")}/instance/status`,
      { headers: { token: instDest.instance_token } }
    ).then(r => r.json()).catch(() => null) || {};

    let numeroDest = "";
    if (statusData?.phoneNumber) {
      numeroDest = statusData.phoneNumber;
    } else if (statusData?.data?.phoneNumber) {
      numeroDest = statusData.data.phoneNumber;
    }

    if (!numeroDest) {
      // Fallback: try to find from recent interactions
      const { data: recentInteraction } = await sb
        .from("whatsapp_aquecimento_interacoes")
        .select("conteudo")
        .or(`instancia_origem_id.eq.${instanciaQueRecebe},instancia_destino_id.eq.${instanciaQueRecebe}`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      console.log(`[IA] Não conseguiu obter telefone da instância ${instanciaQueRecebe}, cadeia encerrada`);
      return;
    }

    // Format phone number
    if (!numeroDest.includes("@")) {
      numeroDest = numeroDest.replace(/\D/g, "");
      if (!numeroDest.startsWith("55")) numeroDest = "55" + numeroDest;
      numeroDest = numeroDest + "@s.whatsapp.net";
    }

    const delayMs = randomDelay(20000, 120000);
    console.log(`[IA] 🔄 Cadeia: ${instanciaQueResponde} vai responder a ${instanciaQueRecebe} em ${Math.round(delayMs / 1000)}s`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Fire-and-forget: trigger the next response in the chain
    fetch(`${supabaseUrl}/functions/v1/whatsapp-ia-responder`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        action: "gerar-resposta",
        mensagem: resposta,
        fase,
        instancia_origem_id: instanciaQueResponde,
        instancia_destino_id: instanciaQueRecebe,
        delay_ms: delayMs,
        server_url: instResp.server_url,
        instance_token: instResp.instance_token,
        numero_destino: numeroDest,
      }),
    }).catch(err => {
      console.error("[IA] Erro ao disparar próxima resposta na cadeia:", err);
    });
  } catch (e) {
    console.error("[IA] Erro ao preparar próxima resposta:", e);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action } = body;

    if (action === "gerar-resposta") {
      const {
        mensagem,
        historico,
        fase,
        instancia_origem_id,
        instancia_destino_id,
        delay_ms,
        server_url,
        instance_token,
        numero_destino,
      } = body;

      if (!mensagem || !instancia_origem_id || !instancia_destino_id) {
        return json({ error: "mensagem, instancia_origem_id e instancia_destino_id são obrigatórios" }, 400);
      }

      const sb = getSupabaseAdmin();
      const faseNum = fase || 1;

      const delayMs = delay_ms || 0;
      if (delayMs > 0) {
        console.log(`[IA] Aguardando ${Math.round(delayMs / 1000)}s antes de responder...`);
        await new Promise((r) => setTimeout(r, delayMs));
      }

      const conversa = await getOrCreateConversa(sb, instancia_origem_id, instancia_destino_id);

      if (!conversa) {
        return json({ responded: false, reason: "cooldown" });
      }

      if (conversa.status !== "ATIVA") {
        return json({ responded: false, reason: conversa.status });
      }

      if (conversa.total_trocas >= conversa.max_trocas) {
        // Let the AI generate a natural closing instead of using a fixed phrase
        const historicoArr = (conversa.historico || []) as Array<{ role: string; content: string }>;
        const historicoTexto = historicoArr
          .slice(-10)
          .map((m: any) => `${m.role === "enviada" ? "Eu" : "Amigo"}: ${m.content}`)
          .join("\n");

        const fraseEncerramento = await chamarIA(mensagem, historicoTexto, faseNum, conversa.total_trocas, conversa.max_trocas);
        await finalizarConversa(sb, conversa.id, mensagem, fraseEncerramento);

        if (server_url && instance_token && numero_destino) {
          await enviarMensagemUAZAPI(server_url, instance_token, numero_destino, fraseEncerramento);
          await logToInbox(sb, instancia_origem_id, numero_destino, fraseEncerramento);
        }

        console.log(`[IA] 🏁 Conversa ${conversa.id} finalizada após ${conversa.total_trocas + 1} trocas`);
        return json({ responded: true, resposta: fraseEncerramento, finalizada: true });
      }

      const historicoArr = (conversa.historico || []) as Array<{ role: string; content: string }>;
      const historicoTexto = historicoArr
        .slice(-10)
        .map((m: any) => `${m.role === "enviada" ? "Eu" : "Amigo"}: ${m.content}`)
        .join("\n");

      const resposta = await chamarIA(mensagem, historicoTexto, faseNum, conversa.total_trocas, conversa.max_trocas);

      const novoHistorico = [
        ...historicoArr,
        { role: "recebida", content: mensagem, ts: new Date().toISOString() },
        { role: "enviada", content: resposta, ts: new Date().toISOString() },
      ];

      const novaTroca = conversa.total_trocas + 1;

      await sb.from("whatsapp_conversas_ia").update({
        total_trocas: novaTroca,
        ultima_msg_em: new Date().toISOString(),
        historico: novoHistorico,
      }).eq("id", conversa.id);

      // Log the RECEIVED message to inbox (on the destination instance)
      await logToInbox(sb, instancia_destino_id, numero_destino?.replace("@s.whatsapp.net", "") || "", mensagem);

      if (server_url && instance_token && numero_destino) {
        const sent = await enviarMensagemUAZAPI(server_url, instance_token, numero_destino, resposta);
        if (sent) {
          await logToInbox(sb, instancia_origem_id, numero_destino, resposta);
        }
      }

      // Chain: if conversation is still active, trigger the other side to respond back
      if (novaTroca < conversa.max_trocas) {
        await dispararProximaResposta(
          sb,
          instancia_destino_id,  // the one who received now responds
          instancia_origem_id,   // back to the one who just sent
          resposta,
          faseNum,
        );
      } else {
        console.log(`[IA] 🏁 Conversa ${conversa.id} atingiu limite (${novaTroca}/${conversa.max_trocas}), sem próxima rodada`);
      }

      return json({ responded: true, resposta, troca: novaTroca, maxTrocas: conversa.max_trocas });
    }

    return json({ error: "Ação desconhecida" }, 400);
  } catch (err) {
    console.error("[IA-RESPONDER] Erro:", err);
    return json({ error: err.message }, 500);
  }
});

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getOrCreateConversa(sb: any, origemId: string, destinoId: string) {
  const { data: existente } = await sb
    .from("whatsapp_conversas_ia")
    .select("*")
    .or(`and(instancia_origem_id.eq.${origemId},instancia_destino_id.eq.${destinoId}),and(instancia_origem_id.eq.${destinoId},instancia_destino_id.eq.${origemId})`)
    .eq("status", "ATIVA")
    .order("inicio_em", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existente) return existente;

  const quatroHorasAtras = new Date(Date.now() - 4 * 3600000).toISOString();
  const { data: recente } = await sb
    .from("whatsapp_conversas_ia")
    .select("id, ultima_msg_em")
    .or(`and(instancia_origem_id.eq.${origemId},instancia_destino_id.eq.${destinoId}),and(instancia_origem_id.eq.${destinoId},instancia_destino_id.eq.${origemId})`)
    .in("status", ["FINALIZADA", "COOLDOWN"])
    .gte("ultima_msg_em", quatroHorasAtras)
    .limit(1)
    .maybeSingle();

  if (recente) {
    console.log(`[IA] Cooldown ativo para par ${origemId} <-> ${destinoId}`);
    return null;
  }

  const maxTrocas = 10 + Math.floor(Math.random() * 6); // 10-15 trocas
  const { data: nova, error } = await sb
    .from("whatsapp_conversas_ia")
    .insert({
      instancia_origem_id: origemId,
      instancia_destino_id: destinoId,
      max_trocas: maxTrocas,
    })
    .select()
    .single();

  if (error) {
    console.error("[IA] Erro ao criar conversa:", error);
    return null;
  }

  console.log(`[IA] Nova conversa criada: ${nova.id} (max ${maxTrocas} trocas)`);
  return nova;
}

async function finalizarConversa(sb: any, conversaId: string, ultimaMsgRecebida: string, fraseEncerramento: string) {
  const { data: conversa } = await sb
    .from("whatsapp_conversas_ia")
    .select("historico")
    .eq("id", conversaId)
    .single();

  const historicoArr = (conversa?.historico || []) as any[];
  const novoHistorico = [
    ...historicoArr,
    { role: "recebida", content: ultimaMsgRecebida, ts: new Date().toISOString() },
    { role: "enviada", content: fraseEncerramento, ts: new Date().toISOString() },
  ];

  await sb.from("whatsapp_conversas_ia").update({
    status: "FINALIZADA",
    total_trocas: historicoArr.length / 2 + 1,
    ultima_msg_em: new Date().toISOString(),
    historico: novoHistorico,
  }).eq("id", conversaId);

  console.log(`[IA] Conversa ${conversaId} finalizada`);
}

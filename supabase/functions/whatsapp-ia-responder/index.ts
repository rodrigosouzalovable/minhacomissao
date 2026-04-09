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

const FRASES_ENCERRAMENTO = [
  "Preciso ir, falo depois! 👍",
  "Vou nessa, depois a gente se fala! 😄",
  "Tenho que sair agora, tmj! 🙏",
  "Bora, depois continuo! Até mais 👋",
  "Vou resolver umas coisas aqui, já volto! 😉",
];

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

async function chamarIA(mensagem: string, historico: string, fase: number): Promise<string> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) {
    console.warn("[IA] LOVABLE_API_KEY não configurado, usando fallback");
    return FALLBACK_RESPOSTAS[Math.floor(Math.random() * FALLBACK_RESPOSTAS.length)];
  }

  const tamanhoInstrucao = fase <= 1
    ? "Responda com NO MÁXIMO 1 frase curta."
    : fase === 2
    ? "Responda com 1 a 2 frases curtas."
    : "Responda com até 2 frases.";

  const systemPrompt = `Você é um brasileiro comum conversando no WhatsApp com um amigo/conhecido.
Responda de forma natural, informal e curta.
Use gírias brasileiras ocasionalmente (tipo "kkk", "massa", "show", "tmj").
Use emojis ocasionalmente (👍, 😂, 🙏, 😄, 🔥) mas não em toda mensagem.
${tamanhoInstrucao}
NÃO use formatação markdown. NÃO se apresente. NÃO seja formal.
Apenas continue a conversa de forma natural como se fosse um amigo.`;

  const messages: { role: string; content: string }[] = [
    { role: "system", content: systemPrompt },
  ];

  if (historico) {
    messages.push({ role: "user", content: `Histórico recente da conversa:\n${historico}` });
    messages.push({ role: "assistant", content: "Ok, entendi o contexto." });
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

    console.log(`[IA] Resposta gerada via Lovable AI: "${resposta}"`);
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

    const phoneSuffix = telefoneRemoto.replace(/^55/, "");

    await sb.from("whatsapp_mensagens").insert({
      instancia_id: inst.id,
      telefone_remoto: telefoneRemoto,
      conteudo: texto,
      direcao: "saida",
      tipo_conteudo: "texto",
      timestamp_msg: new Date().toISOString(),
    });

    const { data: contato } = await sb
      .from("whatsapp_contatos")
      .select("id")
      .eq("instancia_id", inst.id)
      .or(`telefone.eq.${telefoneRemoto},telefone.ilike.%${phoneSuffix}`)
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
        const fraseEncerramento = FRASES_ENCERRAMENTO[Math.floor(Math.random() * FRASES_ENCERRAMENTO.length)];
        await finalizarConversa(sb, conversa.id, mensagem, fraseEncerramento);

        if (server_url && instance_token && numero_destino) {
          await enviarMensagemUAZAPI(server_url, instance_token, numero_destino, fraseEncerramento);
          await logToInbox(sb, instancia_origem_id, numero_destino, fraseEncerramento);
        }

        return json({ responded: true, resposta: fraseEncerramento, finalizada: true });
      }

      const historicoArr = (conversa.historico || []) as Array<{ role: string; content: string }>;
      const historicoTexto = historicoArr
        .slice(-6)
        .map((m: any) => `${m.role === "enviada" ? "Eu" : "Amigo"}: ${m.content}`)
        .join("\n");

      const resposta = await chamarIA(mensagem, historicoTexto, faseNum);

      const novoHistorico = [
        ...historicoArr,
        { role: "recebida", content: mensagem, ts: new Date().toISOString() },
        { role: "enviada", content: resposta, ts: new Date().toISOString() },
      ];

      await sb.from("whatsapp_conversas_ia").update({
        total_trocas: conversa.total_trocas + 1,
        ultima_msg_em: new Date().toISOString(),
        historico: novoHistorico,
      }).eq("id", conversa.id);

      if (server_url && instance_token && numero_destino) {
        const sent = await enviarMensagemUAZAPI(server_url, instance_token, numero_destino, resposta);
        if (sent) {
          await logToInbox(sb, instancia_origem_id, numero_destino, resposta);
        }
      }

      return json({ responded: true, resposta });
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

  const maxTrocas = 5 + Math.floor(Math.random() * 3);
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

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

async function chamarOllama(mensagem: string, historico: string, fase: number): Promise<string> {
  const ollamaUrl = Deno.env.get("OLLAMA_NGROK_URL");
  if (!ollamaUrl) {
    console.warn("[IA] OLLAMA_NGROK_URL não configurado, usando fallback");
    return FALLBACK_RESPOSTAS[Math.floor(Math.random() * FALLBACK_RESPOSTAS.length)];
  }

  const tamanhoInstrucao = fase <= 1
    ? "Responda com NO MÁXIMO 1 frase curta."
    : fase === 2
    ? "Responda com 1 a 2 frases curtas."
    : "Responda com até 2 frases.";

  const prompt = `Você é um brasileiro comum conversando no WhatsApp com um amigo/conhecido.
Responda de forma natural, informal e curta.
Use gírias brasileiras ocasionalmente (tipo "kkk", "massa", "show", "tmj").
Use emojis ocasionalmente (👍, 😂, 🙏, 😄, 🔥) mas não em toda mensagem.
${tamanhoInstrucao}
NÃO use formatação markdown. NÃO se apresente. NÃO seja formal.
Apenas continue a conversa de forma natural como se fosse um amigo.

${historico ? `Histórico recente:\n${historico}\n\n` : ""}Mensagem recebida: "${mensagem}"

Sua resposta:`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(`${ollamaUrl.replace(/\/+$/, "")}/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true",
      },
      body: JSON.stringify({
        model: "gemma4:e4b",
        prompt,
        options: { temperature: 0.9, num_predict: 100, top_p: 0.95 },
        stream: false,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[IA] Ollama retornou ${response.status}: ${errText.substring(0, 200)}`);
      return FALLBACK_RESPOSTAS[Math.floor(Math.random() * FALLBACK_RESPOSTAS.length)];
    }

    const data = await response.json();
    let resposta = (data.response || "").trim();

    // Limpar possíveis artefatos
    resposta = resposta.replace(/^["']|["']$/g, "").trim();
    if (!resposta || resposta.length < 2) {
      return FALLBACK_RESPOSTAS[Math.floor(Math.random() * FALLBACK_RESPOSTAS.length)];
    }

    // Limitar tamanho
    if (resposta.length > 200) {
      resposta = resposta.substring(0, 200).replace(/\s\S*$/, "");
    }

    console.log(`[IA] Resposta gerada: "${resposta}"`);
    return resposta;
  } catch (err) {
    console.error("[IA] Erro ao chamar Ollama:", err);
    return FALLBACK_RESPOSTAS[Math.floor(Math.random() * FALLBACK_RESPOSTAS.length)];
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
      const { mensagem, historico, fase, instancia_origem_id, instancia_destino_id } = body;

      if (!mensagem || !instancia_origem_id || !instancia_destino_id) {
        return json({ error: "mensagem, instancia_origem_id e instancia_destino_id são obrigatórios" }, 400);
      }

      const sb = getSupabaseAdmin();
      const faseNum = fase || 1;

      // Verificar/criar conversa IA
      const conversa = await getOrCreateConversa(sb, instancia_origem_id, instancia_destino_id);

      if (!conversa) {
        return json({ responded: false, reason: "cooldown" });
      }

      if (conversa.status !== "ATIVA") {
        return json({ responded: false, reason: conversa.status });
      }

      // Verificar se atingiu limite de trocas
      if (conversa.total_trocas >= conversa.max_trocas) {
        // Enviar frase de encerramento e finalizar
        const fraseEncerramento = FRASES_ENCERRAMENTO[Math.floor(Math.random() * FRASES_ENCERRAMENTO.length)];
        await finalizarConversa(sb, conversa.id, mensagem, fraseEncerramento);
        return json({ responded: true, resposta: fraseEncerramento, finalizada: true });
      }

      // Montar histórico da conversa
      const historicoArr = (conversa.historico || []) as Array<{ role: string; content: string }>;
      const historicoTexto = historicoArr
        .slice(-6)
        .map((m: any) => `${m.role === "enviada" ? "Eu" : "Amigo"}: ${m.content}`)
        .join("\n");

      // Gerar resposta via Ollama
      const resposta = await chamarOllama(mensagem, historicoTexto, faseNum);

      // Atualizar conversa
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
  // Procurar conversa ativa (em qualquer direção do par)
  const { data: existente } = await sb
    .from("whatsapp_conversas_ia")
    .select("*")
    .or(`and(instancia_origem_id.eq.${origemId},instancia_destino_id.eq.${destinoId}),and(instancia_origem_id.eq.${destinoId},instancia_destino_id.eq.${origemId})`)
    .eq("status", "ATIVA")
    .order("inicio_em", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existente) return existente;

  // Verificar cooldown (4h) - buscar última conversa finalizada entre este par
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

  // Criar nova conversa com max_trocas aleatório entre 5-7
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

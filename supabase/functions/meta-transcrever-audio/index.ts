import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Limite de 30 segundos de áudio. Quando o WhatsApp informa a duração usamos ela;
// caso contrário estimamos por tamanho (voz OGG/Opus fica em torno de 4-8 KB/s).
const MAX_SEGUNDOS = 30;
const MAX_BYTES = 320_000;

const MODELO_TRANSCRICAO = "google/gemini-3.6-flash";

const EXT_FORMAT: Record<string, string> = {
  ogg: "ogg", oga: "ogg", opus: "ogg", mp3: "mp3", mpeg: "mp3",
  m4a: "m4a", mp4: "m4a", aac: "aac", wav: "wav", webm: "webm", amr: "ogg",
};

function detectarFormato(url: string, mime?: string | null): string {
  const m = String(mime || "").toLowerCase().split("/")[1]?.split(";")[0];
  if (m && EXT_FORMAT[m]) return EXT_FORMAT[m];
  const ext = String(url).split("?")[0].split(".").pop()?.toLowerCase() || "";
  return EXT_FORMAT[ext] || "ogg";
}

function toBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const t0 = Date.now();
  let mensagemId = "";
  let admin: any = null;

  const marcarStatus = async (status: string) => {
    if (!admin || !mensagemId) return;
    const { error } = await admin.from("meta_whatsapp_mensagens")
      .update({ transcricao_status: status }).eq("id", mensagemId);
    if (error) console.error("[transcrever-audio] falha ao gravar status", status, error.message);
  };

  try {
    const body = await req.json().catch(() => ({}));
    mensagemId = String((body as any)?.mensagem_id || "").trim();
    const duracaoInformada = Number((body as any)?.duracao_segundos || 0) || 0;
    if (!mensagemId) return json({ error: "mensagem_id é obrigatório" }, 400);

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) return json({ error: "não autenticado" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    // Client com o token de quem chamou: usuário passa pela RLS, webhook usa service role.
    const caller = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    console.log("[transcrever-audio] início", { mensagem_id: mensagemId, duracao_segundos: duracaoInformada || null });

    const { data: msg, error: msgErr } = await caller
      .from("meta_whatsapp_mensagens")
      .select("id, media_url, tipo_conteudo, conteudo, transcricao, transcricao_status")
      .eq("id", mensagemId)
      .maybeSingle();

    if (msgErr) return json({ error: msgErr.message }, 403);
    if (!msg) return json({ error: "mensagem não encontrada ou sem acesso" }, 404);

    // Idempotente: já transcrita, devolve o que está salvo.
    if (msg.transcricao) {
      return json({ ok: true, cached: true, transcricao: msg.transcricao });
    }
    if (msg.tipo_conteudo !== "audio") {
      return json({ error: "mensagem não é de áudio" }, 400);
    }
    if (!msg.media_url) {
      await marcarStatus("erro");
      return json({ error: "áudio indisponível (mídia expirada)" }, 410);
    }

    // Corte por duração antes mesmo de baixar o áudio.
    if (duracaoInformada > MAX_SEGUNDOS) {
      console.log("[transcrever-audio] áudio acima do limite (duração)", { duracaoInformada });
      await marcarStatus("muito_longo");
      return json({ error: "áudio maior que 30 segundos", motivo: "muito_longo", duracao_segundos: duracaoInformada }, 413);
    }

    const audioRes = await fetch(msg.media_url);
    if (!audioRes.ok) {
      console.error("[transcrever-audio] download falhou", audioRes.status);
      await marcarStatus("erro");
      return json({ error: `áudio indisponível (${audioRes.status})` }, 410);
    }
    const bytes = new Uint8Array(await audioRes.arrayBuffer());
    const format = detectarFormato(msg.media_url, audioRes.headers.get("content-type"));
    console.log("[transcrever-audio] mídia baixada", { bytes: bytes.length, format, ms: Date.now() - t0 });

    if (bytes.length === 0) {
      await marcarStatus("erro");
      return json({ error: "áudio vazio" }, 422);
    }
    if (bytes.length > MAX_BYTES) {
      console.log("[transcrever-audio] áudio acima do limite (tamanho)", { bytes: bytes.length });
      await marcarStatus("muito_longo");
      return json({ error: "áudio maior que 30 segundos", motivo: "muito_longo", bytes: bytes.length }, 413);
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      await marcarStatus("erro");
      return json({ error: "LOVABLE_API_KEY não configurada" }, 500);
    }

    const payload = {
      model: MODELO_TRANSCRICAO,
      messages: [
        {
          role: "system",
          content:
            "Você transcreve áudios de clientes em português do Brasil. Responda APENAS com o texto falado, sem comentários, sem aspas e sem formatação. Se não houver fala audível, responda exatamente: SEM_FALA",
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Transcreva este áudio:" },
            { type: "input_audio", input_audio: { data: toBase64(bytes), format } },
          ],
        },
      ],
    };

    // Uma tentativa extra para falhas temporárias (429 / 5xx / rede).
    let aiRes: Response | null = null;
    let ultimoErro = "";
    for (let tentativa = 1; tentativa <= 2; tentativa++) {
      try {
        const tAI = Date.now();
        aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
        console.log("[transcrever-audio] resposta do gateway", {
          tentativa, status: aiRes.status, ms: Date.now() - tAI,
        });
        if (aiRes.ok) break;
        if (aiRes.status !== 429 && aiRes.status < 500) break;
        ultimoErro = `status ${aiRes.status}`;
      } catch (e: any) {
        ultimoErro = e?.message || "falha de rede";
        console.error("[transcrever-audio] exceção na chamada de IA", { tentativa, erro: ultimoErro });
        aiRes = null;
      }
      if (tentativa === 1) await sleep(1500);
    }

    if (!aiRes) {
      await marcarStatus("erro");
      return json({ error: "Falha ao transcrever o áudio.", details: ultimoErro }, 502);
    }

    if (!aiRes.ok) {
      const detalhe = await aiRes.text().catch(() => "");
      console.error("[transcrever-audio] gateway erro", aiRes.status, detalhe.slice(0, 500));
      await marcarStatus("erro");
      const msgErro = aiRes.status === 429
        ? "Muitas requisições de IA. Tente novamente em alguns segundos."
        : aiRes.status === 402
          ? "Créditos de IA esgotados."
          : "Falha ao transcrever o áudio.";
      return json({ error: msgErro, status: aiRes.status, details: detalhe }, aiRes.status);
    }

    const result = await aiRes.json();
    const texto = String(result?.choices?.[0]?.message?.content || "").trim();

    if (!texto || /^sem_fala$/i.test(texto)) {
      console.log("[transcrever-audio] sem fala audível", { mensagem_id: mensagemId });
      await marcarStatus("erro");
      return json({ error: "não foi possível entender o áudio" }, 422);
    }

    const { error: upErr } = await admin
      .from("meta_whatsapp_mensagens")
      .update({
        transcricao: texto,
        transcricao_status: "ok",
        conteudo: `🎤 ${texto}`,
      })
      .eq("id", mensagemId);
    if (upErr) console.error("[transcrever-audio] falha ao salvar", upErr.message);

    console.log("[transcrever-audio] concluído", {
      mensagem_id: mensagemId, caracteres: texto.length, ms: Date.now() - t0,
    });
    return json({ ok: true, transcricao: texto });
  } catch (e) {
    const message = e instanceof Error ? e.message : "erro inesperado";
    console.error("[transcrever-audio] exceção", message);
    await marcarStatus("erro");
    return json({ error: message }, 500);
  }
});

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

// Áudio de ~3 min em OGG/Opus fica em torno de 500 KB. Acima disso não transcrevemos
// para não estourar custo de IA com áudios muito longos.
const MAX_BYTES = 1_500_000;

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const mensagemId = String((body as any)?.mensagem_id || "").trim();
    if (!mensagemId) return json({ error: "mensagem_id é obrigatório" }, 400);

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) return json({ error: "não autenticado" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    // Client com o token de quem chamou: usuário passa pela RLS, webhook usa service role.
    const caller = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

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
      await admin.from("meta_whatsapp_mensagens")
        .update({ transcricao_status: "erro" }).eq("id", mensagemId);
      return json({ error: "áudio indisponível (mídia expirada)" }, 410);
    }

    const audioRes = await fetch(msg.media_url);
    if (!audioRes.ok) {
      await admin.from("meta_whatsapp_mensagens")
        .update({ transcricao_status: "erro" }).eq("id", mensagemId);
      return json({ error: `áudio indisponível (${audioRes.status})` }, 410);
    }
    const bytes = new Uint8Array(await audioRes.arrayBuffer());
    if (bytes.length === 0) {
      await admin.from("meta_whatsapp_mensagens")
        .update({ transcricao_status: "erro" }).eq("id", mensagemId);
      return json({ error: "áudio vazio" }, 422);
    }
    if (bytes.length > MAX_BYTES) {
      await admin.from("meta_whatsapp_mensagens")
        .update({ transcricao_status: "erro" }).eq("id", mensagemId);
      return json({ error: "áudio muito longo para transcrição automática" }, 413);
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY não configurada" }, 500);

    const format = detectarFormato(msg.media_url, audioRes.headers.get("content-type"));

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
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
      }),
    });

    if (!aiRes.ok) {
      const detalhe = await aiRes.text().catch(() => "");
      console.error("[transcrever-audio] gateway erro", aiRes.status, detalhe);
      await admin.from("meta_whatsapp_mensagens")
        .update({ transcricao_status: "erro" }).eq("id", mensagemId);
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
      await admin.from("meta_whatsapp_mensagens")
        .update({ transcricao_status: "erro" }).eq("id", mensagemId);
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

    return json({ ok: true, transcricao: texto });
  } catch (e) {
    const message = e instanceof Error ? e.message : "erro inesperado";
    console.error("[transcrever-audio] exceção", message);
    return json({ error: message }, 500);
  }
});

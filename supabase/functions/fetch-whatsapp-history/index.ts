import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { server_url, instance_token, instancia_id, telefone } = await req.json();

    if (!server_url || !instance_token || !instancia_id || !telefone) {
      return new Response(
        JSON.stringify({ error: "Parâmetros obrigatórios: server_url, instance_token, instancia_id, telefone" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cleanUrl = server_url.replace(/\/+$/, '');
    const chatId = `${telefone}@s.whatsapp.net`;

    // Try multiple endpoint patterns for UAZAPI
    const endpoints = [
      { url: `${cleanUrl}/chat/getMessages`, body: { id: chatId, count: 50 } },
      { url: `${cleanUrl}/chat/getMessages`, body: { phone: chatId, count: 50 } },
      { url: `${cleanUrl}/chat/getMessages/${instance_token}`, body: { id: chatId, count: 50 }, noHeader: true },
    ];

    let messages: any[] | null = null;
    let lastError = "";

    for (const ep of endpoints) {
      try {
        console.log(`Trying endpoint: ${ep.url}`);
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (!ep.noHeader) {
          headers["token"] = instance_token;
        }

        const uazapiRes = await fetch(ep.url, {
          method: "POST",
          headers,
          body: JSON.stringify(ep.body),
        });

        const text = await uazapiRes.text();
        console.log(`Response from ${ep.url}: status=${uazapiRes.status}, length=${text.length}`);

        if (uazapiRes.ok) {
          let parsed;
          try { parsed = JSON.parse(text); } catch { parsed = null; }

          if (Array.isArray(parsed)) {
            messages = parsed;
            break;
          } else if (parsed?.messages && Array.isArray(parsed.messages)) {
            messages = parsed.messages;
            break;
          } else if (parsed?.data && Array.isArray(parsed.data)) {
            messages = parsed.data;
            break;
          }
          console.log(`Endpoint OK but unexpected format:`, JSON.stringify(parsed).substring(0, 200));
        } else {
          lastError = `${uazapiRes.status}: ${text.substring(0, 200)}`;
          console.log(`Endpoint failed: ${lastError}`);
        }
      } catch (e) {
        lastError = e.message;
        console.log(`Endpoint error: ${e.message}`);
      }
    }

    if (!messages || messages.length === 0) {
      return new Response(
        JSON.stringify({ success: true, imported: 0, debug: lastError || "no messages found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get existing messages to deduplicate
    const { data: existingMsgs } = await supabase
      .from("whatsapp_mensagens")
      .select("timestamp_msg, conteudo, direcao")
      .eq("instancia_id", instancia_id)
      .eq("telefone_remoto", telefone);

    const existingKeys = new Set(
      (existingMsgs || []).map(
        (m: any) => `${m.timestamp_msg}|${m.direcao}|${m.conteudo?.substring(0, 100)}`
      )
    );

    const toInsert: any[] = [];

    for (const msg of messages) {
      const key = msg.key || {};
      const fromMe = key.fromMe === true;
      const direcao = fromMe ? "saida" : "entrada";

      const message = msg.message || {};
      let conteudo =
        message.conversation ||
        message.extendedTextMessage?.text ||
        message.imageMessage?.caption ||
        message.videoMessage?.caption ||
        message.documentMessage?.fileName ||
        "";

      let tipo_conteudo = "texto";
      const media_url: string | null = null;

      if (message.imageMessage) {
        tipo_conteudo = "imagem";
        if (!conteudo) conteudo = "📷 Imagem";
      } else if (message.videoMessage) {
        tipo_conteudo = "video";
        if (!conteudo) conteudo = "🎥 Vídeo";
      } else if (message.audioMessage || message.pttMessage) {
        tipo_conteudo = "audio";
        if (!conteudo) conteudo = "🎵 Áudio";
      } else if (message.documentMessage) {
        tipo_conteudo = "documento";
        if (!conteudo) conteudo = "📄 Documento";
      } else if (message.stickerMessage) {
        tipo_conteudo = "sticker";
        if (!conteudo) conteudo = "🏷️ Sticker";
      } else if (message.contactMessage || message.contactsArrayMessage) {
        tipo_conteudo = "texto";
        if (!conteudo) conteudo = "👤 Contato";
      } else if (message.locationMessage) {
        tipo_conteudo = "texto";
        if (!conteudo) conteudo = "📍 Localização";
      }

      if (!conteudo) continue;

      let timestamp_msg: string;
      if (msg.messageTimestamp) {
        const ts = typeof msg.messageTimestamp === "number"
          ? msg.messageTimestamp
          : parseInt(msg.messageTimestamp, 10);
        timestamp_msg = new Date(ts * 1000).toISOString();
      } else {
        continue;
      }

      const dedupeKey = `${timestamp_msg}|${direcao}|${conteudo.substring(0, 100)}`;
      if (existingKeys.has(dedupeKey)) continue;
      existingKeys.add(dedupeKey);

      toInsert.push({
        instancia_id: instancia_id,
        telefone_remoto: telefone,
        nome_contato: msg.pushName || null,
        conteudo,
        direcao,
        timestamp_msg,
        lida: true,
        tipo_conteudo,
        media_url,
      });
    }

    let imported = 0;
    if (toInsert.length > 0) {
      for (let i = 0; i < toInsert.length; i += 50) {
        const batch = toInsert.slice(i, i + 50);
        const { error } = await supabase.from("whatsapp_mensagens").insert(batch);
        if (error) {
          console.error("Insert error:", error);
        } else {
          imported += batch.length;
        }
      }
    }

    console.log(`Imported ${imported} messages for ${telefone}`);

    return new Response(
      JSON.stringify({ success: true, imported }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

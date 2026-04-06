import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    // Fetch messages from UAZAPI
    const chatId = `${telefone}@s.whatsapp.net`;
    const uazapiRes = await fetch(`${server_url}/chat/getMessages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${instance_token}`,
      },
      body: JSON.stringify({ id: chatId, count: 50 }),
    });

    if (!uazapiRes.ok) {
      const errorText = await uazapiRes.text();
      console.error("UAZAPI error:", uazapiRes.status, errorText);
      return new Response(
        JSON.stringify({ error: `Erro ao buscar histórico: ${uazapiRes.status}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const messages = await uazapiRes.json();

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ success: true, imported: 0 }),
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

      // Extract content
      const message = msg.message || {};
      let conteudo =
        message.conversation ||
        message.extendedTextMessage?.text ||
        message.imageMessage?.caption ||
        message.videoMessage?.caption ||
        message.documentMessage?.fileName ||
        "";

      // Determine content type
      let tipo_conteudo = "texto";
      let media_url: string | null = null;

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

      // Parse timestamp
      let timestamp_msg: string;
      if (msg.messageTimestamp) {
        const ts = typeof msg.messageTimestamp === "number"
          ? msg.messageTimestamp
          : parseInt(msg.messageTimestamp, 10);
        timestamp_msg = new Date(ts * 1000).toISOString();
      } else {
        continue;
      }

      // Deduplicate
      const dedupeKey = `${timestamp_msg}|${direcao}|${conteudo.substring(0, 100)}`;
      if (existingKeys.has(dedupeKey)) continue;
      existingKeys.add(dedupeKey);

      const nomeContato = msg.pushName || null;

      toInsert.push({
        instancia_id: instancia_id,
        telefone_remoto: telefone,
        nome_contato: nomeContato,
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
      // Insert in batches of 50
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

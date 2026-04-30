// Edge function: Import the most recent 10 individual WhatsApp conversations
// (no groups, no status, no broadcasts) for an instance, with the last 10 messages each.
// Marks ALL imported messages as unread (lida=false). Runs at most ONCE per instance,
// controlled by user_whatsapp_instances.historico_inicial_importado_em.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_CHATS = 10;
const MSGS_PER_CHAT = 10;

const isGroupOrStatus = (jid: string | null | undefined): boolean => {
  if (!jid) return true;
  const s = String(jid).toLowerCase();
  return (
    s.includes("@g.us") ||
    s.includes("status@broadcast") ||
    s.includes("@broadcast") ||
    s.includes("@newsletter")
  );
};

const extractPhoneFromJid = (jid: string): string => {
  // "5562999999999@s.whatsapp.net" → "5562999999999"
  return String(jid).split("@")[0].replace(/[^0-9]/g, "");
};

interface ParsedMessage {
  conteudo: string;
  direcao: "entrada" | "saida";
  timestamp_msg: string;
  tipo_conteudo: string;
  media_url: string | null;
  nome_contato: string | null;
  whatsapp_msg_id: string | null;
}

const parseUazapiMessage = (msg: any): ParsedMessage | null => {
  const key = msg.key || {};
  const fromMe = key.fromMe === true;
  const direcao: "entrada" | "saida" = fromMe ? "saida" : "entrada";

  const message = msg.message || {};
  let conteudo =
    message.conversation ||
    message.extendedTextMessage?.text ||
    message.imageMessage?.caption ||
    message.videoMessage?.caption ||
    message.documentMessage?.fileName ||
    msg.body ||
    msg.text ||
    msg.content ||
    "";

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
  }

  const mediaMsg =
    message.imageMessage ||
    message.audioMessage ||
    message.pttMessage ||
    message.videoMessage ||
    message.documentMessage;
  if (mediaMsg) {
    media_url = mediaMsg.url || mediaMsg.directPath || mediaMsg.mediaUrl || null;
  }

  if (!conteudo) return null;

  let timestamp_msg: string;
  if (msg.messageTimestamp) {
    const ts =
      typeof msg.messageTimestamp === "number"
        ? msg.messageTimestamp
        : parseInt(msg.messageTimestamp, 10);
    timestamp_msg = new Date(ts * 1000).toISOString();
  } else if (msg.timestamp) {
    const ts =
      typeof msg.timestamp === "number" ? msg.timestamp : parseInt(msg.timestamp, 10);
    timestamp_msg = new Date(ts * 1000).toISOString();
  } else if (msg.date || msg.created_at) {
    timestamp_msg = new Date(msg.date || msg.created_at).toISOString();
  } else {
    return null;
  }

  return {
    conteudo,
    direcao,
    timestamp_msg,
    tipo_conteudo,
    media_url,
    nome_contato: msg.pushName || msg.notifyName || null,
  };
};

const fetchChatList = async (
  baseUrl: string,
  token: string
): Promise<any[] | null> => {
  // Try several endpoints used by different UAZAPI versions to list chats.
  const attempts = [
    { url: `${baseUrl}/chat/find?token=${token}`, body: { count: 100 }, useHeader: false },
    { url: `${baseUrl}/chat/find`, body: { count: 100 }, useHeader: true },
    { url: `${baseUrl}/chat/list?token=${token}`, body: {}, useHeader: false },
    { url: `${baseUrl}/chat/list`, body: {}, useHeader: true },
    { url: `${baseUrl}/chats?token=${token}`, body: null, useHeader: false, method: "GET" as const },
  ];

  for (const a of attempts) {
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (a.useHeader) headers["token"] = token;

      const res = await fetch(a.url, {
        method: (a as any).method || "POST",
        headers,
        body: a.body ? JSON.stringify(a.body) : undefined,
      });
      if (!res.ok) continue;
      const text = await res.text();
      let parsed: any;
      try {
        parsed = JSON.parse(text);
      } catch {
        continue;
      }
      const candidates = [parsed, parsed?.chats, parsed?.data, parsed?.result];
      for (const c of candidates) {
        if (Array.isArray(c) && c.length > 0) return c;
      }
    } catch (_e) {
      // try next
    }
  }
  return null;
};

const fetchChatMessages = async (
  baseUrl: string,
  token: string,
  chatId: string,
  count: number
): Promise<any[] | null> => {
  const attempts = [
    { url: `${baseUrl}/chat/find?token=${token}`, body: { id: chatId, count }, useHeader: false },
    { url: `${baseUrl}/chat/find`, body: { id: chatId, count }, useHeader: true },
    { url: `${baseUrl}/chat/getMessages`, body: { id: chatId, count }, useHeader: true },
  ];

  for (const a of attempts) {
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (a.useHeader) headers["token"] = token;

      const res = await fetch(a.url, {
        method: "POST",
        headers,
        body: JSON.stringify(a.body),
      });
      if (!res.ok) continue;
      const text = await res.text();
      let parsed: any;
      try {
        parsed = JSON.parse(text);
      } catch {
        continue;
      }
      const candidates = [
        parsed?.messages,
        parsed?.data,
        parsed?.result,
        parsed?.chat?.messages,
        parsed,
      ];
      for (const c of candidates) {
        if (Array.isArray(c) && c.length > 0) {
          const sample = c[0];
          if (sample?.key || sample?.message || sample?.messageTimestamp) return c;
        }
      }
    } catch (_e) {
      // continue
    }
  }
  return null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { instancia_id, force } = await req.json();
    if (!instancia_id) {
      return new Response(
        JSON.stringify({ error: "instancia_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: inst, error: instErr } = await supabase
      .from("user_whatsapp_instances")
      .select("id, server_url, instance_token, historico_inicial_importado_em")
      .eq("id", instancia_id)
      .maybeSingle();

    if (instErr || !inst) {
      return new Response(
        JSON.stringify({ error: "Instância não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (inst.historico_inicial_importado_em && !force) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "Histórico já importado anteriormente" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const baseUrl = String(inst.server_url).replace(/\/+$/, "");
    const token = inst.instance_token;

    // 1. List chats from UAZAPI
    const chatList = await fetchChatList(baseUrl, token);
    if (!chatList) {
      // UAZAPI didn't expose chat listing. Mark as imported anyway so we don't keep retrying.
      await supabase
        .from("user_whatsapp_instances")
        .update({ historico_inicial_importado_em: new Date().toISOString() })
        .eq("id", instancia_id);

      return new Response(
        JSON.stringify({
          success: true,
          imported_chats: 0,
          imported_messages: 0,
          api_supported: false,
          fallback: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Filter out groups/status/broadcasts; sort by last message desc; take top N
    const individuals = chatList
      .filter((c: any) => {
        const jid = c.id || c.jid || c.chatId || c.remoteJid || c.number;
        return jid && !isGroupOrStatus(String(jid));
      })
      .map((c: any) => {
        const jid = c.id || c.jid || c.chatId || c.remoteJid || c.number;
        const lastTs =
          c.lastMessageTimestamp ||
          c.t ||
          c.conversationTimestamp ||
          c.lastMessage?.messageTimestamp ||
          c.updated_at ||
          0;
        const tsNum = typeof lastTs === "number" ? lastTs : parseInt(String(lastTs), 10) || 0;
        return { jid: String(jid), lastTs: tsNum, name: c.name || c.pushName || null };
      })
      .sort((a, b) => b.lastTs - a.lastTs)
      .slice(0, MAX_CHATS);

    // 3. For each chat, fetch messages and insert
    let imported_chats = 0;
    let imported_messages = 0;

    for (const chat of individuals) {
      const phone = extractPhoneFromJid(chat.jid);
      if (!phone) continue;

      const chatIdNormalized = chat.jid.includes("@") ? chat.jid : `${phone}@s.whatsapp.net`;
      const messages = await fetchChatMessages(baseUrl, token, chatIdNormalized, MSGS_PER_CHAT);
      if (!messages || messages.length === 0) continue;

      // Dedup against existing
      const { data: existing } = await supabase
        .from("whatsapp_mensagens")
        .select("timestamp_msg, conteudo, direcao")
        .eq("instancia_id", instancia_id)
        .eq("telefone_remoto", phone)
        .limit(500);

      const existingKeys = new Set(
        (existing || []).map(
          (m: any) => `${m.timestamp_msg}|${m.direcao}|${(m.conteudo || "").substring(0, 100)}`
        )
      );

      const toInsert: any[] = [];
      for (const raw of messages) {
        const parsed = parseUazapiMessage(raw);
        if (!parsed) continue;

        const key = `${parsed.timestamp_msg}|${parsed.direcao}|${parsed.conteudo.substring(0, 100)}`;
        if (existingKeys.has(key)) continue;
        existingKeys.add(key);

        toInsert.push({
          instancia_id,
          telefone_remoto: phone,
          nome_contato: parsed.nome_contato || chat.name,
          conteudo: parsed.conteudo,
          direcao: parsed.direcao,
          timestamp_msg: parsed.timestamp_msg,
          lida: false, // ALL imported messages start as unread (per user choice)
          tipo_conteudo: parsed.tipo_conteudo,
          media_url: parsed.media_url,
        });
      }

      if (toInsert.length > 0) {
        const { error: insErr } = await supabase.from("whatsapp_mensagens").insert(toInsert);
        if (!insErr) {
          imported_messages += toInsert.length;
          imported_chats += 1;
        } else {
          console.error("[import-recent] Insert error:", insErr.message);
        }
      }
    }

    // 4. Mark instance as imported
    await supabase
      .from("user_whatsapp_instances")
      .update({ historico_inicial_importado_em: new Date().toISOString() })
      .eq("id", instancia_id);

    return new Response(
      JSON.stringify({
        success: true,
        imported_chats,
        imported_messages,
        api_supported: true,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[import-recent] Error:", msg);
    // Per memory rule: UAZAPI errors should still return 200 with fallback
    return new Response(
      JSON.stringify({ success: false, fallback: true, error: msg }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

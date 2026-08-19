// Webhook público da VirtualSMS: recebe o SMS em tempo real (SMS Received / Status Changed).
// Configurado em virtualsms.de → Dashboard → Webhook Configuration.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-signature",
};

const ok = (body: unknown = { ok: true }) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const hex = (buf: ArrayBuffer) =>
  Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");

async function assinaturaValida(raw: string, header: string | null, secret: string) {
  if (!header) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw)));
  const recebida = header.replace(/^sha256=/i, "").trim().toLowerCase();
  return recebida === sig;
}

// Busca em nomes de campo variados (o provedor pode mudar o formato)
const pick = (obj: any, keys: string[]): any => {
  for (const k of keys) {
    const v = k.split(".").reduce<any>((acc, p) => (acc == null ? acc : acc[p]), obj);
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return null;
};

// Extrai um código numérico de 4-8 dígitos do texto do SMS
const codigoDoTexto = (texto: string | null) => {
  if (!texto) return null;
  const m = texto.match(/\b(\d{4,8})\b/);
  return m ? m[1] : null;
};

const somenteDigitos = (v: unknown) => String(v ?? "").replace(/\D/g, "");

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const secret = Deno.env.get("VIRTUALSMS_WEBHOOK_SECRET") || "";
  const raw = await req.text();

  try {
    // --- Autenticação do evento: assinatura HMAC ou token na URL ---
    const url = new URL(req.url);
    const tokenUrl = url.searchParams.get("token");
    const assinatura = req.headers.get("x-webhook-signature") || req.headers.get("X-Webhook-Signature");

    const porToken = !!secret && !!tokenUrl && tokenUrl === secret;
    const porAssinatura = !!secret && await assinaturaValida(raw, assinatura, secret);

    if (!secret) {
      console.error("[virtualsms-webhook] VIRTUALSMS_WEBHOOK_SECRET ausente");
      return new Response(JSON.stringify({ error: "Webhook não configurado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!porToken && !porAssinatura) {
      console.warn("[virtualsms-webhook] assinatura inválida");
      return new Response(JSON.stringify({ error: "Assinatura inválida" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let payload: any = {};
    try {
      payload = raw ? JSON.parse(raw) : {};
    } catch {
      payload = {};
    }
    console.log("[virtualsms-webhook] evento:", raw.slice(0, 800));

    const agora = new Date().toISOString();
    // Marca que o webhook está recebendo eventos (indicador na tela)
    const { data: conf } = await admin.from("virtualsms_config").select("id").limit(1).maybeSingle();
    if (conf?.id) {
      await admin.from("virtualsms_config").update({ ultimo_evento_em: agora }).eq("id", conf.id);
    } else {
      await admin.from("virtualsms_config").insert({ ultimo_evento_em: agora });
    }

    const orderId = pick(payload, [
      "activationId", "activation_id", "id", "orderId", "order_id",
      "data.activationId", "data.activation_id", "data.id", "data.orderId",
    ]);
    const numero = pick(payload, [
      "phoneNumber", "phone_number", "phone", "number",
      "data.phoneNumber", "data.phone_number", "data.phone", "data.number",
    ]);
    const texto = pick(payload, [
      "smsText", "sms_text", "text", "message", "content",
      "data.smsText", "data.sms_text", "data.text", "data.message",
    ]);
    const codigoBruto = pick(payload, [
      "smsCode", "sms_code", "code", "otp",
      "data.smsCode", "data.sms_code", "data.code",
    ]);
    const statusBruto = String(pick(payload, ["status", "activationStatus", "event", "type", "data.status"]) || "").toUpperCase();

    const codigo = (Array.isArray(codigoBruto) ? codigoBruto[0] : codigoBruto) ??
      codigoDoTexto(typeof texto === "string" ? texto : null);
    const textoSms = Array.isArray(texto) ? texto[0] : texto;

    // --- Localiza o pedido: por order_id ou pelo número (últimos 8 dígitos) ---
    let pedido: any = null;
    if (orderId) {
      const { data } = await admin
        .from("virtualsms_pedidos")
        .select("id, codigo, status")
        .eq("order_id", String(orderId))
        .maybeSingle();
      pedido = data;
    }
    if (!pedido && numero) {
      const sufixo = somenteDigitos(numero).slice(-8);
      if (sufixo.length === 8) {
        const { data } = await admin
          .from("virtualsms_pedidos")
          .select("id, codigo, status")
          .like("numero", `%${sufixo}`)
          .order("created_at", { ascending: false })
          .limit(1);
        pedido = data && data.length ? data[0] : null;
      }
    }

    if (!pedido) {
      console.warn("[virtualsms-webhook] pedido não encontrado", { orderId, numero });
      return ok({ ok: true, ignorado: "pedido_nao_encontrado" });
    }

    // Idempotência: se já temos código, não sobrescreve
    if (pedido.codigo && codigo) return ok({ ok: true, ignorado: "codigo_ja_registrado" });

    const patch: Record<string, unknown> = { updated_at: agora };
    if (codigo) {
      patch.codigo = String(codigo);
      patch.status = "recebido";
      patch.recebido_em = agora;
      if (textoSms) patch.texto_sms = String(textoSms).slice(0, 500);
    } else if (statusBruto.includes("CANCEL")) {
      patch.status = "cancelado";
      patch.custo = 0;
    } else if (statusBruto.includes("EXPIR") || statusBruto.includes("TIMEOUT")) {
      patch.status = "expirado";
      patch.custo = 0;
    } else if (statusBruto.includes("REFUND")) {
      patch.status = "reembolsado";
      patch.custo = 0;
    }

    await admin.from("virtualsms_pedidos").update(patch).eq("id", pedido.id);
    return ok({ ok: true, atualizado: Object.keys(patch) });
  } catch (e) {
    // Sempre 200 para o provedor não reenviar em loop
    console.error("[virtualsms-webhook] erro:", e instanceof Error ? e.message : e);
    return ok({ ok: false });
  }
});

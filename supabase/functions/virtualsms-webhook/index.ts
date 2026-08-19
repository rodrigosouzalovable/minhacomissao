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

const b64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf)));

// O provedor pode assinar em hex ou base64, com ou sem prefixo "sha256=".
async function assinaturaValida(raw: string, headers: (string | null)[], secret: string) {
  const recebidas = headers
    .filter((h): h is string => !!h)
    .map((h) => h.replace(/^sha256=/i, "").trim());
  if (!recebidas.length) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const buf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw));
  const esperadas = [hex(buf).toLowerCase(), b64(buf)];
  return recebidas.some((r) =>
    esperadas.some((e) => r === e || r.toLowerCase() === e.toLowerCase()) || r === secret
  );
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
    // --- Autenticação do evento: assinatura HMAC, token na URL ou segredo em cabeçalho ---
    const url = new URL(req.url);
    const tokenUrl = url.searchParams.get("token") || url.searchParams.get("secret");
    const authHeader = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
    const secretHeader = req.headers.get("x-webhook-secret") || req.headers.get("x-api-key") || "";
    const assinaturas = [
      req.headers.get("x-webhook-signature"),
      req.headers.get("x-signature"),
      req.headers.get("x-hub-signature-256"),
    ];

    const porToken = !!secret && (tokenUrl === secret || authHeader === secret || secretHeader === secret);
    const porAssinatura = !!secret && await assinaturaValida(raw, assinaturas, secret);

    if (!secret) {
      console.error("[virtualsms-webhook] VIRTUALSMS_WEBHOOK_SECRET ausente");
      return new Response(JSON.stringify({ error: "Webhook não configurado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!porToken && !porAssinatura) {
      // Registra a tentativa recusada (sem expor o segredo) para identificar o formato do provedor
      const cabecalhos = [...req.headers.entries()]
        .filter(([k]) => !/cookie|apikey|^authorization$/i.test(k))
        .map(([k, v]) => `${k}: ${k.toLowerCase().includes("signat") ? v.slice(0, 24) + "…" : v.slice(0, 60)}`)
        .join(" | ");
      const debug = `headers[${cabecalhos}] body[${raw.slice(0, 300)}]`;
      console.warn("[virtualsms-webhook] recusado —", debug);
      const { data: c } = await admin.from("virtualsms_config").select("id").limit(1).maybeSingle();
      const patchRej = {
        ultima_rejeicao_em: new Date().toISOString(),
        ultima_rejeicao_motivo: assinaturas.some(Boolean)
          ? "Assinatura não corresponde ao segredo configurado"
          : "Requisição sem assinatura e sem token na URL",
        ultima_rejeicao_debug: debug.slice(0, 1000),
      };
      if (c?.id) await admin.from("virtualsms_config").update(patchRej).eq("id", c.id);
      else await admin.from("virtualsms_config").insert(patchRej);

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
    // Marca que o webhook está recebendo eventos (indicador na tela) e limpa a última rejeição
    const okPatch = {
      ultimo_evento_em: agora,
      ultima_rejeicao_em: null,
      ultima_rejeicao_motivo: null,
      ultima_rejeicao_debug: null,
    };
    const { data: conf } = await admin.from("virtualsms_config").select("id").limit(1).maybeSingle();
    if (conf?.id) {
      await admin.from("virtualsms_config").update(okPatch).eq("id", conf.id);
    } else {
      await admin.from("virtualsms_config").insert(okPatch);
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

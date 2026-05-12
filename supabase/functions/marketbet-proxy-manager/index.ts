// MarketBet Proxy Manager — fase de teste controlado.
// Actions: saldo | locais | gerar | aplicar
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const MARKETBET_API_KEY = Deno.env.get("MARKETBET_API_KEY") || "";

const MB_BASE = "https://checker.marketbet.com.br/api/v1/proxy";

async function mbFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("Authorization", MARKETBET_API_KEY);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), 30000);
  try {
    const res = await fetch(`${MB_BASE}${path}`, { ...init, headers, signal: ctrl.signal });
    const txt = await res.text();
    let data: any = null;
    try { data = JSON.parse(txt); } catch { data = { raw: txt.slice(0, 500) }; }
    return { ok: res.ok, status: res.status, data };
  } finally { clearTimeout(tid); }
}

// "host:port:user_with_modifiers:password" — split em 4 a partir da esquerda.
function parseProxyString(s: string) {
  const parts = s.split(":");
  if (parts.length < 4) return null;
  const host = parts[0];
  const porta = parseInt(parts[1], 10);
  const password = parts[parts.length - 1];
  const username = parts.slice(2, -1).join(":");
  if (!host || !porta || !username || !password) return null;
  return { host, porta, username, password };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (!MARKETBET_API_KEY) return json({ error: "MARKETBET_API_KEY não configurada" }, 500);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
  const { data: claims } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
  if (!claims?.claims?.sub) return json({ error: "Unauthorized" }, 401);
  const userId = claims.claims.sub as string;

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data: isAdmin } = await admin.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!isAdmin) return json({ error: "Forbidden" }, 403);

  let body: any = {};
  try { body = await req.json(); } catch { /* GET-like */ }
  const action = body?.action || new URL(req.url).searchParams.get("action");
  if (!action) return json({ error: "action obrigatório" }, 400);

  const log = async (sucesso: boolean, payload: any, resposta: any) => {
    await admin.from("marketbet_proxy_log").insert({ user_id: userId, acao: action, payload, resposta, sucesso });
  };

  try {
    if (action === "saldo") {
      const r = await mbFetch("/saldo.php");
      await log(r.ok, {}, r.data);
      return json(r.data, r.ok ? 200 : 502);
    }

    if (action === "locais") {
      const country = body?.country || "br";
      const r = await mbFetch(`/locais.php?country=${encodeURIComponent(country)}`);
      await log(r.ok, { country }, r.data);
      return json(r.data, r.ok ? 200 : 502);
    }

    if (action === "gerar") {
      const payload = {
        quantidade: Math.min(Math.max(parseInt(body.quantidade ?? 1, 10) || 1, 1), 100),
        tipo: body.tipo === "rotativo" ? "rotativo" : "fixo",
        country: body.country || "br",
        ...(body.state ? { state: String(body.state) } : {}),
        ...(body.city ? { city: String(body.city) } : {}),
      };
      const r = await mbFetch("/gerar.php", { method: "POST", body: JSON.stringify(payload) });
      await log(r.ok, payload, r.data);
      if (r.ok && r.data?.success && Array.isArray(r.data?.data?.proxies)) {
        const rows = r.data.data.proxies
          .map((s: string) => {
            const p = parseProxyString(s);
            if (!p) return null;
            return {
              proxy_string: s,
              host: p.host,
              porta: p.porta,
              username: p.username,
              password: p.password,
              estado: payload.state || null,
              cidade: payload.city || null,
              tipo: payload.tipo,
            };
          })
          .filter(Boolean);
          if (rows.length) await admin.from("marketbet_proxies_gerados").insert(rows);
      }
      return json(r.data, r.ok ? 200 : 502);
    }

    if (action === "aplicar") {
      const proxyId = body.proxy_id as string;
      const instanceId = body.instance_id as string;
      if (!proxyId || !instanceId) return json({ error: "proxy_id e instance_id obrigatórios" }, 400);

      const { data: pxy } = await admin.from("marketbet_proxies_gerados").select("*").eq("id", proxyId).maybeSingle();
      if (!pxy) return json({ error: "Proxy não encontrado" }, 404);

      // Atualiza colunas de proxy na instância
      const { error: upErr } = await admin.from("user_whatsapp_instances").update({
        proxy_enabled: true,
        proxy_type: "socks5",
        proxy_host: pxy.host,
        proxy_port: pxy.porta,
        proxy_username: pxy.username,
        proxy_password: pxy.password,
      }).eq("id", instanceId);
      if (upErr) {
        await log(false, { proxyId, instanceId }, { error: upErr.message });
        return json({ error: upErr.message }, 500);
      }

      // Invoca uazapi-set-proxy
      const setRes = await fetch(`${SUPABASE_URL}/functions/v1/uazapi-set-proxy`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_ROLE}`, apikey: SERVICE_ROLE },
        body: JSON.stringify({ instance_id: instanceId }),
      });
      const setData = await setRes.json().catch(() => ({}));

      await admin.from("marketbet_proxies_gerados").update({
        aplicado_em_instancia: instanceId,
        aplicado_em: new Date().toISOString(),
      }).eq("id", proxyId);

      await log(setRes.ok, { proxyId, instanceId }, setData);
      return json({ ok: setRes.ok, uazapi: setData });
    }

    return json({ error: `action desconhecida: ${action}` }, 400);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await log(false, body, { error: msg });
    return json({ error: msg }, 500);
  }
});

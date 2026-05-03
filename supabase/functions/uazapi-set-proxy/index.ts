// Aplica proxy SOCKS5/HTTP em uma ou várias instâncias UAZAPI.
// Modo single: { instance_id } (lê config do banco) OU
//              { server_url, instance_token, proxy: {...} } (ad-hoc)
// Modo lote:   { instance_ids: [uuid,...] } (lê do banco para cada)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface ProxyConfig {
  enabled: boolean;
  type: "socks5" | "http";
  host: string;
  port: number;
  username?: string | null;
  password?: string | null;
}

async function applyToUazapi(serverUrl: string, token: string, p: ProxyConfig) {
  const cleanUrl = serverUrl.replace(/\/+$/, "");
  // UAZAPI v2: POST /instance/proxy (cadastrar/alterar) ou DELETE /instance/proxy (remover)
  // Body plano: { host, port, protocol, username, password }
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), 25000);
  try {
    const url = `${cleanUrl}/instance/proxy`;
    const method = p.enabled ? "POST" : "DELETE";
    const init: RequestInit = {
      method,
      headers: { "Content-Type": "application/json", token },
      signal: ctrl.signal,
    };
    if (p.enabled) {
      init.body = JSON.stringify({
        host: p.host,
        port: Number(p.port),
        protocol: p.type || "socks5",
        username: p.username || "",
        password: p.password || "",
      });
    }
    const res = await fetch(url, init);
    const txt = await res.text();
    let data: any = null;
    try { data = JSON.parse(txt); } catch { data = { raw: txt.slice(0, 300) }; }
    if (!res.ok) {
      return { ok: false, error: data?.message || `HTTP ${res.status}`, data };
    }
    return { ok: true, data };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // Tratar disconnected como fallback (memory rule)
    if (/disconnected|abort|timeout/i.test(msg)) {
      return { ok: false, fallback: true, error: msg };
    }
    return { ok: false, error: msg };
  } finally {
    clearTimeout(tid);
  }
}

async function processInstance(supabase: any, instanceId: string) {
  const { data: inst, error } = await supabase
    .from("user_whatsapp_instances")
    .select("id, nome, server_url, instance_token, proxy_enabled, proxy_type, proxy_host, proxy_port, proxy_username, proxy_password")
    .eq("id", instanceId)
    .maybeSingle();
  if (error || !inst) return { instance_id: instanceId, ok: false, error: "Instância não encontrada" };
  if (inst.proxy_enabled && (!inst.proxy_host || !inst.proxy_port)) {
    return { instance_id: instanceId, nome: inst.nome, ok: false, error: "Host/porta obrigatórios" };
  }
  const result = await applyToUazapi(inst.server_url, inst.instance_token, {
    enabled: !!inst.proxy_enabled,
    type: (inst.proxy_type || "socks5") as any,
    host: inst.proxy_host || "",
    port: inst.proxy_port || 0,
    username: inst.proxy_username,
    password: inst.proxy_password,
  });
  await supabase
    .from("user_whatsapp_instances")
    .update({
      proxy_aplicado_em: result.ok ? new Date().toISOString() : null,
      proxy_ultimo_erro: result.ok ? null : (result.error || "Erro desconhecido"),
    })
    .eq("id", instanceId);
  return { instance_id: instanceId, nome: inst.nome, ok: result.ok, error: result.error, fallback: result.fallback };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Modo ad-hoc (sem persistir)
    if (body.server_url && body.instance_token && body.proxy) {
      const r = await applyToUazapi(body.server_url, body.instance_token, body.proxy);
      return json(r);
    }

    const ids: string[] = body.instance_ids || (body.instance_id ? [body.instance_id] : []);
    if (ids.length === 0) return json({ error: "instance_id ou instance_ids obrigatório" }, 400);

    const results: any[] = [];
    for (let i = 0; i < ids.length; i++) {
      const r = await processInstance(supabase, ids[i]);
      results.push(r);
      // delay 1-3s entre chamadas (anti rate-limit)
      if (i < ids.length - 1) {
        const delay = 1000 + Math.floor(Math.random() * 2000);
        await new Promise((res) => setTimeout(res, delay));
      }
    }
    const ok = results.filter((r) => r.ok).length;
    return json({ total: ids.length, ok, falhas: ids.length - ok, results });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

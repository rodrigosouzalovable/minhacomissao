import { createClient } from "https://esm.sh/@supabase/supabase-js@2.88.0";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json" },
});
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const providerFailed = (text: string) => {
  try {
    const data = JSON.parse(text);
    return data?.error === true || data?.success === false || (typeof data?.error === "string" && data.error.trim());
  } catch {
    return /error|falha|not allowed/i.test(text);
  }
};

const connected = async (inst: any) => {
  const base = String(inst.server_url || "").replace(/\/+$/, "");
  const token = String(inst.instance_token || "");
  for (const attempt of [
    { url: `${base}/instance/status?token=${encodeURIComponent(token)}`, headers: {} },
    { url: `${base}/instance/status`, headers: { token } },
  ]) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const ctrl = new AbortController();
      timer = setTimeout(() => ctrl.abort(), 3500);
      const response = await fetch(attempt.url, { headers: attempt.headers, signal: ctrl.signal });
      if (timer) clearTimeout(timer);
      if (!response.ok) continue;
      const data = await response.json();
      const raw = String(data?.status ?? data?.state ?? data?.instance?.status ?? data?.data?.status ?? "").toLowerCase();
      if (data?.connected === true || data?.instance?.connected === true || ["connected", "open", "online", "ready"].includes(raw)) return true;
    } catch {
      if (timer) clearTimeout(timer);
    }
  }
  return false;
};

const send = async (inst: any, number: string, text: string) => {
  const base = String(inst.server_url).replace(/\/+$/, "");
  let lastError = "sem_tentativas";
  for (const endpoint of [`${base}/send/text`, `${base}/message/sendText`, `${base}/sendText`]) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const ctrl = new AbortController();
      timer = setTimeout(() => ctrl.abort(), 12000);
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", token: inst.instance_token },
        body: JSON.stringify({ number, text }),
        signal: ctrl.signal,
      });
      if (timer) clearTimeout(timer);
      const body = await response.text();
      if (response.ok && !providerFailed(body)) return { ok: true };
      lastError = `${inst.nome ?? inst.id}: ${body || `HTTP ${response.status}`}`.slice(0, 1000);
      if (response.status !== 405) break;
    } catch (error) {
      if (timer) clearTimeout(timer);
      lastError = `${inst.nome ?? inst.id}: ${String(error)}`.slice(0, 1000);
    }
  }
  return { ok: false, error: lastError };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok");
  const auth = req.headers.get("Authorization") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!serviceKey || auth !== `Bearer ${serviceKey}`) return json({ error: "unauthorized" }, 401);

  const url = Deno.env.get("SUPABASE_URL");
  if (!url) return json({ error: "missing_url" }, 500);
  const supabase = createClient(url, serviceKey);
  await supabase.rpc("liberar_trava_notificacao_admin");

  const { data: claimed, error: claimError } = await supabase.rpc("reivindicar_proxima_notificacao_admin");
  if (claimError) return json({ error: claimError.message }, 500);
  const item = Array.isArray(claimed) ? claimed[0] : claimed;
  if (!item) return json({ ok: true, idle: true });

  const [{ data: selected }, { data: allActive }, { data: config }] = await Promise.all([
    supabase.from("admin_notificacao_instancias").select("instancia_id").eq("ativa", true),
    supabase.from("user_whatsapp_instances").select("id, nome, server_url, instance_token, ativo").eq("ativo", true).not("server_url", "is", null).not("instance_token", "is", null).order("id"),
    supabase.from("admin_notificacoes_config").select("ultima_instancia_id").eq("id", 1).maybeSingle(),
  ]);

  const selectedIds = new Set((selected || []).map((row: any) => row.instancia_id));
  const preferred = (allActive || []).filter((inst: any) => selectedIds.has(inst.id));
  const fallbackCandidates = (allActive || []).filter((inst: any) => !selectedIds.has(inst.id));
  const healthyPreferred: any[] = [];
  for (const inst of preferred) if (await connected(inst)) healthyPreferred.push(inst);
  let candidates = healthyPreferred;
  let fallback = false;
  if (!candidates.length) {
    fallback = true;
    for (const inst of fallbackCandidates) if (await connected(inst)) candidates.push(inst);
  }

  const lastId = config?.ultima_instancia_id;
  const lastIndex = candidates.findIndex((inst: any) => inst.id === lastId);
  if (lastIndex >= 0) candidates = [...candidates.slice(lastIndex + 1), ...candidates.slice(0, lastIndex + 1)];

  let usedId: string | null = null;
  let lastError = candidates.length ? "falha_no_envio" : "nenhuma_instancia_conectada";
  for (const inst of candidates) {
    const result = await send(inst, item.destinatario, item.mensagem);
    if (result.ok) { usedId = inst.id; break; }
    lastError = result.error || lastError;
  }

  const status = usedId ? "enviado" : "erro";
  const { data: delay } = await supabase.rpc("finalizar_notificacao_admin", {
    p_id: item.id,
    p_status: status,
    p_instancia_id: usedId,
    p_fallback: fallback,
    p_erro: usedId ? null : lastError,
  });

  await supabase.from("admin_notificacoes_log").insert({
    tipo: item.tipo,
    chave_idempotencia: item.chave_idempotencia,
    mensagem: `[${item.destinatario}] ${item.mensagem}`.slice(0, 4000),
    instancia_envio_id: usedId,
    status,
    erro_detalhe: fallback ? `${usedId ? "fallback_uazapi" : lastError}` : (usedId ? null : lastError),
    enviado_em: new Date().toISOString(),
  });
  if (usedId) {
    await supabase.from("admin_notificacoes_config").update({ ultima_instancia_id: usedId, updated_at: new Date().toISOString() }).eq("id", 1);
  }

  const delaySeconds = Number(delay || 0);
  if (delaySeconds > 0) {
    EdgeRuntime.waitUntil((async () => {
      await wait(delaySeconds * 1000);
      await fetch(`${url}/functions/v1/process-admin-notification-queue`, {
        method: "POST",
        headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
        body: "{}",
      });
    })().catch((error) => console.error("[admin-notification-queue] falha ao encadear", error)));
  }

  return json({ ok: Boolean(usedId), id: item.id, delay_seconds: delaySeconds, fallback, error: usedId ? undefined : lastError });
});

// Webhook público da 3C Plus — eventos call-was-connected e call-history-was-created
// Autenticação por chave própria na query (?k=...), validada contra tresc_config.webhook_key.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.88.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const suf8 = (t: unknown) => String(t ?? "").replace(/\D/g, "").slice(-8);

function brtParts(d: Date) {
  const s = d.toLocaleString("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
  const [dia, hm] = s.split(", ");
  const [hh] = hm.split(":");
  return { dia, hora: Number(hh) };
}

function foiAtendida(c: any): boolean {
  const fala = String(c?.speaking_with_agent_time ?? "00:00:00");
  if (fala !== "00:00:00" && fala !== "-" && fala !== "null") return true;
  const txt = String(c?.readable_status_text ?? c?.status ?? "").toLowerCase();
  if (txt.includes("atendida") && !txt.includes("não atendida") && !txt.includes("nao atendida")) return true;
  if (String(c?.status_id ?? "") === "3") return true; // conectada com agente
  return c?.has_agent === true;
}

const txt = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return s && s !== "-" && s !== "null" ? s : null;
};
const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const url = new URL(req.url);
    const key = url.searchParams.get("k") || req.headers.get("x-webhook-key") || "";

    const { data: cfg } = await supabase
      .from("tresc_config")
      .select("id, webhook_key")
      .limit(1)
      .maybeSingle();

    if (!cfg?.webhook_key) return json({ error: "integração não configurada" }, 401);
    if (key !== String(cfg.webhook_key)) return json({ error: "chave inválida" }, 401);

    if (req.method === "GET") return json({ ok: true, pronto: true });

    let payload: any = {};
    try { payload = await req.json(); } catch (_) { payload = {}; }

    // A 3C pode entregar o objeto na raiz, em "call", em "data" ou em "call_history"
    const c = payload?.call ?? payload?.call_history ?? payload?.data?.call ?? payload?.data ?? payload;
    const evento = txt(payload?.event ?? payload?.type ?? payload?.event_name) ?? "desconhecido";

    const callId = txt(c?.id ?? c?.call_id ?? c?.uuid ?? payload?.call_id);
    const numero = txt(c?.number ?? c?.phone ?? c?.telephone ?? c?.contact?.phone);

    if (!callId || !numero) {
      console.log("tresc-webhook payload sem id/numero:", JSON.stringify(payload).slice(0, 800));
      await supabase.from("tresc_config")
        .update({ ultimo_webhook_em: new Date().toISOString(), ultimo_webhook_tipo: `${evento} (ignorado)` })
        .eq("id", cfg.id);
      return json({ ok: true, ignorado: true });
    }

    const bruta = txt(c?.call_date_rfc3339) ?? txt(c?.call_date) ?? txt(c?.created_at);
    const dt = bruta
      ? new Date(bruta.includes("T") ? bruta : `${bruta.replace(" ", "T")}-03:00`)
      : new Date();
    const p = brtParts(isNaN(dt.getTime()) ? new Date() : dt);

    const linha = {
      call_id: callId,
      data: p.dia,
      hora: `${p.hora}h-${p.hora + 1}h`,
      telefone: numero,
      telefone_sufixo: suf8(numero),
      status_id: num(c?.status_id),
      status_texto: txt(c?.readable_status_text ?? c?.status),
      atendida: foiAtendida(c),
      qualificacao_id: num(c?.qualification_id ?? c?.qualification?.id),
      qualificacao_nome: txt(c?.qualification?.name ?? c?.qualification),
      agente: txt(c?.agent?.name ?? c?.agent),
      campanha: txt(c?.campaign?.name ?? c?.campaign),
      campanha_id: num(c?.campaign_id ?? c?.campaign?.id),
      modo: txt(c?.mode),
      call_date: (isNaN(dt.getTime()) ? new Date() : dt).toISOString(),
    };

    // Não sobrescreve com nulo o que já foi gravado por um evento anterior
    const { data: existente } = await supabase
      .from("tresc_ligacoes")
      .select("*")
      .eq("call_id", callId)
      .maybeSingle();

    const final: Record<string, unknown> = { ...(existente || {}) };
    delete final.criado_em;
    for (const [k, v] of Object.entries(linha)) {
      if (v !== null && v !== undefined && v !== "") final[k] = v;
    }
    if (existente?.atendida === true) final.atendida = true;

    const { error } = await supabase
      .from("tresc_ligacoes")
      .upsert(final as any, { onConflict: "call_id" });
    if (error) throw error;

    await supabase.from("tresc_config")
      .update({ ultimo_webhook_em: new Date().toISOString(), ultimo_webhook_tipo: evento })
      .eq("id", cfg.id);

    return json({ ok: true, call_id: callId, evento, hora: linha.hora });
  } catch (e) {
    console.error("tresc-webhook erro:", e);
    // Responde 200 para a 3C não desativar o webhook por falhas repetidas
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) });
  }
});

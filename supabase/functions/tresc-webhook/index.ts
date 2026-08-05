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

// Converte "00:01:23", "83" ou 83 em segundos
function segundos(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const s = String(v).trim();
  if (!s || s === "-" || s === "null") return 0;
  if (s.includes(":")) {
    const partes = s.split(":").map((p) => Number(p) || 0);
    return partes.reduce((acc, n) => acc * 60 + n, 0);
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

// ALÔ = houve conversa real com o agente
function foiAtendida(c: any): boolean {
  if (segundos(c?.speaking_with_agent_time) > 0) return true;
  if (segundos(c?.speaking_time) > 0) return true;
  const t = String(c?.readable_status_text ?? c?.status_text ?? "").toLowerCase();
  if (t.includes("atendida") && !t.includes("não atendida") && !t.includes("nao atendida")) return true;
  if (Number(c?.agent?.id ?? 0) > 0 && segundos(c?.billed_time) > 0) return true;
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
let amostrasLogadas = 0;


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

    // A 3C entrega o evento como CHAVE RAIZ, ex:
    // { "call-history-was-created": { "callHistory": { "_id": ..., ... } } }
    const EVENTOS = ["call-history-was-created", "call-was-connected", "call-was-created", "call-was-finished"];
    let envelope: any = payload;
    let evento = txt(payload?.event ?? payload?.type ?? payload?.event_name);
    for (const ev of EVENTOS) {
      if (payload && typeof payload === "object" && payload[ev]) {
        evento = ev;
        envelope = payload[ev];
        break;
      }
    }
    if (!evento && payload && typeof payload === "object") {
      // qualquer chave única que contenha um objeto com callHistory/call
      for (const [k, v] of Object.entries(payload)) {
        if (v && typeof v === "object" && ((v as any).callHistory || (v as any).call)) {
          evento = k; envelope = v; break;
        }
      }
    }
    evento = evento ?? "desconhecido";

    const c = envelope?.callHistory ?? envelope?.call_history ?? envelope?.call
      ?? envelope?.data?.call ?? envelope?.data ?? envelope;

    const callId = txt(c?.id ?? c?._id ?? c?.call_id ?? c?.uuid ?? envelope?.call_id ?? payload?.call_id);

    // Busca do telefone: campos conhecidos e, como fallback, varredura por chaves de telefone
    const deepPhone = (obj: any, depth = 0): string | null => {
      if (!obj || typeof obj !== "object" || depth > 3) return null;
      for (const [k, v] of Object.entries(obj)) {
        if (v == null) continue;
        if ((typeof v === "string" || typeof v === "number") && /phone|number|telefone|telephone|dialed/i.test(k)) {
          const d = String(v).replace(/\D/g, "");
          if (d.length >= 8) return String(v);
        }
      }
      for (const v of Object.values(obj)) {
        if (v && typeof v === "object") {
          const r = deepPhone(v, depth + 1);
          if (r) return r;
        }
      }
      return null;
    };
    const numero = txt(
      c?.number ?? c?.phone ?? c?.telephone ?? c?.dialed_number ?? c?.contact?.phone
        ?? c?.contact?.number ?? c?.customer?.phone,
    ) ?? deepPhone(c) ?? deepPhone(envelope);

    if (!callId || !numero) {
      console.log("tresc-webhook payload sem id/numero:", JSON.stringify(payload).slice(0, 1500));
      await supabase.from("tresc_config")
        .update({ ultimo_webhook_em: new Date().toISOString(), ultimo_webhook_tipo: `${evento} (ignorado)` })
        .eq("id", cfg.id);
      return json({ ok: true, ignorado: true });
    }

    const guardarAmostra = url.searchParams.get("debug") === "1" || amostrasLogadas < 4;
    if (guardarAmostra) {
      amostrasLogadas++;
      console.log("tresc-webhook amostra:", evento, JSON.stringify(c).slice(0, 3000));
    }




    const ts = c?.call_timestamp || {};
    const epoch = Number(ts?.dialed_time ?? ts?.connected_time ?? ts?.answered_time ?? 0);
    const bruta = txt(c?.call_date_rfc3339) ?? txt(c?.call_date) ?? txt(c?.created_at);
    let dt = epoch > 0 ? new Date(epoch * 1000) : null;
    if (!dt || isNaN(dt.getTime())) {
      dt = bruta
        ? new Date(bruta.includes("T") ? bruta : `${bruta.replace(" ", "T")}-03:00`)
        : new Date();
    }
    const p = brtParts(isNaN(dt.getTime()) ? new Date() : dt);


    const linha = {
      call_id: callId,
      data: p.dia,
      hora: `${p.hora}h-${p.hora + 1}h`,
      telefone: numero,
      telefone_sufixo: suf8(numero),
      status_id: num(c?.status_id),
      status_texto: txt(c?.readable_status_text ?? c?.status_text ?? c?.status),
      atendida: foiAtendida(c),
      qualificacao_id: num(c?.qualification_id ?? c?.qualification?.id),
      qualificacao_nome: txt(c?.qualification?.name ?? (typeof c?.qualification === "string" ? c?.qualification : null)),
      agente: txt(c?.agent?.name ?? (typeof c?.agent === "string" ? c?.agent : null)),
      campanha: txt(c?.campaign?.name ?? (typeof c?.campaign === "string" ? c?.campaign : null)),
      campanha_id: num(c?.campaign_id ?? c?.campaign?.id),
      modo: txt(c?.mode ?? c?.call_mode),
      payload_debug: guardarAmostra ? { evento, call: c } : null,
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

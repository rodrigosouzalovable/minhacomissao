// Postagem automática de status (stories) no WhatsApp via UAZAPI.
// Cadência: cada instância posta a cada 48-72h, em janela 09h-19h BRT,
// nunca aos domingos. Pool de imagens, sem repetir as últimas 3.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.88.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function brtNow(): Date {
  const now = new Date();
  return new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
}

function nextSlotIso(): string {
  // Sorteia 20-24h à frente (post diário), com hora 9-18 BRT, minuto aleatório
  const baseMs = Date.now() + (20 + Math.random() * 4) * 3600 * 1000;
  const d = new Date(baseMs);
  const brt = new Date(d.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  brt.setHours(9 + Math.floor(Math.random() * 10), Math.floor(Math.random() * 60), 0, 0);
  // Se cair no domingo, joga para segunda 09-18h
  if (brt.getDay() === 0) brt.setDate(brt.getDate() + 1);
  // Converte de volta para UTC ISO
  const offsetMs = new Date(brt.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })).getTime() - brt.getTime();
  return new Date(brt.getTime() - offsetMs).toISOString();
}

function pickImage(images: any[], recentIds: Set<string>): any | null {
  const pool = images.filter((i) => i.ativo && !recentIds.has(i.id));
  const final = pool.length > 0 ? pool : images.filter((i) => i.ativo);
  if (final.length === 0) return null;
  return final[Math.floor(Math.random() * final.length)];
}

async function postStatus(
  serverUrl: string,
  token: string,
  imageUrl: string,
  caption: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const base = serverUrl.replace(/\/+$/, "");
  // UAZAPI: POST /send/media com number = "status@broadcast"
  const body = {
    number: "status@broadcast",
    type: "image",
    file: imageUrl,
    text: caption || "",
  };
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 30000);
    const res = await fetch(`${base}/send/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json", token },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    const txt = await res.text();
    if (!res.ok) return { ok: false, error: `${res.status}: ${txt.substring(0, 200)}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let body: any = {};
  try { body = await req.json(); } catch { /* cron */ }

  const isManualTest = body?.action === "test" && body?.instancia_id;

  const brt = brtNow();
  const dow = brt.getDay();
  const hour = brt.getHours();

  // Domingo: bloquear (exceto teste manual)
  if (!isManualTest && dow === 0) {
    return new Response(JSON.stringify({ ok: true, skipped: "sunday" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Fora janela 09-19h BRT (exceto teste)
  if (!isManualTest && (hour < 9 || hour >= 19)) {
    return new Response(JSON.stringify({ ok: true, skipped: "out_of_window", hour }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Verifica habilitado
  const { data: cfgRow } = await supabase
    .from("whatsapp_aquecimento_config")
    .select("valor")
    .eq("chave", "postar_status_auto")
    .maybeSingle();
  // Habilitado por padrão se a row não existir; só desabilita se valor for explicitamente false
  const habilitado = !cfgRow || cfgRow.valor === true || cfgRow.valor === "true" || cfgRow.valor === null;
  if (!habilitado && !isManualTest) {
    return new Response(JSON.stringify({ ok: true, skipped: "disabled" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Pool de imagens ativas
  const { data: images } = await supabase
    .from("whatsapp_aquecimento_status_imagens")
    .select("id, public_url, caption, ativo")
    .eq("ativo", true);

  if (!images || images.length === 0) {
    return new Response(JSON.stringify({ ok: true, skipped: "no_images" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Selecionar instâncias elegíveis
  let instancesQuery = supabase
    .from("user_whatsapp_instances")
    .select("id, nome, server_url, instance_token")
    .eq("ativo", true);

  if (isManualTest) {
    instancesQuery = instancesQuery.eq("id", body.instancia_id);
  }

  const { data: rawInstances } = await instancesQuery;
  if (!rawInstances || rawInstances.length === 0) {
    return new Response(JSON.stringify({ ok: true, skipped: "no_instances" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Postagem diária para TODAS as instâncias ativas/conectadas
  // (sem filtrar por status de aquecimento)
  const elegibles = rawInstances;

  // Para cada instância, checar se já está no horário do próximo post agendado
  const nowIso = new Date().toISOString();
  const results: any[] = [];

  for (const inst of elegibles) {
    if (!isManualTest) {
      // Pega o último log para verificar cooldown
      const { data: lastLog } = await supabase
        .from("whatsapp_aquecimento_status_log")
        .select("proximo_post_em")
        .eq("instancia_id", inst.id)
        .order("postado_em", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastLog?.proximo_post_em && lastLog.proximo_post_em > nowIso) {
        continue; // ainda no cooldown
      }
    }

    // Histórico das últimas 3 imagens dessa instância
    const { data: recents } = await supabase
      .from("whatsapp_aquecimento_status_log")
      .select("imagem_id")
      .eq("instancia_id", inst.id)
      .eq("status", "enviado")
      .order("postado_em", { ascending: false })
      .limit(3);
    const recentIds = new Set((recents || []).map((r: any) => r.imagem_id).filter(Boolean));

    const img = pickImage(images, recentIds);
    if (!img) continue;

    const { ok, error } = await postStatus(inst.server_url, inst.instance_token, img.public_url, img.caption);

    const proximo = isManualTest ? null : nextSlotIso();

    await supabase.from("whatsapp_aquecimento_status_log").insert({
      instancia_id: inst.id,
      imagem_id: img.id,
      status: ok ? "enviado" : "erro",
      erro: ok ? null : error?.substring(0, 500),
      postado_em: new Date().toISOString(),
      proximo_post_em: proximo,
    });

    results.push({ instancia: inst.nome, ok, erro: error });

    // Espaçamento 60-180s entre instâncias para evitar burst
    if (!isManualTest && elegibles.length > 1) {
      await new Promise((r) => setTimeout(r, 60000 + Math.random() * 120000));
    }
  }

  return new Response(
    JSON.stringify({ ok: true, total: results.length, results, fallback: results.some((r) => !r.ok) }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});

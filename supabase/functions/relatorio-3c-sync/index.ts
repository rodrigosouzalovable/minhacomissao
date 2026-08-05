// Integração 3C Plus (API Discador)
// Ações: testar | campanhas | qualificacoes | sync
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.88.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_BASE = "https://app.3c.fluxoti.com.br/api/v1";

const HORAS = [
  "8h-9h", "9h-10h", "10h-11h", "11h-12h", "12h-13h", "13h-14h",
  "14h-15h", "15h-16h", "16h-17h", "17h-18h", "18h-19h",
];

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

// Status de ligação atendida na 3C (atendida humana / pós-atendimento)
function foiAtendida(c: any): boolean {
  const fala = String(c?.speaking_with_agent_time ?? "00:00:00");
  if (fala !== "00:00:00" && fala !== "-") return true;
  const txt = String(c?.readable_status_text ?? "").toLowerCase();
  if (txt.includes("atendida") && !txt.includes("não atendida") && !txt.includes("nao atendida")) return true;
  return c?.has_agent === true;
}

async function tresc(base: string, token: string, path: string, params: Record<string, string> = {}) {
  const url = new URL(`${base.replace(/\/+$/, "")}${path}`);
  url.searchParams.set("api_token", token);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
  const body = await res.text();
  if (!res.ok) {
    console.error(`3C ${path} falhou [${res.status}]: ${body.slice(0, 500)}`);
    throw new Error(`3C ${path} [${res.status}]: ${body.slice(0, 300)}`);
  }
  try { return JSON.parse(body); } catch { throw new Error(`3C ${path}: resposta inválida`); }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const token = Deno.env.get("TRESC_API_TOKEN");
    if (!token) throw new Error("TRESC_API_TOKEN não configurado");

    let body: any = {};
    try { body = await req.json(); } catch (_) { /* sem body */ }
    const action: string = body.action || "sync";

    const { data: cfg } = await supabase.from("tresc_config").select("*").limit(1).maybeSingle();
    const base: string = body.base_url || cfg?.base_url || DEFAULT_BASE;

    // === Testar conexão / listar campanhas ===
    if (action === "testar" || action === "campanhas") {
      const json = await tresc(base, token, "/campaigns", { per_page: "200" });
      const campanhas = (json?.data || []).map((c: any) => ({
        id: c.id, nome: c.name, pausada: c.paused,
      }));
      return new Response(JSON.stringify({ ok: true, base, campanhas }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === Importar qualificações ===
    if (action === "qualificacoes") {
      const listas = await tresc(base, token, "/qualification_lists", { per_page: "100" });
      const encontradas: any[] = [];
      for (const l of (listas?.data || [])) {
        const q = await tresc(base, token, `/qualification_lists/${l.id}/qualifications`, { per_page: "200" });
        for (const item of (q?.data || [])) {
          encontradas.push({ qualificacao_id: item.id, nome: item.name, cor: item.color ?? null });
        }
      }
      const unicas = new Map<number, any>();
      encontradas.forEach((q) => unicas.set(q.qualificacao_id, q));
      if (unicas.size > 0) {
        const { error } = await supabase
          .from("tresc_qualificacoes")
          .upsert([...unicas.values()], { onConflict: "qualificacao_id", ignoreDuplicates: true });
        if (error) throw error;
      }
      const { data: todas } = await supabase
        .from("tresc_qualificacoes").select("*").order("nome");
      return new Response(JSON.stringify({ ok: true, total: unicas.size, qualificacoes: todas || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === Sync de ligações do dia ===
    const agora = brtParts(new Date());
    const dia: string = body.dia || agora.dia;

    const params: Record<string, string> = {
      start_date: `${dia} 00:00:00`,
      end_date: `${dia} 23:59:59`,
      simple_paginate: "true",
      per_page: "500",
    };
    const campanhas: number[] = Array.isArray(cfg?.campanhas) ? cfg!.campanhas as number[] : [];
    if (campanhas.length > 0) params.campaign_ids = campanhas.join(",");

    const registros: any[] = [];
    for (let page = 1; page <= 40; page++) {
      const json = await tresc(base, token, "/calls", { ...params, page: String(page) });
      const lote = json?.data || [];
      registros.push(...lote);
      if (lote.length < 500) break;
    }

    const linhas = registros.map((c: any) => {
      const dt = c.call_date_rfc3339 ? new Date(c.call_date_rfc3339) : new Date(String(c.call_date).replace(" ", "T") + "-03:00");
      const p = brtParts(dt);
      return {
        call_id: String(c.id),
        data: p.dia,
        hora: `${p.hora}h-${p.hora + 1}h`,
        telefone: String(c.number ?? ""),
        telefone_sufixo: suf8(c.number),
        status_id: c.status_id ?? null,
        status_texto: c.readable_status_text ?? null,
        atendida: foiAtendida(c),
        qualificacao_id: c.qualification_id ?? null,
        qualificacao_nome: c.qualification && c.qualification !== "-" ? c.qualification : null,
        agente: c.agent && c.agent !== "-" ? c.agent : null,
        campanha: c.campaign ?? null,
        campanha_id: c.campaign_id ?? null,
        modo: c.mode ?? null,
        call_date: dt.toISOString(),
      };
    });

    if (linhas.length > 0) {
      for (let i = 0; i < linhas.length; i += 500) {
        const { error } = await supabase
          .from("tresc_ligacoes")
          .upsert(linhas.slice(i, i + 500), { onConflict: "call_id" });
        if (error) throw error;
      }
    }

    await supabase.from("tresc_config").update({ ultimo_sync: new Date().toISOString() }).eq("id", cfg?.id ?? "");

    // Repassa para o consolidador de relatório (soma WhatsApp + ligações)
    let repasse: any = { skipped: true };
    if (body.recalcular !== false) {
      const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/relatorio-acionamentos-sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({ dia, notificar: body.notificar === true }),
      });
      repasse = { status: res.status, body: (await res.text()).slice(0, 500) };
    }

    const porHora = HORAS.map((h) => {
      const ls = linhas.filter((l) => l.hora === h);
      return { hora: h, ligacoes: ls.length, atendidas: ls.filter((l) => l.atendida).length };
    });

    return new Response(JSON.stringify({ ok: true, dia, total: linhas.length, porHora, repasse }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("relatorio-3c-sync erro:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

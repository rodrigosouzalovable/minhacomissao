// Integração 3C Plus (API Discador)
// Ações: testar | campanhas | qualificacoes | sync
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.88.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_BASE = "https://app.3c.fluxoti.com/api/v1";

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

// Converte "00:01:23", "83" ou 83 em segundos
function segundos(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const s = String(v).trim();
  if (!s || s === "-" || s === "null") return 0;
  if (s.includes(":")) return s.split(":").map((p) => Number(p) || 0).reduce((a, n) => a * 60 + n, 0);
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

// ALÔ = houve conversa real com o agente
function foiAtendida(c: any): boolean {
  if (segundos(c?.speaking_with_agent_time) > 0) return true;
  if (segundos(c?.speaking_time) > 0) return true;
  const txt = String(c?.readable_status_text ?? c?.status_text ?? "").toLowerCase();
  if (txt.includes("atendida") && !txt.includes("não atendida") && !txt.includes("nao atendida")) return true;
  if (Number(c?.agent?.id ?? 0) > 0 && segundos(c?.billed_time) > 0) return true;
  return c?.has_agent === true;
}


async function tresc(base: string, token: string, path: string, params: Record<string, string> = {}) {
  const url = new URL(`${base.replace(/\/+$/, "")}${path}`);
  url.searchParams.set("api_token", token);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const t0 = Date.now();
  let res: Response;
  try {
    res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(25_000),
    });
  } catch (e) {
    console.error(`3C ${path} sem resposta após ${Date.now() - t0}ms:`, e);
    throw new Error(`3C ${path}: sem resposta em ${Math.round((Date.now() - t0) / 1000)}s (timeout da API 3C)`);
  }
  const body = await res.text();
  console.log(`3C ${path} [${res.status}] em ${Date.now() - t0}ms (${body.length} bytes)`);
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

    const perPage = Math.min(500, Math.max(10, Number(body.per_page ?? 500)));
    const params: Record<string, string> = {
      start_date: `${dia} 00:00:00`,
      end_date: `${dia} 23:59:59`,
      simple_paginate: "true",
      per_page: String(perPage),
    };
    const campanhas: number[] = Array.isArray(cfg?.campanhas) ? cfg!.campanhas as number[] : [];
    if (campanhas.length > 0) params.campaign_ids = campanhas.join(",");

    const val = (v: any) => (v && v !== "-" && v !== "null" ? v : null);
    const mapear = (c: any) => {
      const dt = c.call_date_rfc3339 ? new Date(c.call_date_rfc3339) : new Date(String(c.call_date).replace(" ", "T") + "-03:00");
      const p = brtParts(dt);
      const numero = String(c.number ?? c.phone ?? "");
      return {
        call_id: String(c.id ?? c._id),
        data: p.dia,
        hora: `${p.hora}h-${p.hora + 1}h`,
        telefone: numero,
        telefone_sufixo: suf8(numero),
        status_id: c.status_id ?? (typeof c.status === "number" ? c.status : null),
        status_texto: val(c.readable_status_text) ?? val(c.status_text) ?? null,
        atendida: foiAtendida(c),
        qualificacao_id: c.qualification_id ?? c.qualification?.id ?? null,
        qualificacao_nome: val(c.qualification?.name) ?? (typeof c.qualification === "string" ? val(c.qualification) : null),
        agente: val(c.agent?.name) ?? (typeof c.agent === "string" ? val(c.agent) : null),
        campanha: val(c.campaign?.name) ?? (typeof c.campaign === "string" ? val(c.campaign) : null),
        campanha_id: c.campaign_id ?? c.campaign?.id ?? null,
        modo: val(c.mode) ?? val(c.call_mode),
        call_date: dt.toISOString(),
      };
    };

    // Orçamento de tempo: grava por página e retoma na próxima chamada
    const inicio = Date.now();
    const orcamentoMs = Number(body.orcamento_ms ?? 50_000);
    const pageInicial = Math.max(1, Number(body.page_inicial ?? 1));
    const maxPaginas = Math.max(1, Number(body.max_paginas ?? 40));

    let totalGravado = 0;
    let paginasLidas = 0;
    let proximaPagina: number | null = null;
    const porHoraAcc = new Map<string, { ligacoes: number; atendidas: number }>();

    for (let page = pageInicial; page < pageInicial + maxPaginas; page++) {
      if (Date.now() - inicio > orcamentoMs) { proximaPagina = page; break; }

      const json = await tresc(base, token, "/calls", { ...params, page: String(page) });
      const lote = json?.data || [];
      paginasLidas++;
      console.log(`3C sync ${dia} pág.${page}: ${lote.length} ligações`);

      if (lote.length > 0) {
        const linhas = lote.map(mapear);
        const { error } = await supabase
          .from("tresc_ligacoes")
          .upsert(linhas, { onConflict: "call_id" });
        if (error) throw error;
        totalGravado += linhas.length;

        for (const l of linhas) {
          const acc = porHoraAcc.get(l.hora) ?? { ligacoes: 0, atendidas: 0 };
          acc.ligacoes++;
          if (l.atendida) acc.atendidas++;
          porHoraAcc.set(l.hora, acc);
        }

        await supabase.from("tresc_config")
          .update({ ultimo_sync: new Date().toISOString() })
          .eq("id", cfg?.id ?? "");
      }

      if (lote.length < perPage) break;
      if (page + 1 >= pageInicial + maxPaginas) proximaPagina = page + 1;
    }

    // Marca o sync mesmo quando o dia não tem ligações
    if (totalGravado === 0) {
      await supabase.from("tresc_config")
        .update({ ultimo_sync: new Date().toISOString() })
        .eq("id", cfg?.id ?? "");
    }

    // Se sobraram páginas, continua em outra invocação (evita estourar o tempo)
    if (proximaPagina) {
      const cont = fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/relatorio-3c-sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          action: "sync", dia, page_inicial: proximaPagina, per_page: perPage,
          orcamento_ms: orcamentoMs, notificar: body.notificar === true,
          recalcular: body.recalcular !== false,
        }),
      }).then((r) => console.log(`continuação pág.${proximaPagina}: ${r.status}`))
        .catch((e) => console.error("continuação falhou:", e));
      try { (globalThis as any).EdgeRuntime?.waitUntil?.(cont); } catch (_) { /* noop */ }
    }

    // Recalcula o relatório em segundo plano (não bloqueia a resposta)
    if (body.recalcular !== false && !proximaPagina) {
      const tarefa = fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/relatorio-acionamentos-sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({ dia, notificar: body.notificar === true }),
      }).then((r) => console.log(`repasse relatorio-acionamentos-sync: ${r.status}`))
        .catch((e) => console.error("repasse falhou:", e));
      try { (globalThis as any).EdgeRuntime?.waitUntil?.(tarefa); } catch (_) { /* noop */ }
    }

    const porHora = HORAS.map((h) => ({
      hora: h,
      ligacoes: porHoraAcc.get(h)?.ligacoes ?? 0,
      atendidas: porHoraAcc.get(h)?.atendidas ?? 0,
    }));

    console.log(`3C sync ${dia} concluído: ${totalGravado} gravadas em ${paginasLidas} páginas (próxima: ${proximaPagina ?? "-"})`);

    return new Response(JSON.stringify({
      ok: true, dia, total: totalGravado, paginas: paginasLidas,
      proxima_pagina: proximaPagina, porHora,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("relatorio-3c-sync erro:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

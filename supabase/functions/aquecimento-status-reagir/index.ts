// Executa interações agendadas em status postados pelas próprias instâncias do aquecimento:
// - visualizado (marca como visto)
// - reacao (emoji do pool customizável)
// - resposta (DM privada com frase do pool)
//
// Cron a cada 5min. Janela 08h-21h BRT, nunca aos domingos.
// Limites por instância/dia: 8 reações + 3 respostas (visualização sem limite).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.88.0";
import { getCalendarioHoje } from "../_shared/calendario-aquecimento.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_REACOES_DIA = 8;
const MAX_RESPOSTAS_DIA = 3;
const MAX_POR_RUN = 25; // teto por execução pra não estourar tempo
const STATUS_MAX_IDADE_HORAS = 24;

function brtNow(): Date {
  const now = new Date();
  return new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
}

function pick<T>(arr: T[]): T | null {
  if (!arr || arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

function jidFromInstancePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, "");
  if (digits.length < 10) return null;
  return `${digits}@s.whatsapp.net`;
}

async function uazPost(
  serverUrl: string,
  token: string,
  path: string,
  body: any,
): Promise<{ ok: boolean; status: number; text: string }> {
  const base = serverUrl.replace(/\/+$/, "");
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 20000);
    const res = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", token },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    const text = await res.text();
    return { ok: res.ok, status: res.status, text: text.substring(0, 300) };
  } catch (e) {
    return { ok: false, status: 0, text: e instanceof Error ? e.message : String(e) };
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
  const isManual = body?.action === "test";

  const brt = brtNow();
  const dow = brt.getDay();
  const hour = brt.getHours();

  if (!isManual) {
    const cal = await getCalendarioHoje(supabase);
    if (!cal.dentroJanela) {
      return new Response(JSON.stringify({ ok: true, skipped: cal.motivoSkip, hour, dow }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // Verifica habilitado
  const { data: cfgRow } = await supabase
    .from("whatsapp_aquecimento_config")
    .select("valor")
    .eq("chave", "engajamento_status_auto")
    .maybeSingle();
  const habilitado = !cfgRow || cfgRow.valor === true || cfgRow.valor === "true";
  if (!habilitado && !isManual) {
    return new Response(JSON.stringify({ ok: true, skipped: "disabled" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Busca interações pendentes (agendadas até agora)
  const nowIso = new Date().toISOString();
  const cutoffIdade = new Date(Date.now() - STATUS_MAX_IDADE_HORAS * 3600 * 1000).toISOString();

  const { data: pendentes, error: errPend } = await supabase
    .from("whatsapp_aquecimento_status_interacoes")
    .select(`
      id, status_log_id, instancia_id, tipo, agendado_para,
      whatsapp_aquecimento_status_log!inner(
        id, postado_em, whatsapp_msg_id, instancia_id,
        autor:user_whatsapp_instances!whatsapp_aquecimento_status_log_instancia_id_fkey(telefone)
      )
    `)
    .is("executado_em", null)
    .lte("agendado_para", nowIso)
    .gte("whatsapp_aquecimento_status_log.postado_em", cutoffIdade)
    .order("agendado_para", { ascending: true })
    .limit(MAX_POR_RUN);

  if (errPend) {
    console.error("[reagir] erro pendentes:", errPend);
    return new Response(JSON.stringify({ ok: false, error: errPend.message }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!pendentes || pendentes.length === 0) {
    return new Response(JSON.stringify({ ok: true, processed: 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Carrega instâncias necessárias
  const instIds = Array.from(new Set(pendentes.map((p: any) => p.instancia_id)));
  const { data: instancias } = await supabase
    .from("user_whatsapp_instances")
    .select("id, nome, server_url, instance_token, ativo, telefone")
    .in("id", instIds);
  const instMap = new Map((instancias || []).map((i: any) => [i.id, i]));

  // Pools
  const { data: emojis } = await supabase
    .from("whatsapp_aquecimento_status_emojis_pool")
    .select("emoji").eq("ativo", true);
  const { data: respostas } = await supabase
    .from("whatsapp_aquecimento_status_respostas_pool")
    .select("texto").eq("ativo", true);
  const emojiPool = (emojis || []).map((e: any) => e.emoji);
  const respostaPool = (respostas || []).map((r: any) => r.texto);

  // Conta limites diários (executados hoje)
  const startDayBrt = new Date(brt);
  startDayBrt.setHours(0, 0, 0, 0);
  const startDayIso = startDayBrt.toISOString();

  const { data: hoje } = await supabase
    .from("whatsapp_aquecimento_status_interacoes")
    .select("instancia_id, tipo, sucesso")
    .gte("executado_em", startDayIso)
    .eq("sucesso", true);
  const counters = new Map<string, { reacao: number; resposta: number }>();
  for (const r of hoje || []) {
    const c = counters.get(r.instancia_id) || { reacao: 0, resposta: 0 };
    if (r.tipo === "reacao") c.reacao++;
    else if (r.tipo === "resposta") c.resposta++;
    counters.set(r.instancia_id, c);
  }

  const results: any[] = [];

  for (const p of pendentes as any[]) {
    const inst = instMap.get(p.instancia_id);
    const log = p.whatsapp_aquecimento_status_log;
    const autorPhone = log?.autor?.telefone;
    const msgId = log?.whatsapp_msg_id;

    let sucesso = false;
    let erro: string | null = null;

    if (!inst || !inst.ativo) {
      erro = "instancia_inativa";
    } else if (p.tipo !== "reacao" && !autorPhone) {
      erro = "autor_sem_numero";
    } else if (p.tipo !== "visualizado" && !msgId) {
      erro = "sem_msg_id";
    } else {
      const c = counters.get(p.instancia_id) || { reacao: 0, resposta: 0 };
      if (p.tipo === "reacao" && c.reacao >= MAX_REACOES_DIA) {
        erro = "limite_reacoes_dia";
      } else if (p.tipo === "resposta" && c.resposta >= MAX_RESPOSTAS_DIA) {
        erro = "limite_respostas_dia";
      } else {
        const autorJid = jidFromInstancePhone(autorPhone);
        const statusJid = "status@broadcast";

        if (p.tipo === "visualizado") {
          // Múltiplos endpoints UAZAPI possíveis — tenta os mais comuns
          let r = await uazPost(inst.server_url, inst.instance_token, "/chat/markStatusAsRead", {
            number: autorJid, messageId: msgId,
          });
          if (!r.ok) {
            r = await uazPost(inst.server_url, inst.instance_token, "/message/markAsRead", {
              number: autorJid, messageId: msgId,
            });
          }
          sucesso = r.ok;
          erro = r.ok ? null : `${r.status}: ${r.text}`;
        } else if (p.tipo === "reacao") {
          const emoji = pick(emojiPool) || "❤️";
          // Atualiza conteúdo da row pra log
          await supabase
            .from("whatsapp_aquecimento_status_interacoes")
            .update({ conteudo: emoji })
            .eq("id", p.id);

          // UAZAPI endpoint para reação: tenta variações conhecidas
          const reactAttempts = [
            { path: "/message/reaction", body: { number: statusJid, id: msgId, text: emoji } },
            { path: "/message/react", body: { number: statusJid, id: msgId, text: emoji } },
            { path: "/send/reaction", body: { number: statusJid, id: msgId, text: emoji } },
            { path: "/message/reactMessage", body: { number: statusJid, messageId: msgId, reaction: emoji } },
          ];
          let r: any = { ok: false, status: 0, text: "no attempt" };
          for (const attempt of reactAttempts) {
            r = await uazPost(inst.server_url, inst.instance_token, attempt.path, attempt.body);
            if (r.ok) break;
          }
          sucesso = r.ok;
          erro = r.ok ? null : `${r.status}: ${r.text}`;
          if (sucesso) {
            const c2 = counters.get(p.instancia_id) || { reacao: 0, resposta: 0 };
            c2.reacao++;
            counters.set(p.instancia_id, c2);
          }
        } else if (p.tipo === "resposta") {
          const texto = pick(respostaPool) || "Que linda!";
          await supabase
            .from("whatsapp_aquecimento_status_interacoes")
            .update({ conteudo: texto })
            .eq("id", p.id);

          const r = await uazPost(inst.server_url, inst.instance_token, "/send/text", {
            number: autorJid,
            text: texto,
          });
          sucesso = r.ok;
          erro = r.ok ? null : `${r.status}: ${r.text}`;
          if (sucesso) {
            const c2 = counters.get(p.instancia_id) || { reacao: 0, resposta: 0 };
            c2.resposta++;
            counters.set(p.instancia_id, c2);
          }
        }
      }
    }

    await supabase
      .from("whatsapp_aquecimento_status_interacoes")
      .update({
        executado_em: new Date().toISOString(),
        sucesso,
        erro: erro?.substring(0, 500) || null,
      })
      .eq("id", p.id);

    results.push({ id: p.id, tipo: p.tipo, sucesso, erro });

    // Espaçamento mínimo 90s entre ações da mesma instância? Aqui simplificamos com 3-8s entre quaisquer
    if (!isManual) {
      await new Promise((r) => setTimeout(r, 3000 + Math.random() * 5000));
    }
  }

  const fallback = results.some((r) => !r.sucesso);
  return new Response(
    JSON.stringify({ ok: true, processed: results.length, results, fallback }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});

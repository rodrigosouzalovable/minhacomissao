// Sincroniza o Relatório de Acionamentos com os dados do Inbox Meta Oficial
// e envia resumo no WhatsApp (parcial de hora em hora + consolidado do dia).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.88.0";
import { notificarNumeros } from "../_shared/notificar-numeros.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DESTINATARIOS = ["62991672674", "62994300880"];

const HORAS = [
  "8h-9h", "9h-10h", "10h-11h", "11h-12h", "12h-13h", "13h-14h",
  "14h-15h", "15h-16h", "16h-17h", "17h-18h", "18h-19h",
];
const HORA_INICIO = 8; // 08h BRT
const horaLabel = (h: number) => `${h}h-${h + 1}h`;

const suf8 = (t: unknown) => String(t ?? "").replace(/\D/g, "").slice(-8);
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (num: number, den: number) => (den > 0 ? `${((num / den) * 100).toFixed(1).replace(".", ",")}%` : "0%");

function brtParts(d: Date) {
  const s = d.toLocaleString("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
  // formato: 2026-08-05, 14:32
  const [dia, hm] = s.split(", ");
  const [hh, mm] = hm.split(":");
  return { dia, hora: Number(hh), minuto: Number(mm) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    let body: any = {};
    try { body = await req.json(); } catch (_) { /* sem body */ }

    const agora = brtParts(new Date());
    const dia: string = body.dia || agora.dia;
    const notificar: boolean = body.notificar !== false;
    const consolidado: boolean = body.consolidado === true;

    // Janela do dia em BRT
    const inicioDia = `${dia}T00:00:00-03:00`;
    const fimDia = `${dia}T23:59:59-03:00`;

    // === Mensagens do Inbox Meta no dia ===
    const { data: msgs, error: msgsErr } = await supabase
      .from("meta_whatsapp_mensagens")
      .select("telefone, direcao, timestamp_msg")
      .gte("timestamp_msg", inicioDia)
      .lte("timestamp_msg", fimDia)
      .limit(100000);
    if (msgsErr) throw msgsErr;

    // === Acordos criados no dia ===
    const { data: acordos, error: acErr } = await supabase
      .from("acordos")
      .select("cliente_telefone, valor_total, criado_em")
      .gte("criado_em", inicioDia)
      .lte("criado_em", fimDia)
      .limit(20000);
    if (acErr) throw acErr;

    const acordoSufixos = new Set(
      (acordos || []).map((a: any) => suf8(a.cliente_telefone)).filter((s: string) => s.length === 8),
    );

    // Buckets por hora
    type Bucket = { saida: Set<string>; entrada: Set<string> };
    const buckets = new Map<string, Bucket>();
    for (const h of HORAS) buckets.set(h, { saida: new Set(), entrada: new Set() });

    for (const m of (msgs || []) as any[]) {
      const s = suf8(m.telefone);
      if (!s) continue;
      const p = brtParts(new Date(m.timestamp_msg));
      const label = horaLabel(p.hora);
      const b = buckets.get(label);
      if (!b) continue; // fora da faixa 08h-19h
      if (String(m.direcao) === "saida") b.saida.add(s);
      else b.entrada.add(s);
    }

    // Primeiro toque por telefone no dia (evita contar o mesmo cliente 2x)
    const jaAcionado = new Set<string>();
    const jaRespondeu = new Set<string>();
    const linhas: Array<{ hora: string; whatsapp: number; cpc: number; cpca: number }> = [];

    for (const h of HORAS) {
      const b = buckets.get(h)!;
      let whatsapp = 0, cpc = 0, cpca = 0;
      for (const s of b.saida) {
        if (jaAcionado.has(s)) continue;
        jaAcionado.add(s);
        whatsapp++;
      }
      for (const s of b.entrada) {
        if (jaRespondeu.has(s)) continue;
        jaRespondeu.add(s);
        cpc++;
        if (acordoSufixos.has(s)) cpca++;
      }
      linhas.push({ hora: h, whatsapp, cpc, cpca });
    }

    // === Linhas já existentes (respeita edições manuais) ===
    const { data: existentes } = await supabase
      .from("relatorio_acionamentos")
      .select("hora, tentativas, whatsapp, cpc, cpca, acordos_valor, whatsapp_manual, cpc_manual, cpca_manual, tentativas_manual")
      .eq("data", dia);
    const exMap = new Map<string, any>();
    (existentes || []).forEach((r: any) => exMap.set(r.hora, r));

    const upserts = linhas.map((l) => {
      const ex = exMap.get(l.hora) || {};
      return {
        data: dia,
        hora: l.hora,
        whatsapp_auto: l.whatsapp,
        cpc_auto: l.cpc,
        cpca_auto: l.cpca,
        tentativas_auto: l.whatsapp,
        whatsapp: ex.whatsapp_manual ? ex.whatsapp ?? 0 : l.whatsapp,
        cpc: ex.cpc_manual ? ex.cpc ?? 0 : l.cpc,
        cpca: ex.cpca_manual ? ex.cpca ?? 0 : l.cpca,
        tentativas: ex.tentativas_manual ? ex.tentativas ?? 0 : l.whatsapp,
        sync_em: new Date().toISOString(),
      };
    });

    const { error: upErr } = await supabase
      .from("relatorio_acionamentos")
      .upsert(upserts, { onConflict: "data,hora" });
    if (upErr) throw upErr;

    // Totais (usa valores finais gravados + valor de acordos já existente na tabela)
    const { data: finais } = await supabase
      .from("relatorio_acionamentos")
      .select("hora, tentativas, whatsapp, alo, cpc, cpca, acordos_valor")
      .eq("data", dia);

    const tot = { tentativas: 0, whatsapp: 0, alo: 0, cpc: 0, cpca: 0, valor: 0 };
    (finais || []).forEach((r: any) => {
      tot.tentativas += r.tentativas || 0;
      tot.whatsapp += r.whatsapp || 0;
      tot.alo += r.alo || 0;
      tot.cpc += r.cpc || 0;
      tot.cpca += r.cpca || 0;
      tot.valor += Number(r.acordos_valor || 0);
    });

    const totalAcordos = (acordos || []).length;
    const valorAcordos = (acordos || []).reduce((s: number, a: any) => s + Number(a.valor_total || 0), 0);

    let enviado: any = { skipped: true };
    if (notificar) {
      const [a, m, d] = dia.split("-");
      const dataFmt = `${d}/${m}/${a}`;
      const titulo = consolidado
        ? `📊 *RELATÓRIO CONSOLIDADO — ${dataFmt}*`
        : `📊 *PARCIAL ${dataFmt} — ${String(agora.hora).padStart(2, "0")}h*`;

      const linhasMsg = [
        titulo,
        "",
        `📣 Acionamentos: *${tot.tentativas}*`,
        `💬 WhatsApp (Meta): *${tot.whatsapp}*`,
        `🗣️ Interações/CPC: *${tot.cpc}*  (${pct(tot.cpc, tot.tentativas)})`,
        `🤝 CPC-A: *${tot.cpca}*  (${pct(tot.cpca, tot.cpc)})`,
        `📄 Acordos lançados: *${totalAcordos}*`,
        `💵 Valor em acordos: *${brl(valorAcordos || tot.valor)}*`,
        "",
        "*Por hora (acion. / CPC / CPC-A):*",
        ...(finais || [])
          .slice()
          .sort((x: any, y: any) => HORAS.indexOf(x.hora) - HORAS.indexOf(y.hora))
          .filter((r: any) => (r.tentativas || 0) + (r.cpc || 0) > 0)
          .map((r: any) => `• ${r.hora}: ${r.tentativas || 0} / ${r.cpc || 0} / ${r.cpca || 0}`),
      ];

      const chave = consolidado
        ? `relat-acion-consol-${dia}`
        : `relat-acion-${dia}-${String(agora.hora).padStart(2, "0")}h`;

      enviado = await notificarNumeros(supabase, {
        tipo: consolidado ? "relatorio_acionamentos_dia" : "relatorio_acionamentos_hora",
        mensagem: linhasMsg.join("\n"),
        destinatarios: DESTINATARIOS,
        chaveIdempotencia: chave,
      });
    }

    return new Response(JSON.stringify({ ok: true, dia, totais: tot, totalAcordos, valorAcordos, notificacao: enviado }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("relatorio-acionamentos-sync erro:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

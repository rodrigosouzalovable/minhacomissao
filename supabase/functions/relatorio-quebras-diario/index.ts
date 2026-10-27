// Relatório diário (08h30 BRT, seg–sáb) de quebras da 1ª parcela, enviado ao WhatsApp do admin.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.88.0";
import { enqueueAdminNotification } from "../_shared/enqueue-admin-notification.ts";

const DESTINO = "62991672674";
const NOMES: Record<string, string> = { ume_novo_mundo: "UME", odres_cred: "Odres Cred", mundo_da_moda: "Novo Mundo" };
const brl = (v: number) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");

Deno.serve(async () => {
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const hoje = new Date(Date.now() - 3 * 3600000);
  const ontem = new Date(hoje.getTime() - 86400000);
  if (ontem.getUTCDay() === 0) ontem.setUTCDate(ontem.getUTCDate() - 1); // segunda olha sábado
  const dia = ontem.toISOString().slice(0, 10);
  const { data, error } = await db.rpc("relatorio_quebras_diario", { p_dia: dia });
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  const r = data as any;
  const linhas = (r.ontem ?? []).map((x: any) =>
    `• ${NOMES[x.empresa] ?? x.empresa}: ${x.pagos}/${x.total} pagas (${pct(x.pagos, x.total)}) · quebrado ${brl(x.valor_quebrado)}`);
  const tot = (r.ontem ?? []).reduce((s: any, x: any) => ({ t: s.t + x.total, p: s.p + x.pagos, v: s.v + Number(x.valor_quebrado) }), { t: 0, p: 0, v: 0 });
  const msg = [
    `📉 *Quebras da 1ª parcela — ${dia.split("-").reverse().join("/")}*`,
    linhas.length ? linhas.join("\n") : "Nenhuma 1ª parcela vencia nesse dia.",
    `*Total:* ${tot.p}/${tot.t} pagas (${pct(tot.p, tot.t)}) · quebrado ${brl(tot.v)}`,
    ``,
    `📊 Últimos 7 dias: ${pct(r.semana_pagos, r.semana_total)} de efetivação (${r.semana_pagos}/${r.semana_total})`,
    `⚡ Entrada hoje/amanhã: ${pct(r.curtos_pagos, r.curtos_total)} (${r.curtos_pagos}/${r.curtos_total})`,
    `🐢 Entrada com prazo maior: ${pct(r.longos_pagos, r.longos_total)} (${r.longos_pagos}/${r.longos_total})`,
    ``,
    `👉 Acione hoje os ${tot.t - tot.p} clientes que quebraram ontem com novo PIX.`,
  ].join("\n");
  const q = await enqueueAdminNotification(db, { tipo: "relatorio_quebras", mensagem: msg, destinatario: DESTINO, chaveIdempotencia: `quebras-${dia}` });
  return new Response(JSON.stringify({ ok: true, q, preview: msg }), { headers: { "Content-Type": "application/json" } });
});

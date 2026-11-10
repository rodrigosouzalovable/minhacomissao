// Rotina de recuperação de acordos com parcela vencida (UME + Odres Cred).
// Seg–sáb 09:30 BRT. Autorizada só pelo token do agendamento 'recuperacao-quebrados-0930'.
// Também resgata acordos QUEBRADOS (1ª parcela vencida há 11–60 dias), 1 envio a cada 15 dias por número.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { carregarParcelasPagas, parcelaJaPaga } from "../_shared/parcela-ja-paga.ts";
import { CREDOR_PREVENTIVO, datasAlvoPreventivo, montarClientesPreventivo } from "../_shared/lembrete-preventivo.ts";

const DONO = "ee649720-b8ce-47a2-859e-100a3a9ae6bb";
const TEMPLATE = "abertura_para_reagendamento_de_pagamento";
const CREDOR: Record<string, string> = { ume_novo_mundo: "UME", odres_cred: "Odres Cred" };
const PREV_TEMPLATE = "novo_lembrete_envio_boleto_variavel";
const PREV_NOME = "Lembrete preventivo auto";

const json = (p: unknown, status = 200) =>
  new Response(JSON.stringify(p), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const isoBRT = (d = 0) => new Date(Date.now() - 3 * 3600_000 + d * 86400_000).toISOString().slice(0, 10);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const db = createClient(url, key);
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const { data: ok } = await db.rpc("recuperacao_quebrados_autorizada", { p_token: token });
  if (ok !== true) return json({ success: false, error: "Acesso interno obrigatório" }, 403);

  const body = await req.json().catch(() => ({}));
  const dias = Math.min(31, Math.max(1, Number(body?.dias ?? 7)));
  if (new Date(Date.now() - 3 * 3600_000).getUTCDay() === 0) return json({ success: true, pulado: "domingo" });

  const hoje = isoBRT(0), inicio = isoBRT(-dias);
  const rows: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("pagamentos")
      .select("data_prevista,valor_parcela,acordos!inner(cliente_nome,cliente_telefone,cliente_cpf,empresa,status)")
      .eq("status", "pendente").gte("data_prevista", inicio).lt("data_prevista", hoje)
      .eq("acordos.status", "ativo").in("acordos.empresa", ["ume_novo_mundo", "odres_cred"])
      .order("data_prevista", { ascending: false }).range(from, from + 999);
    if (error) return json({ success: false, error: error.message }, 500);
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
  }

  // Últimos 3 dias já acionados por esta rotina ficam de fora.
  const { data: jobs } = await db.from("envio_meta_job").select("id")
    .eq("user_id", DONO).ilike("nome_campanha", "Recuperação quebrados%")
    .gte("created_at", new Date(Date.now() - 3 * 86400_000).toISOString());
  const recentes = new Set<string>();
  const jobIds = (jobs || []).map((j: any) => j.id);
  for (let i = 0; i < jobIds.length; i += 50) {
    for (let from = 0; ; from += 1000) {
      const { data } = await db.from("envio_meta_job_item").select("telefone")
        .in("job_id", jobIds.slice(i, i + 50)).range(from, from + 999);
      for (const it of data || []) recentes.add(String(it.telefone || "").replace(/\D/g, "").slice(-8));
      if (!data || data.length < 1000) break;
    }
  }

  const mesAtual = hoje.slice(0, 7);
  const pagas = await carregarParcelasPagas(db, rows.map((r: any) => r.acordos?.cliente_cpf));
  let puladosPagos = 0;
  const porSuf = new Map<string, any>();
  for (const r of rows) {
    const a = r.acordos;
    if (parcelaJaPaga(pagas, a?.cliente_cpf, a?.empresa, r.data_prevista, mesAtual)) { puladosPagos++; continue; }
    let tel = String(a?.cliente_telefone || "").replace(/\D/g, "");
    if (tel.length < 10 || tel.length > 13) continue;
    if (!tel.startsWith("55")) tel = `55${tel}`;
    if (tel.length < 12) continue;
    const suf = tel.slice(-8);
    if (recentes.has(suf)) continue;
    const atual = porSuf.get(suf);
    if (atual) { atual.saldo += Number(r.valor_parcela || 0); continue; }
    const p = String(a?.cliente_nome || "cliente").trim().split(/\s+/)[0] || "cliente";
    const nome = p[0].toUpperCase() + p.slice(1).toLowerCase();
    const [y, m, d] = r.data_prevista.split("-");
    const credor = CREDOR[a.empresa] || a.empresa;
    porSuf.set(suf, { telefone: tel, nome, cpf: a.cliente_cpf || undefined, saldo: Number(r.valor_parcela || 0),
      vars: { name: nome, nome, "1": nome, "2": credor, "3": `${d}/${m}/${y}` } });
  }
  // ===== Acordos já QUEBRADOS (1ª parcela vencida entre 11 e 60 dias) =====
  // Cadência: no máximo 1 mensagem a cada 15 dias por número; pula quem já tem acordo ativo.
  const { data: jobs15 } = await db.from("envio_meta_job").select("id")
    .eq("user_id", DONO).ilike("nome_campanha", "Recuperação quebrados%")
    .gte("created_at", new Date(Date.now() - 15 * 86400_000).toISOString());
  const recentes15 = new Set<string>(recentes);
  const ids15 = (jobs15 || []).map((j: any) => j.id).filter((id: string) => !jobIds.includes(id));
  for (let i = 0; i < ids15.length; i += 50) {
    for (let from = 0; ; from += 1000) {
      const { data } = await db.from("envio_meta_job_item").select("telefone")
        .in("job_id", ids15.slice(i, i + 50)).range(from, from + 999);
      for (const it of data || []) recentes15.add(String(it.telefone || "").replace(/\D/g, "").slice(-8));
      if (!data || data.length < 1000) break;
    }
  }
  const quebrados: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("acordos")
      .select("cliente_nome,cliente_telefone,cliente_cpf,empresa,data_primeiro_pagamento,valor_parcela")
      .eq("status", "quebrado").in("empresa", ["ume_novo_mundo", "odres_cred"])
      .gte("data_primeiro_pagamento", isoBRT(-60)).lte("data_primeiro_pagamento", isoBRT(-11))
      .range(from, from + 999);
    if (error) break;
    quebrados.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  const cpfsQ = [...new Set(quebrados.map((q) => String(q.cliente_cpf || "").replace(/\D/g, "")).filter(Boolean))];
  const cpfsAtivos = new Set<string>();
  for (let i = 0; i < cpfsQ.length; i += 200) {
    const { data } = await db.from("acordos").select("cliente_cpf").eq("status", "ativo")
      .in("cliente_cpf", cpfsQ.slice(i, i + 200));
    for (const a of data || []) cpfsAtivos.add(String(a.cliente_cpf || "").replace(/\D/g, ""));
  }
  // Acordos ainda "ativos" com parcela pendente vencida há 11–60 dias (na prática, quebrados).
  const ativosAtrasados: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("pagamentos")
      .select("data_prevista,valor_parcela,acordos!inner(cliente_nome,cliente_telefone,cliente_cpf,empresa,status)")
      .eq("status", "pendente").gte("data_prevista", isoBRT(-60)).lte("data_prevista", isoBRT(-11))
      .eq("acordos.status", "ativo").in("acordos.empresa", ["ume_novo_mundo", "odres_cred"])
      .order("data_prevista", { ascending: true }).range(from, from + 999);
    if (error) break;
    for (const r of data || []) ativosAtrasados.push({ ...r.acordos, data_primeiro_pagamento: r.data_prevista,
      valor_parcela: r.valor_parcela, _ativo: true });
    if (!data || data.length < 1000) break;
  }
  let qtdQuebrados = 0;
  pagas.push(...await carregarParcelasPagas(db, [...ativosAtrasados, ...quebrados].map((a: any) => a.cliente_cpf)));
  for (const a of [...ativosAtrasados, ...quebrados]) {
    if (!a._ativo && cpfsAtivos.has(String(a.cliente_cpf || "").replace(/\D/g, ""))) continue;
    if (parcelaJaPaga(pagas, a.cliente_cpf, a.empresa, String(a.data_primeiro_pagamento).slice(0, 10), mesAtual)) { puladosPagos++; continue; }
    let tel = String(a.cliente_telefone || "").replace(/\D/g, "");
    if (tel.length < 10 || tel.length > 13) continue;
    if (!tel.startsWith("55")) tel = `55${tel}`;
    if (tel.length < 12) continue;
    const suf = tel.slice(-8);
    if (recentes15.has(suf) || porSuf.has(suf)) continue;
    const p = String(a.cliente_nome || "cliente").trim().split(/\s+/)[0] || "cliente";
    const nome = p[0].toUpperCase() + p.slice(1).toLowerCase();
    const [y, m, d] = String(a.data_primeiro_pagamento).slice(0, 10).split("-");
    const credor = CREDOR[a.empresa] || a.empresa;
    porSuf.set(suf, { telefone: tel, nome, cpf: a.cliente_cpf || undefined, saldo: Number(a.valor_parcela || 0),
      vars: { name: nome, nome, "1": nome, "2": credor, "3": `${d}/${m}/${y}` } });
    qtdQuebrados++;
  }
  console.log(`[recuperacao-quebrados] vencidos=${porSuf.size - qtdQuebrados} quebrados=${qtdQuebrados} pulados_parcela_ja_paga=${puladosPagos}`);

  // ===== Lembrete preventivo D-1 (mesmo agendamento, campanha separada) =====
  let preventivo: unknown = null;
  try { preventivo = await lancarPreventivo(db, url, key, hoje, new Set(porSuf.keys())); }
  catch (e) { preventivo = { success: false, error: e instanceof Error ? e.message : String(e) }; }
  console.log("[lembrete-preventivo]", JSON.stringify(preventivo));

  const clientes = [...porSuf.values()];
  if (!clientes.length) return json({ success: true, clientes: 0, preventivo });

  const { data: inst } = await db.from("meta_whatsapp_instances").select("id")
    .eq("user_id", DONO).eq("ativo", true).eq("saude_status", "CONNECTED").eq("saude_quality", "GREEN")
    .eq("estado_pool", "ativo").eq("instancia_teste_aquecimento", false);
  const ids = (inst || []).map((i: any) => i.id);
  const { data: tpls } = await db.from("meta_whatsapp_templates").select("id,instancia_id")
    .in("instancia_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"])
    .eq("nome_template", TEMPLATE).eq("status", "approved");
  const byInst: Record<string, string> = {};
  for (const t of tpls || []) byInst[t.instancia_id] = t.id;
  const instIds = Object.keys(byInst);
  if (!instIds.length) return json({ success: false, error: "nenhum número GREEN com o modelo" }, 400);

  const resp = await fetch(`${url}/functions/v1/envio-meta-massa-iniciar`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      asUserId: DONO, template: { id: byInst[instIds[0]], nome_template: TEMPLATE },
      instanciaIds: instIds, templateIdByInstance: byInst, clientes, minSec: 3, maxSec: 8,
      nomeCampanha: `Recuperação quebrados auto ${hoje}`, validarNoEnvio: false,
    }),
  });
  const out = await resp.json().catch(() => ({}));
  return json({ success: resp.ok, clientes: clientes.length, quebrados: qtdQuebrados, numeros: instIds.length, resultado: out, preventivo }, resp.ok ? 200 : 500);
});

// Parcelas pendentes de acordos ativos que vencem amanhã (sábado: domingo e segunda).
async function lancarPreventivo(db: any, url: string, key: string, hoje: string, jaAcionados: Set<string>) {
  const datas = datasAlvoPreventivo(hoje);
  if (!datas.length) return { success: true, clientes: 0 };
  const rows: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("pagamentos")
      .select("data_prevista,valor_parcela,acordos!inner(cliente_nome,cliente_telefone,cliente_cpf,empresa,status)")
      .eq("status", "pendente").in("data_prevista", datas)
      .eq("acordos.status", "ativo").in("acordos.empresa", Object.keys(CREDOR_PREVENTIVO))
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    for (const r of data || []) rows.push({ ...r.acordos, data_prevista: r.data_prevista, valor_parcela: r.valor_parcela });
    if (!data || data.length < 1000) break;
  }
  // Evita repetir no mesmo dia caso a rotina seja chamada de novo.
  const excluir = new Set(jaAcionados);
  const { data: jobsHoje } = await db.from("envio_meta_job").select("id")
    .eq("user_id", DONO).ilike("nome_campanha", `${PREV_NOME}%`)
    .gte("created_at", new Date(Date.now() - 20 * 3600_000).toISOString());
  for (const j of jobsHoje || []) {
    for (let from = 0; ; from += 1000) {
      const { data } = await db.from("envio_meta_job_item").select("telefone").eq("job_id", j.id).range(from, from + 999);
      for (const it of data || []) excluir.add(String(it.telefone || "").replace(/\D/g, "").slice(-8));
      if (!data || data.length < 1000) break;
    }
  }
  const pagasPrev = await carregarParcelasPagas(db, rows.map((r: any) => r.cliente_cpf));
  const semPagos = rows.filter((r: any) => !parcelaJaPaga(pagasPrev, r.cliente_cpf, r.empresa, r.data_prevista, hoje.slice(0, 7)));
  console.log(`[lembrete-preventivo] pulados_parcela_ja_paga=${rows.length - semPagos.length}`);
  const clientes = montarClientesPreventivo(semPagos, hoje, excluir);
  if (!clientes.length) return { success: true, clientes: 0 };

  const { data: inst } = await db.from("meta_whatsapp_instances").select("id")
    .eq("user_id", DONO).eq("ativo", true).eq("saude_status", "CONNECTED").eq("saude_quality", "GREEN")
    .eq("estado_pool", "ativo").eq("instancia_teste_aquecimento", false);
  const ids = (inst || []).map((i: any) => i.id);
  const { data: tpls } = await db.from("meta_whatsapp_templates").select("id,instancia_id")
    .in("instancia_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"])
    .eq("nome_template", PREV_TEMPLATE).eq("status", "approved").ilike("categoria", "utility");
  const byInst: Record<string, string> = {};
  for (const t of tpls || []) byInst[t.instancia_id] = t.id;
  const instIds = Object.keys(byInst);
  if (!instIds.length) return { success: false, clientes: clientes.length, error: "nenhum número GREEN com o modelo Utility" };

  const resp = await fetch(`${url}/functions/v1/envio-meta-massa-iniciar`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      asUserId: DONO, template: { id: byInst[instIds[0]], nome_template: PREV_TEMPLATE },
      instanciaIds: instIds, templateIdByInstance: byInst, clientes, minSec: 5, maxSec: 10,
      nomeCampanha: `${PREV_NOME} ${hoje}`, validarNoEnvio: false,
    }),
  });
  const out = await resp.json().catch(() => ({}));
  return { success: resp.ok, clientes: clientes.length, numeros: instIds.length, resultado: out };
}

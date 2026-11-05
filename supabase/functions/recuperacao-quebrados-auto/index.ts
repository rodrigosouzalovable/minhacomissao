// Rotina de recuperação de acordos com parcela vencida (UME + Odres Cred).
// Seg–sáb 09:30 BRT. Autorizada só pelo token do agendamento 'recuperacao-quebrados-0930'.
// Também resgata acordos QUEBRADOS (1ª parcela vencida há 11–60 dias), 1 envio a cada 15 dias por número.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const DONO = "ee649720-b8ce-47a2-859e-100a3a9ae6bb";
const TEMPLATE = "abertura_para_reagendamento_de_pagamento";
const CREDOR: Record<string, string> = { ume_novo_mundo: "UME", odres_cred: "Odres Cred" };

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

  const porSuf = new Map<string, any>();
  for (const r of rows) {
    const a = r.acordos;
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
  for (const a of [...ativosAtrasados, ...quebrados]) {
    if (!a._ativo && cpfsAtivos.has(String(a.cliente_cpf || "").replace(/\D/g, ""))) continue;
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
  console.log(`[recuperacao-quebrados] vencidos=${porSuf.size - qtdQuebrados} quebrados=${qtdQuebrados}`);

  const clientes = [...porSuf.values()];
  if (!clientes.length) return json({ success: true, clientes: 0 });

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
  return json({ success: resp.ok, clientes: clientes.length, quebrados: qtdQuebrados, numeros: instIds.length, resultado: out }, resp.ok ? 200 : 500);
});

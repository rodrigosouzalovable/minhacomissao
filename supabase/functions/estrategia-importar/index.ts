// Edge function: importa planilha CLIENTES SOUZA E RIBEIRO e popula estrategia_cliente.
// Recebe { storagePath, fileName }. Baixa do Storage e processa em background (EdgeRuntime.waitUntil)
// para evitar limites de CPU/memória da request. Retorna importacao_id imediatamente.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function normalizeCpf(v: any): string {
  return String(v ?? "").replace(/\D/g, "").padStart(11, "0").slice(-11);
}
function normalizePhone(v: any): string {
  return String(v ?? "").replace(/\D/g, "");
}
function faixaValor(v: number): string {
  if (v < 100) return "<100";
  if (v < 200) return "100-199";
  if (v < 300) return "200-299";
  if (v < 400) return "300-399";
  if (v < 500) return "400-499";
  return "500+";
}
function parseDate(v: any): string | null {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v);
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}
function calcScore(c: any): number {
  let s = 0;
  if (c.localizado) s += 30;
  if (c.parcelas_abertas_qtd === 1) s += 25;
  if (c.acordo_quebrado) s += 10;
  const fx = c.faixa_valor_parcela;
  if (fx === "200-299" || fx === "300-399" || fx === "400-499") s += 15;
  else if (fx === "500+") s += 10;
  else if (fx === "100-199") s += 8;
  else if (fx === "<100") s += 3;
  const a = c.atraso_dias ?? 0;
  if (a >= 60 && a <= 360) s += 10;
  else if (a >= 30 && a < 60) s += 5;
  else if (a > 360) s += 3;
  if (c.tipo_credor === "APORTE") s += 5;
  if (!c.localizado) s -= 10;
  return Math.max(0, Math.min(100, s));
}

async function processarPlanilha(supabase: any, importacaoId: string, storagePath: string) {
  try {
    const { data: blob, error: dlErr } = await supabase.storage
      .from("estrategia-uploads")
      .download(storagePath);
    if (dlErr) throw dlErr;
    const buf = new Uint8Array(await blob.arrayBuffer());
    const wb = XLSX.read(buf, { type: "array", cellDates: true });

    const readSheet = (name: string, headers?: string[]) => {
      const ws = wb.Sheets[name];
      if (!ws) return [];
      return XLSX.utils.sheet_to_json<any>(ws, headers ? { header: headers } : {});
    };

    const cobranca = readSheet("Cobrança");
    const csim = readSheet("CSIM");
    const cnao = readSheet("CNAO");
    const aqRaw = readSheet("ACORDO QUEBRADO", ["CPF","col2","col3","col4"]);
    const parcelasSheets = [
      "PARCELA 1","PARCELA 2","PARCELA 3","PARCELA 4","PARCELA 5","PARCELA 6",
      "PARCELA 7","PARCELA 8","PARCELA 9","PARCELA 10","PARCELA 11","PARCELA 12",
      "PARCELA 13","PARCELA 14","PARCELA 15","PARCELA 16","PARCELA 17","PARCELA 18+"
    ];

    const phoneMap = new Map<string, { tel: string; nome: string }>();
    const nomeMap = new Map<string, string>();
    for (const r of csim) {
      const cpf = normalizeCpf(r["CPF/CNPJ"]);
      if (!cpf) continue;
      const tel = normalizePhone(r["NUMERO"]);
      const nome = String(r["CLIENTE"] ?? "").trim();
      if (tel && !phoneMap.has(cpf)) phoneMap.set(cpf, { tel, nome });
      if (nome && !nomeMap.has(cpf)) nomeMap.set(cpf, nome);
    }
    for (const r of cnao) {
      const cpf = normalizeCpf(r["CPF/CNPJ"]);
      if (!cpf) continue;
      const nome = String(r["CLIENTE"] ?? "").trim();
      if (nome && !nomeMap.has(cpf)) nomeMap.set(cpf, nome);
    }

    const quebradosSet = new Set<string>();
    for (const r of aqRaw) {
      const cpf = normalizeCpf(r["CPF"]);
      if (cpf) quebradosSet.add(cpf);
    }

    type ParcInfo = { num: number; valor: number; venc: string | null };
    const parcMap = new Map<string, ParcInfo[]>();
    for (const sheetName of parcelasSheets) {
      const ws = wb.Sheets[sheetName];
      if (!ws) continue;
      const rows = XLSX.utils.sheet_to_json<any>(ws, { header: ["CPF","NUMERO","VENCIMENTO","VALOR"] });
      for (const r of rows) {
        const cpf = normalizeCpf(r["CPF"]);
        if (!cpf || cpf === "00000000000") continue;
        const num = Number(r["NUMERO"]);
        const valor = Number(r["VALOR"]);
        if (!isFinite(num) || !isFinite(valor)) continue;
        const venc = parseDate(r["VENCIMENTO"]);
        if (!parcMap.has(cpf)) parcMap.set(cpf, []);
        parcMap.get(cpf)!.push({ num, valor, venc });
      }
    }

    type Cob = { idade: number | null; credor: string | null; tipo: string | null; contrato: string | null; atraso: number | null; risco: number };
    const cobMap = new Map<string, Cob>();
    for (const r of cobranca) {
      const cpf = normalizeCpf(r["CPF/CNPJ"]);
      if (!cpf) continue;
      const credorRaw = String(r["CREDOR"] ?? "").trim();
      const tipo = /APORTE/i.test(credorRaw) ? "APORTE" : (/INADIMP/i.test(credorRaw) ? "INADIMPLENTE" : null);
      const atraso = Number(r["ATRASO"]);
      const risco = Number(r["RISCO"]) || 0;
      const cur = cobMap.get(cpf);
      if (!cur) {
        cobMap.set(cpf, {
          idade: Number(r["IDADE"]) || null,
          credor: credorRaw || null,
          tipo,
          contrato: String(r["CONTRATO"] ?? "") || null,
          atraso: isFinite(atraso) ? atraso : null,
          risco,
        });
      } else {
        cur.risco += risco;
      }
    }

    const allCpfs = new Set<string>([
      ...cobMap.keys(), ...parcMap.keys(), ...phoneMap.keys(), ...nomeMap.keys(), ...quebradosSet,
    ]);

    // Atualizar totais
    await supabase.from("estrategia_importacao").update({
      total_cpfs: allCpfs.size,
      total_localizados: phoneMap.size,
      total_nao_localizados: Math.max(allCpfs.size - phoneMap.size, 0),
      total_acordos_quebrados: quebradosSet.size,
    }).eq("id", importacaoId);

    const chunkSize = 500;
    let buffer: any[] = [];
    let inserted = 0;
    for (const cpf of allCpfs) {
      const cob = cobMap.get(cpf);
      const parcs = (parcMap.get(cpf) ?? []).sort((a, b) => a.num - b.num);
      const tel = phoneMap.get(cpf)?.tel ?? null;
      const localizado = !!tel;
      const valores = parcs.map((p) => p.valor).filter((v) => isFinite(v));
      const proxima = parcs[0] ?? null;
      const faixa = proxima ? faixaValor(proxima.valor) : null;
      const reg: any = {
        importacao_id: importacaoId,
        cpf,
        nome: phoneMap.get(cpf)?.nome ?? nomeMap.get(cpf) ?? null,
        telefone: tel,
        localizado,
        idade: cob?.idade ?? null,
        credor: cob?.credor ?? null,
        tipo_credor: cob?.tipo ?? null,
        contrato: cob?.contrato ?? null,
        atraso_dias: cob?.atraso ?? null,
        risco_total: cob?.risco ?? (valores.reduce((a, b) => a + b, 0)),
        parcelas_abertas_qtd: parcs.length,
        proxima_parcela_num: proxima?.num ?? null,
        proxima_parcela_valor: proxima?.valor ?? null,
        proxima_parcela_vencimento: proxima?.venc ?? null,
        valor_minimo_parcela: valores.length ? Math.min(...valores) : null,
        valor_maximo_parcela: valores.length ? Math.max(...valores) : null,
        acordo_quebrado: quebradosSet.has(cpf),
        faixa_valor_parcela: faixa,
        score: 0,
      };
      reg.score = calcScore(reg);
      buffer.push(reg);
      if (buffer.length >= chunkSize) {
        const { error } = await supabase.from("estrategia_cliente").insert(buffer);
        if (error) throw error;
        inserted += buffer.length;
        buffer = [];
      }
    }
    if (buffer.length) {
      const { error } = await supabase.from("estrategia_cliente").insert(buffer);
      if (error) throw error;
      inserted += buffer.length;
    }

    await supabase.from("estrategia_importacao").update({
      status: "concluido",
    }).eq("id", importacaoId);

    // Limpa o arquivo do storage
    await supabase.storage.from("estrategia-uploads").remove([storagePath]);

    console.log(`Importação ${importacaoId} concluída: ${inserted} CPFs`);
  } catch (e: any) {
    console.error("processarPlanilha erro:", e);
    await supabase.from("estrategia_importacao").update({
      status: "erro",
      erro: String(e?.message ?? e).slice(0, 500),
    }).eq("id", importacaoId);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "no auth" }), { status: 401, headers: corsHeaders });

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: userData } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    const user = userData?.user;
    if (!user) return new Response(JSON.stringify({ error: "unauth" }), { status: 401, headers: corsHeaders });

    const { data: adminCheck } = await supabase.rpc("is_admin_user", { uid: user.id });
    if (!adminCheck) return new Response(JSON.stringify({ error: "not admin" }), { status: 403, headers: corsHeaders });

    const body = await req.json();
    const { storagePath, fileName } = body ?? {};
    if (!storagePath) return new Response(JSON.stringify({ error: "missing storagePath" }), { status: 400, headers: corsHeaders });

    // Desativa importações anteriores e cria nova como processando
    await supabase.from("estrategia_importacao").update({ ativo: false }).eq("ativo", true);
    const { data: imp, error: impErr } = await supabase
      .from("estrategia_importacao")
      .insert({
        nome_arquivo: fileName || "planilha.xlsx",
        total_cpfs: 0,
        total_localizados: 0,
        total_nao_localizados: 0,
        total_acordos_quebrados: 0,
        importado_por: user.id,
        ativo: true,
        status: "processando",
        storage_path: storagePath,
      })
      .select("id")
      .single();
    if (impErr) throw impErr;

    // Processa em background — não bloqueia o response
    // @ts-ignore EdgeRuntime is provided by Supabase runtime
    EdgeRuntime.waitUntil(processarPlanilha(supabase, imp.id, storagePath));

    return new Response(JSON.stringify({
      ok: true,
      importacao_id: imp.id,
      status: "processando",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("estrategia-importar erro:", e);
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

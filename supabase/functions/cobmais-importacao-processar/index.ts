import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const url = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const normalize = (value: unknown) => String(value ?? "").trim();
const digits = (value: unknown) => normalize(value).replace(/\D/g, "");
const dateValue = (value: unknown): string | null => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  const match = normalize(value).match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : null;
};

async function processFile(sb: any, run: any, token: string) {
  try {
    await sb.from("cobmais_importacoes_diarias").update({
      status: "validando", fase: "validando", progresso: 5,
      ultima_atividade_em: new Date().toISOString(), erro_mensagem: null,
    }).eq("id", run.id).eq("processador_token", token);

    const { data: blob, error: downloadError } = await sb.storage
      .from("cobmais-importacoes")
      .download(run.storage_path);
    if (downloadError) throw downloadError;

    const workbook = XLSX.read(new Uint8Array(await blob.arrayBuffer()), {
      type: "array", dense: true, cellDates: true,
      cellFormula: false, cellHTML: false, cellText: false, cellStyles: false,
    });
    const sheet = workbook.Sheets.Parcelas;
    if (!sheet) throw new Error("A aba Parcelas não foi encontrada.");

    const dense = sheet as XLSX.WorkSheet & Record<string, Array<{ v?: unknown }> | undefined>;
    const indexes = Object.keys(dense).filter((key) => /^\d+$/.test(key)).map(Number).sort((a, b) => a - b);
    const header = (dense[String(indexes[0])] ?? []).slice(0, 11).map((cell) => normalize(cell?.v).toUpperCase());
    const expected = ["CPF/CNPJ", "CLIENTE", "CREDOR", "CONTRATO", "INCLUSAO", "ARQUIVO", "NUMERO", "VENCIMENTO", "VALOR", "OBSERVAÇÃO", "STATUS"];
    if (expected.some((value, index) => header[index] !== value)) {
      throw new Error("As colunas da aba Parcelas não correspondem à exportação diária do Cobmais.");
    }

    const unique = new Map<string, Record<string, unknown>>();
    let invalid = 0;
    let repeated = 0;
    let conflicts = 0;
    for (let position = 1; position < indexes.length; position += 1) {
      const cells = dense[String(indexes[position])] ?? [];
      const cpf = digits(cells[0]?.v);
      const nome = normalize(cells[1]?.v);
      const credor = normalize(cells[2]?.v);
      const contrato = normalize(cells[3]?.v);
      const numero = normalize(cells[6]?.v);
      if (!cpf || !nome || !credor || !contrato || !numero) {
        invalid += 1;
        continue;
      }
      const sourceKey = `${cpf}|${credor.toUpperCase()}|${contrato}|${numero}`;
      const row = {
        run_id: run.id, source_key: sourceKey, cpf, nome, credor, contrato,
        numero_parcela: numero, vencimento: dateValue(cells[7]?.v),
        valor: Number(cells[8]?.v ?? 0) || 0,
        observacao: normalize(cells[9]?.v) || null,
        status: normalize(cells[10]?.v).toUpperCase() || null,
      };
      const previous = unique.get(sourceKey);
      if (previous) {
        repeated += 1;
        if (previous.vencimento !== row.vencimento || previous.valor !== row.valor || previous.status !== row.status) conflicts += 1;
      }
      unique.set(sourceKey, row);
      if (position % 10_000 === 0) {
        await sb.from("cobmais_importacoes_diarias").update({
          progresso: 5 + Math.round((position / Math.max(1, indexes.length - 1)) * 30),
          registros_processados: position,
          ultima_atividade_em: new Date().toISOString(),
          processador_lease_ate: new Date(Date.now() + 15 * 60_000).toISOString(),
        }).eq("id", run.id).eq("processador_token", token);
      }
    }

    const rows = [...unique.values()];
    await sb.from("cobmais_importacao_stage").delete().eq("run_id", run.id);
    await sb.from("cobmais_importacoes_diarias").update({
      status: "enviando", fase: "gravando", progresso: 40,
      total_linhas: indexes.length - 1, total_parcelas: rows.length,
      linhas_repetidas: repeated, conflitos, registros_processados: 0,
      ultima_atividade_em: new Date().toISOString(),
    }).eq("id", run.id).eq("processador_token", token);

    const batchSize = 3000;
    for (let index = 0; index < rows.length; index += batchSize) {
      const batch = rows.slice(index, index + batchSize);
      const { error } = await sb.from("cobmais_importacao_stage").insert(batch);
      if (error) throw error;
      const done = Math.min(index + batch.length, rows.length);
      const progress = 40 + Math.round((done / rows.length) * 60);
      await sb.from("cobmais_importacoes_diarias").update({
        registros_processados: done, progresso: progress,
        ultima_atividade_em: new Date().toISOString(),
        processador_lease_ate: new Date(Date.now() + 15 * 60_000).toISOString(),
      }).eq("id", run.id).eq("processador_token", token);
    }

    await sb.from("cobmais_importacoes_diarias").update({
      status: "enviando", fase: "pronta", progresso: 100,
      registros_processados: rows.length, ultima_atividade_em: new Date().toISOString(),
      processador_token: null, processador_lease_ate: null,
    }).eq("id", run.id).eq("processador_token", token);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await sb.from("cobmais_importacoes_diarias").update({
      status: "erro", fase: "erro", erro_mensagem: message.slice(0, 500),
      concluido_em: new Date().toISOString(), ultima_atividade_em: new Date().toISOString(),
      processador_token: null, processador_lease_ate: null,
    }).eq("id", run.id).eq("processador_token", token);
    console.error("cobmais-importacao-processar", run.id, message);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ message: "Sessão ausente." }), { status: 401, headers: corsHeaders });
    const sb = createClient(url, serviceKey);
    const { data: auth } = await sb.auth.getUser(authHeader.replace("Bearer ", ""));
    const user = auth?.user;
    if (!user) return new Response(JSON.stringify({ message: "Sessão inválida." }), { status: 401, headers: corsHeaders });
    const { data: isAdmin } = await sb.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) return new Response(JSON.stringify({ message: "Apenas administradores podem importar." }), { status: 403, headers: corsHeaders });

    const { runId, action = "process" } = await req.json();
    const { data: run } = await sb.from("cobmais_importacoes_diarias").select("*")
      .eq("id", runId).eq("importado_por", user.id).maybeSingle();
    if (!run) return new Response(JSON.stringify({ message: "Importação não encontrada." }), { status: 404, headers: corsHeaders });

    if (action === "publish") {
      if (run.fase !== "pronta") return new Response(JSON.stringify({ message: "A validação ainda não foi concluída." }), { status: 409, headers: corsHeaders });
      await sb.from("cobmais_importacoes_diarias").update({
        status: "publicando", fase: "publicando", progresso: 100,
        ultima_atividade_em: new Date().toISOString(),
      }).eq("id", run.id);
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
      const publishTask = (async () => {
        const { error } = await userClient.rpc("publicar_importacao_cobmais_diaria", { p_run_id: run.id });
        if (error) throw error;
        if (run.storage_path) await sb.storage.from("cobmais-importacoes").remove([run.storage_path]);
      })().catch(async (error) => {
        await sb.from("cobmais_importacoes_diarias").update({
          status: "erro", fase: "erro", erro_mensagem: String(error?.message ?? error).slice(0, 500),
          concluido_em: new Date().toISOString(), ultima_atividade_em: new Date().toISOString(),
        }).eq("id", run.id);
      });
      EdgeRuntime.waitUntil(publishTask);
      return new Response(JSON.stringify({ ok: true, status: "publicando" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!run.storage_path) return new Response(JSON.stringify({ message: "Arquivo temporário não encontrado." }), { status: 404, headers: corsHeaders });
    if (run.fase === "pronta" || run.status === "concluido") {
      return new Response(JSON.stringify({ ok: true, status: run.status, fase: run.fase }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const atividadeEm = run.ultima_atividade_em ? new Date(run.ultima_atividade_em).getTime() : 0;
    const atividadeRecente = atividadeEm > Date.now() - 2 * 60_000;
    if (atividadeRecente && run.processador_lease_ate && new Date(run.processador_lease_ate).getTime() > Date.now()) {
      return new Response(JSON.stringify({ ok: true, status: "processando" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const token = crypto.randomUUID();
    const { data: claimed } = await sb.from("cobmais_importacoes_diarias").update({
      processador_token: token, processador_lease_ate: new Date(Date.now() + 15 * 60_000).toISOString(),
      tentativas: Number(run.tentativas ?? 0) + 1, ultima_atividade_em: new Date().toISOString(),
    }).eq("id", run.id).select("id").maybeSingle();
    if (!claimed) throw new Error("Não foi possível reservar esta importação.");

    EdgeRuntime.waitUntil(processFile(sb, run, token));
    return new Response(JSON.stringify({ ok: true, status: "processando" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
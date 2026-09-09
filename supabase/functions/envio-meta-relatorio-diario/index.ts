// Relatório diário das campanhas: respostas, taxa de retorno e acordos fechados.
// Enviado às 19h30 BRT (seg-sáb) apenas para o administrador.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.88.0";
import { notificarNumeros } from "../_shared/notificar-numeros.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DESTINATARIOS = ["62991672674"];
const pct = (n: number) => `${Number(n || 0).toFixed(1).replace(".", ",")}%`;
const brl = (n: number) =>
  Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json().catch(() => ({}));
    const forcar = Boolean(body?.forcar);

    const nowBrt = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    if (nowBrt.getDay() === 0 && !forcar) {
      return json({ ok: true, skipped: "domingo" });
    }
    const hoje = nowBrt.toISOString().slice(0, 10);
    const inicioDia = new Date(`${hoje}T00:00:00-03:00`).toISOString();

    // Dono do relatório: o admin. Campanhas de outros usuários (parceiros Meta) ficam fora.
    const { data: admins } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    const donoIds = (admins || []).map((a: any) => a.user_id);
    if (donoIds.length === 0) return json({ ok: true, skipped: "sem_admin" });

    // Campanhas iniciadas hoje pelo admin
    const { data: jobs } = await supabase
      .from("envio_meta_job")
      .select("id, nome_campanha, template_nome, total, enviados, erros, status, iniciado_em, created_at, user_id")
      .gte("created_at", inicioDia)
      .in("user_id", donoIds)
      .order("created_at", { ascending: true });

    if (!jobs || jobs.length === 0) {
      return json({ ok: true, skipped: "sem_campanhas_hoje" });
    }

    // Recalcula cada campanha do dia
    for (const j of jobs as any[]) {
      await supabase.rpc("envio_meta_job_resultado_calcular", { _job_id: j.id });
    }

    const { data: resultados } = await supabase
      .from("envio_meta_job_resultado")
      .select("*")
      .in("job_id", (jobs as any[]).map((j) => j.id));
    const resMap = new Map<string, any>();
    (resultados || []).forEach((r: any) => resMap.set(r.job_id, r));

    // Média dos últimos 7 dias (excluindo hoje) — só campanhas do admin
    const inicio7d = new Date(new Date(inicioDia).getTime() - 7 * 86400000).toISOString();
    const { data: jobs7d } = await supabase
      .from("envio_meta_job")
      .select("id")
      .gte("created_at", inicio7d)
      .lt("created_at", inicioDia)
      .in("user_id", donoIds);
    let media7d = 0;
    if (jobs7d && jobs7d.length > 0) {
      const { data: res7d } = await supabase
        .from("envio_meta_job_resultado")
        .select("enviados, contatos_responderam")
        .in("job_id", (jobs7d as any[]).map((j) => j.id));
      const env = (res7d || []).reduce((s: number, r: any) => s + Number(r.enviados || 0), 0);
      const resp = (res7d || []).reduce((s: number, r: any) => s + Number(r.contatos_responderam || 0), 0);
      if (env > 0) media7d = (resp / env) * 100;
    }


    const linhas: string[] = [];
    linhas.push("📈 *Resultado das campanhas de hoje*");
    linhas.push(`_${nowBrt.toLocaleDateString("pt-BR")}_`);
    linhas.push("");

    let totEnv = 0, totResp = 0, totConv = 0, totAcordos = 0, totValor = 0;
    const ranking: Array<{ nome: string; taxa: number }> = [];

    for (const j of jobs as any[]) {
      const r = resMap.get(j.id);
      const nome = j.nome_campanha || j.template_nome || "Campanha";
      const enviados = Number(r?.enviados ?? j.enviados ?? 0);
      const conv = Number(r?.conversas_abertas ?? 0);
      const resp = Number(r?.respostas ?? 0);
      const taxa = Number(r?.taxa_resposta ?? 0);
      const acordos = Number(r?.acordos_fechados ?? 0);
      const valor = Number(r?.acordos_valor ?? 0);

      totEnv += enviados; totResp += resp; totConv += conv;
      totAcordos += acordos; totValor += valor;
      if (enviados >= 20) ranking.push({ nome, taxa });

      const icon = taxa >= 15 ? "🟢" : taxa >= 8 ? "🟡" : "🔴";
      linhas.push(`${icon} *${nome}*`);
      linhas.push(`   Enviadas ${enviados} • conversas ${conv} • respostas ${resp}`);
      linhas.push(`   Taxa de resposta: *${pct(taxa)}*`);
      linhas.push(`   Acordos: ${acordos} (${pct(Number(r?.taxa_acordo ?? 0))}) • ${brl(valor)}`);
      if (taxa < 8 && enviados >= 20) {
        linhas.push("   ⚠️ abaixo de 8% — vale revisar template/base");
      }
      linhas.push("");
    }

    const taxaGeral = totEnv > 0 ? (totConv / totEnv) * 100 : 0;
    linhas.push("*Consolidado do dia*");
    linhas.push(`Enviadas ${totEnv} • conversas abertas ${totConv} • respostas ${totResp}`);
    linhas.push(`Taxa de resposta: *${pct(taxaGeral)}*`);
    linhas.push(`Acordos fechados: ${totAcordos} • ${brl(totValor)}`);
    if (media7d > 0) {
      const dif = taxaGeral - media7d;
      const seta = dif >= 0.5 ? "⬆️ acima" : dif <= -0.5 ? "⬇️ abaixo" : "➡️ igual";
      linhas.push(`Média 7 dias: ${pct(media7d)} — hoje ${seta} da média`);
    }

    if (ranking.length > 1) {
      ranking.sort((a, b) => b.taxa - a.taxa);
      linhas.push("");
      linhas.push(`🥇 Melhor: ${ranking[0].nome} (${pct(ranking[0].taxa)})`);
      const pior = ranking[ranking.length - 1];
      linhas.push(`🥉 Pior: ${pior.nome} (${pct(pior.taxa)})`);
    }

    const result = await notificarNumeros(supabase, {
      tipo: "campanhas_resultado_diario",
      mensagem: linhas.join("\n"),
      destinatarios: DESTINATARIOS,
      chaveIdempotencia: forcar ? undefined : `campanhas-diario-${hoje}`,
    });

    return json({ ok: true, campanhas: jobs.length, totEnv, totConv, totAcordos, ...result });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

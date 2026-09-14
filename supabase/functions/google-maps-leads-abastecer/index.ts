// Reabastece a lista de contatos do Google Maps usada no resgate de engajamento.
// Roda de carona no tick do aquecimento (sem cron novo):
//  - só entra em ação quando o estoque de contatos com WhatsApp confirmado está baixo
//  - escolhe os nichos/cidades com melhor histórico de resposta (aquecimento_nicho_score)
//  - busca no Google Maps, confirma quem tem WhatsApp e guarda sem duplicar telefone
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { hojeBrt } from "../_shared/meta-aquecimento-alvo.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ESTOQUE_MINIMO = 600;
const MAX_REQUISICOES_POR_DIA = 60;
const MAX_REQUISICOES_POR_RUN = 12;
const MAX_RESULTADOS = 60;

const SEMENTES = [
  { nicho: "clínica odontológica", cidade: "Goiânia GO" },
  { nicho: "psicólogo", cidade: "Goiânia GO" },
  { nicho: "clínica veterinária", cidade: "Goiânia GO" },
  { nicho: "contabilidade", cidade: "Goiânia GO" },
  { nicho: "imobiliária", cidade: "Goiânia GO" },
  { nicho: "academia", cidade: "Goiânia GO" },
];

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json().catch(() => ({}));
    const dia = String(body?.dia || hojeBrt());
    const forcar = body?.forcar === true;

    // Single-flight persistente: ticks simultâneos não abrem buscas duplicadas.
    const token = crypto.randomUUID();
    const { data: lockOk, error: lockError } = await supabase.rpc("gm_abastecimento_claim", {
      p_token: token,
      p_lock_minutes: 9,
    });
    if (lockError) throw lockError;
    if (!lockOk) return json({ ok: true, skipped: "abastecimento_em_andamento" });

    try {

    // ===== Estoque atual =====
    const carencia = new Date(Date.now() - 15 * 86400000).toISOString();
    const { count: estoque } = await supabase
      .from("google_maps_leads")
      .select("id", { count: "exact", head: true })
      .eq("tem_whatsapp", true)
      .or(`usado_aquecimento_em.is.null,usado_aquecimento_em.lt.${carencia}`);

    if (!forcar && (estoque ?? 0) >= ESTOQUE_MINIMO) {
      return json({ ok: true, skipped: "estoque_suficiente", estoque: estoque ?? 0 });
    }

    // ===== Orçamento diário de requisições Places =====
    const inicioDia = new Date(`${dia}T00:00:00-03:00`).toISOString();
    const { data: buscasHoje } = await supabase
      .from("google_maps_buscas")
      .select("requisicoes_places")
      .eq("origem", "resgate_engajamento")
      .gte("created_at", inicioDia);
    const requisicoesHoje = ((buscasHoje as any[]) || [])
      .reduce((s, b) => s + Number(b.requisicoes_places || 0), 0);
    const restantesHoje = Math.max(0, MAX_REQUISICOES_POR_DIA - requisicoesHoje);
    if (!forcar && restantesHoje <= 0) {
      return json({ ok: true, skipped: "limite_diario_de_requisicoes", requisicoes_hoje: requisicoesHoje });
    }

    // ===== Melhor nicho/cidade conhecido =====
    const { data: scores } = await supabase
      .from("aquecimento_nicho_score")
      .select("nicho, cidade, score, envios, bloqueado")
      .eq("bloqueado", false)
      .order("score", { ascending: false })
      .limit(10);

    const bons = ((scores as any[]) || [])
      .filter((s) => Number(s.envios || 0) >= 3)
      .map((s) => ({ nicho: String(s.nicho), cidade: String(s.cidade || "Goiânia GO") }));
    const alvos = [...bons, ...SEMENTES].filter(
      (item, idx, arr) => arr.findIndex((x) => x.nicho === item.nicho && x.cidade === item.cidade) === idx,
    );
    const alvo = alvos[requisicoesHoje % Math.max(1, alvos.length)] || SEMENTES[0];
    const limiteRun = Math.min(MAX_REQUISICOES_POR_RUN, restantesHoje || MAX_REQUISICOES_POR_RUN);

    // ===== Busca no Google Maps =====
    const { data: busca, error: erroBusca } = await supabase.functions.invoke(
      "google-maps-buscar-leads",
      {
        body: {
          categoria: alvo.nicho,
          localizacao: alvo.cidade,
          max_resultados: MAX_RESULTADOS,
          somente_novos: true,
          origem: "resgate_engajamento",
           max_requisicoes: limiteRun,
        },
      },
    );
    if (erroBusca) {
      return json({ ok: false, alvo, error: String(erroBusca.message || erroBusca) }, 200);
    }

    // Verifica quem tem WhatsApp nos números recém-captados (usa as instâncias UAZAPI conectadas)
    const buscaId = (busca as any)?.busca_id || null;
    let verificacao: unknown = null;
    if (buscaId) {
      const { data: vData, error: vErr } = await supabase.functions.invoke(
        "google-maps-verificar-whatsapp",
        { body: { busca_id: buscaId } },
      );
      verificacao = vErr ? { erro: String(vErr.message || vErr) } : vData;
    }

    // Aproveita a mesma execução para limpar o estoque antigo ainda pendente.
    const { data: pendentesData, error: pendentesErr } = await supabase.functions.invoke(
      "google-maps-verificar-whatsapp",
      { body: { limite: 300 } },
    );




    const { count: estoqueFinal } = await supabase
      .from("google_maps_leads")
      .select("id", { count: "exact", head: true })
      .eq("tem_whatsapp", true)
      .or(`usado_aquecimento_em.is.null,usado_aquecimento_em.lt.${carencia}`);

    return json({
      ok: true,
      alvo,
      estoque_antes: estoque ?? 0,
      estoque_depois: estoqueFinal ?? 0,
      busca_id: buscaId,
      nicho_usado: alvo.nicho,
      verificacao_whatsapp: verificacao,
      verificacao_pendentes: pendentesErr ? { erro: String(pendentesErr.message || pendentesErr) } : pendentesData,
      requisicoes_antes: requisicoesHoje,
      limite_requisicoes_run: limiteRun,
      limite_requisicoes_dia: MAX_REQUISICOES_POR_DIA,
    });
    } finally {
      await supabase.rpc("gm_abastecimento_release", { p_token: token });
    }
  } catch (e) {
    console.error("[google-maps-leads-abastecer]", e);
    return json({ ok: false, error: e instanceof Error ? e.message : "erro" }, 500);
  }
});

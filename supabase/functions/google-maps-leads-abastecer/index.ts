// Reabastece a lista de contatos do Google Maps usada no resgate de engajamento.
// Roda de carona no tick do aquecimento (sem cron novo):
//  - persegue 500 contatos inéditos com WhatsApp confirmado em cada dia
//  - escolhe os nichos/cidades com melhor histórico de resposta (aquecimento_nicho_score)
//  - busca no Google Maps, confirma quem tem WhatsApp e guarda sem duplicar telefone
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { hojeBrt } from "../_shared/meta-aquecimento-alvo.ts";
import { notificarNumeros } from "../_shared/notificar-numeros.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const META_WHATSAPP_DIA = 500;
const MAX_REQUISICOES_POR_DIA = 300;
const MAX_REQUISICOES_POR_RUN = 18;
// Até 120 empresas por rodada: os seis ticks entre 07h e 07h50 conseguem
// formar o estoque antes do aquecimento, respeitando o teto diário de consultas.
const MAX_RESULTADOS = 120;
const DESTINATARIOS_AVISO = ["62991672674"];

const SEMENTES = [
  { nicho: "clínica odontológica", cidade: "Goiânia GO" },
  { nicho: "psicólogo", cidade: "Goiânia GO" },
  { nicho: "clínica veterinária", cidade: "Goiânia GO" },
  { nicho: "contabilidade", cidade: "Goiânia GO" },
  { nicho: "imobiliária", cidade: "Goiânia GO" },
  { nicho: "academia", cidade: "Goiânia GO" },
  { nicho: "clínica odontológica", cidade: "Aparecida de Goiânia GO" },
  { nicho: "contabilidade", cidade: "Anápolis GO" },
  { nicho: "imobiliária", cidade: "Brasília DF" },
  { nicho: "clínica de estética", cidade: "Goiânia GO" },
  { nicho: "fisioterapia", cidade: "Goiânia GO" },
  { nicho: "advocacia", cidade: "Goiânia GO" },
  { nicho: "pet shop", cidade: "Goiânia GO" },
  { nicho: "restaurante", cidade: "Goiânia GO" },
  { nicho: "oficina mecânica", cidade: "Goiânia GO" },
  { nicho: "materiais de construção", cidade: "Aparecida de Goiânia GO" },
  { nicho: "auto elétrica", cidade: "Anápolis GO" },
  { nicho: "marmoraria", cidade: "Brasília DF" },
  { nicho: "clínica odontológica", cidade: "Rio Verde GO" },
  { nicho: "contabilidade", cidade: "Catalão GO" },
  { nicho: "imobiliária", cidade: "Uberlândia MG" },
  { nicho: "academia", cidade: "Campo Grande MS" },
  { nicho: "clínica veterinária", cidade: "Cuiabá MT" },
  { nicho: "ótica", cidade: "Palmas TO" },
  { nicho: "pizzaria", cidade: "Belo Horizonte MG" },
  { nicho: "dedetizadora", cidade: "Brasília DF" },
  { nicho: "escola de idiomas", cidade: "Goiânia GO" },
];

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function haInstanciaVerificadora(supabase: any) {
  const { data: instancias } = await supabase
    .from("user_whatsapp_instances")
    .select("server_url, instance_token")
    .eq("ativo", true)
    .not("server_url", "is", null)
    .not("instance_token", "is", null);

  for (const inst of instancias ?? []) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(`${String(inst.server_url).replace(/\/+$/, "")}/instance/status`, {
        headers: { token: String(inst.instance_token) },
        signal: controller.signal,
      });
      if (!response.ok) continue;
      const data = await response.json().catch(() => ({}));
      const estado = String(data?.instance?.status ?? data?.status?.status ?? data?.status ?? "").toLowerCase();
      if (data?.connected === true || data?.status?.connected === true || ["connected", "open", "online", "ready"].includes(estado)) {
        return true;
      }
    } catch (_) {
      // Tenta a próxima instância.
    } finally {
      clearTimeout(timeout);
    }
  }
  return false;
}

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

    // ===== Progresso diário: só contam contatos inéditos captados hoje e confirmados =====
    const carencia = new Date(Date.now() - 15 * 86400000).toISOString();
    const inicioDia = new Date(`${dia}T00:00:00-03:00`).toISOString();
    const fimDia = new Date(`${dia}T23:59:59-03:00`).toISOString();
    const { count: confirmadosHoje } = await supabase
      .from("google_maps_leads")
      .select("id", { count: "exact", head: true })
      .eq("tem_whatsapp", true)
      .gte("created_at", inicioDia)
      .lte("created_at", fimDia);
    const { count: estoque } = await supabase
      .from("google_maps_leads")
      .select("id", { count: "exact", head: true })
      .eq("tem_whatsapp", true)
      .or(`usado_aquecimento_em.is.null,usado_aquecimento_em.lt.${carencia}`);

    if (!forcar && (confirmadosHoje ?? 0) >= META_WHATSAPP_DIA) {
      return json({ ok: true, skipped: "meta_diaria_atingida", confirmados_hoje: confirmadosHoje ?? 0, meta: META_WHATSAPP_DIA });
    }

    // Não gasta consultas se não houver como transformar telefones em contatos confirmados.
    if (!(await haInstanciaVerificadora(supabase))) {
      return json({ ok: true, skipped: "sem_instancia_verificadora", confirmados_hoje: confirmadosHoje ?? 0, meta: META_WHATSAPP_DIA });
    }

    // ===== Orçamento diário de requisições Places =====
    const { data: buscasHoje } = await supabase
      .from("google_maps_buscas")
      .select("requisicoes_places, provedor_utilizado")
      .eq("origem", "resgate_engajamento")
      .gte("created_at", inicioDia);
    const requisicoesHoje = ((buscasHoje as any[]) || [])
      .reduce((s, b) => s + Number(b.requisicoes_places || 0), 0);
    const restantesHoje = Math.max(0, MAX_REQUISICOES_POR_DIA - requisicoesHoje);
    if (restantesHoje <= 0) {
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
    // O cursor por quantidade de buscas evita insistir no mesmo alvo quando uma busca usa várias páginas.
    const { count: buscasExecutadas } = await supabase
      .from("google_maps_buscas")
      .select("id", { count: "exact", head: true })
      .eq("origem", "resgate_engajamento")
      .gte("created_at", inicioDia);
    const alvo = alvos[(buscasExecutadas ?? 0) % Math.max(1, alvos.length)] || SEMENTES[0];

    // Ajusta o lote pelo rendimento real do dia, sem ultrapassar o teto por execução.
    const rendimento = requisicoesHoje > 0 ? (confirmadosHoje ?? 0) / requisicoesHoje : 2.4;
    const faltam = Math.max(0, META_WHATSAPP_DIA - (confirmadosHoje ?? 0));
    const estimadasRestantes = Math.ceil(faltam / Math.max(0.5, rendimento));
    const limiteRun = Math.min(MAX_REQUISICOES_POR_RUN, restantesHoje, Math.max(6, estimadasRestantes));

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
      { body: { limite: 600 } },
    );




    const { count: estoqueFinal } = await supabase
      .from("google_maps_leads")
      .select("id", { count: "exact", head: true })
      .eq("tem_whatsapp", true)
      .or(`usado_aquecimento_em.is.null,usado_aquecimento_em.lt.${carencia}`);

    const { count: confirmadosDepois } = await supabase
      .from("google_maps_leads")
      .select("id", { count: "exact", head: true })
      .eq("tem_whatsapp", true)
      .gte("created_at", inicioDia)
      .lte("created_at", fimDia);

    const consultasDepois = requisicoesHoje + Number((busca as any)?.requisicoes_places ?? 0);
    const provedorAtual = String((busca as any)?.provedor_utilizado ?? "");
    const trocouConta = !!provedorAtual && !((buscasHoje as any[]) || []).some((b) => b?.provedor_utilizado === provedorAtual);
    const marco = trocouConta
      ? `conta-${provedorAtual}`
      : (confirmadosDepois ?? 0) >= META_WHATSAPP_DIA
      ? "500"
      : (confirmadosDepois ?? 0) >= 400
      ? "400"
      : consultasDepois >= Math.ceil(MAX_REQUISICOES_POR_DIA * 0.8)
      ? "80pct"
      : null;
    if (marco) {
      const titulo = marco.startsWith("conta-") ? "Conta Google Maps selecionada" : marco === "500" ? "Meta diária alcançada" : marco === "400" ? "Captação chegou a 400" : "80% do teto diário consumido";
      await notificarNumeros(supabase, {
        tipo: "google_maps_captacao_marco",
        destinatarios: DESTINATARIOS_AVISO,
        chaveIdempotencia: `gm-captacao-${dia}-${marco}`,
        mensagem: `🗺️ *${titulo}*\n• ${(confirmadosDepois ?? 0)}/${META_WHATSAPP_DIA} contatos com WhatsApp confirmados hoje\n• ${consultasDepois}/${MAX_REQUISICOES_POR_DIA} consultas utilizadas\n• Estoque disponível: ${estoqueFinal ?? 0}`,
      });
    }

    return json({
      ok: true,
      alvo,
      estoque_antes: estoque ?? 0,
      estoque_depois: estoqueFinal ?? 0,
      confirmados_antes: confirmadosHoje ?? 0,
      confirmados_depois: confirmadosDepois ?? 0,
      meta_confirmados_dia: META_WHATSAPP_DIA,
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

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const ORIGEM = "auto_resposta_goias";
const MAX_REQUISICOES_RUN = 18;
const CIDADES_GO = [
  "Goiânia GO", "Aparecida de Goiânia GO", "Anápolis GO", "Rio Verde GO",
  "Catalão GO", "Luziânia GO", "Águas Lindas de Goiás GO", "Valparaíso de Goiás GO",
  "Trindade GO", "Formosa GO", "Itumbiara GO", "Jataí GO", "Senador Canedo GO",
  "Caldas Novas GO", "Planaltina GO", "Goianésia GO", "Mineiros GO", "Cristalina GO",
];
const SEMENTES = [
  "clínica veterinária", "pet shop", "contabilidade", "salão de beleza",
  "clínica odontológica", "serviços", "oficina mecânica", "academia",
  "barbearia", "policlínica", "imobiliária", "clínica de estética",
];

const json = (payload: unknown, status = 200) => new Response(JSON.stringify(payload), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});
const digits = (value: unknown) => String(value ?? "").replace(/\D/g, "");
const inicioDiaBrt = () => {
  const dia = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
  return { dia, inicio: new Date(`${dia}T00:00:00-03:00`).toISOString() };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json({ ok: false, error: "Configuração interna ausente" }, 500);
  const supabase = createClient(url, serviceKey);
  const token = crypto.randomUUID();
  let statusFinal = "concluido";
  let erroFinal: string | null = null;

  try {
    const body = await req.json().catch(() => ({}));
    const forcar = body?.forcar === true;
    if (forcar) {
      const auth = req.headers.get("Authorization") ?? "";
      const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
        global: { headers: { Authorization: auth } },
      });
      const { data: userData } = await userClient.auth.getUser();
      if (!userData.user) return json({ ok: false, error: "Não autenticado" }, 401);
      const { data: admin } = await supabase.rpc("has_role", { _user_id: userData.user.id, _role: "admin" });
      if (!admin) return json({ ok: false, error: "Apenas administradores podem iniciar a captação" }, 403);
    }

    const { data: cfg, error: cfgError } = await supabase
      .from("google_maps_auto_resposta_config").select("*").eq("id", true).single();
    if (cfgError) throw cfgError;
    if (!cfg.ativo && !forcar) return json({ ok: true, skipped: "captacao_desativada" });

    const agoraBrt = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    if (!forcar && (agoraBrt.getDay() === 0 || agoraBrt.getHours() < 7 || agoraBrt.getHours() >= 19)) {
      return json({ ok: true, skipped: "fora_da_janela" });
    }

    const { data: lockOk, error: lockError } = await supabase.rpc("gm_auto_resposta_claim", {
      p_token: token, p_lock_minutes: 9,
    });
    if (lockError) throw lockError;
    if (!lockOk) return json({ ok: true, skipped: "captacao_em_andamento" });

    const { dia, inicio } = inicioDiaBrt();
    const { count: confirmadosHoje } = await supabase
      .from("google_maps_auto_resposta_candidatos")
      .select("id", { count: "exact", head: true }).gte("captado_em", inicio);
    if ((confirmadosHoje ?? 0) >= cfg.meta_whatsapps_dia) {
      statusFinal = "meta_diaria_atingida";
      return json({ ok: true, skipped: statusFinal, dia, captados_hoje: confirmadosHoje, meta: cfg.meta_whatsapps_dia });
    }

    const { data: buscasHoje } = await supabase.from("google_maps_buscas")
      .select("requisicoes_places,categoria,localizacao,total_resultados")
      .eq("origem", ORIGEM).gte("created_at", inicio).limit(1000);
    const requisicoesHoje = (buscasHoje ?? []).reduce((sum, item) => sum + Number(item.requisicoes_places || 0), 0);
    const restantes = Math.max(0, cfg.max_requisicoes_dia - requisicoesHoje);
    if (restantes <= 0) {
      statusFinal = "limite_diario_atingido";
      return json({ ok: true, skipped: statusFinal, requisicoes_hoje: requisicoesHoje });
    }

    const { data: rankingData, error: rankingError } = await supabase.rpc("gm_auto_resposta_ranking");
    if (rankingError) throw rankingError;
    const ranking = (rankingData ?? []) as Array<{ nicho: string; cidade: string; amostra: number; confirmados: number; taxa: number; score: number }>;
    const comprovados = ranking.filter((item) => Number(item.amostra) >= 50 && Number(item.taxa) >= 0.15);
    const intermediarios = ranking.filter((item) => Number(item.amostra) >= 20 && Number(item.taxa) >= 0.08);
    const nichosConhecidos = new Set(ranking.map((item) => item.nicho));
    const exploracao = SEMENTES.filter((nicho) => !nichosConhecidos.has(nicho));

    const rodada = (buscasHoje ?? []).length;
    const faixa = rodada % 10;
    const grupo = faixa < 7 ? "comprovado" : faixa < 9 ? "intermediario" : "exploracao";
    const pool = grupo === "comprovado" ? comprovados : grupo === "intermediario" ? intermediarios : [];
    const escolhido = pool.length ? pool[rodada % pool.length] : null;
    const nichosExploracao = exploracao.length ? exploracao : SEMENTES;
    const nicho = escolhido?.nicho ?? nichosExploracao[rodada % nichosExploracao.length] ?? SEMENTES[0];
    const cidadeHistorica = String(escolhido?.cidade || "");
    const cidade = /\bGO\b/i.test(cidadeHistorica)
      ? cidadeHistorica
      : CIDADES_GO[Math.floor(rodada / Math.max(1, nichosExploracao.length)) % CIDADES_GO.length];

    const faltam = Math.max(1, cfg.meta_whatsapps_dia - (confirmadosHoje ?? 0));
    const maxResultados = Math.min(120, Math.max(30, faltam * 2));
    const { data: busca, error: buscaError } = await supabase.functions.invoke("google-maps-buscar-leads", {
      body: {
        categoria: nicho, localizacao: cidade, max_resultados: maxResultados,
        max_requisicoes: Math.min(MAX_REQUISICOES_RUN, restantes), max_variacoes: 3,
        somente_novos: true, origem: ORIGEM,
      },
    });
    if (buscaError || !busca?.busca_id) throw new Error(buscaError?.message || busca?.message || "Falha na busca Google Maps");

    const { data: verificacao, error: verificacaoError } = await supabase.functions.invoke("google-maps-verificar-whatsapp", {
      body: { busca_id: busca.busca_id },
    });
    if (verificacaoError) throw new Error(verificacaoError.message);

    const { data: leads, error: leadsError } = await supabase.from("google_maps_leads")
      .select("id,nome,telefone,telefone_internacional,categoria,site,avaliacao,total_avaliacoes")
      .eq("busca_id", busca.busca_id).eq("tem_whatsapp", true);
    if (leadsError) throw leadsError;

    const linhas = (leads ?? []).flatMap((lead) => {
      const telefone = String(lead.telefone_internacional || lead.telefone || "");
      const normalizado = digits(telefone);
      if (normalizado.length < 10) return [];
      const nota = Number(lead.avaliacao || 0);
      const avaliacoes = Number(lead.total_avaliacoes || 0);
      const base = grupo === "comprovado" ? 70 : grupo === "intermediario" ? 50 : 30;
      const pontosSite = lead.site ? 5 : 0;
      const pontosNota = nota >= 4.5 ? 8 : nota >= 4 ? 4 : 0;
      const pontosAvaliacoes = avaliacoes >= 100 ? 10 : avaliacoes >= 20 ? 6 : avaliacoes >= 5 ? 2 : 0;
      return [{
        lead_id: lead.id, telefone_normalizado: normalizado, telefone,
        nome: lead.nome, nicho, cidade, avaliacao: lead.avaliacao,
        total_avaliacoes: lead.total_avaliacoes, site: lead.site,
        pontuacao: base + pontosSite + pontosNota + pontosAvaliacoes,
        motivo_pontuacao: `${grupo} · histórico do nicho + sinais do perfil`, status: "novo",
      }];
    });
    let adicionados = 0;
    if (linhas.length) {
      const { data: totalInserido, error: insertError } = await supabase.rpc("gm_registrar_candidatos_auto_resposta", { p_itens: linhas });
      if (insertError) throw insertError;
      adicionados = Number(totalInserido || 0);
    }

    statusFinal = adicionados > 0 ? "lote_concluido" : "lote_sem_novos_whatsapps";
    return json({
      ok: true, dia, grupo, alvo: { nicho, cidade }, busca_id: busca.busca_id,
      captados_antes: confirmadosHoje ?? 0, adicionados, meta: cfg.meta_whatsapps_dia,
      requisicoes_antes: requisicoesHoje, requisicoes_lote: busca.requisicoes_places ?? 0,
      verificacao,
    });
  } catch (error) {
    erroFinal = error instanceof Error ? error.message : "Falha na captação";
    statusFinal = "erro";
    console.error("[google-maps-auto-resposta-captar]", erroFinal);
    return json({ ok: false, error: erroFinal }, 500);
  } finally {
    await supabase.rpc("gm_auto_resposta_release", { p_token: token, p_status: statusFinal, p_erro: erroFinal });
  }
});
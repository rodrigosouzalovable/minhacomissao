import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { coletarJanela, dataBRT } from "../_shared/certificado-ingest.ts";
import { verificarLeadsCertificado } from "../_shared/certificado-whatsapp.ts";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});
const TEMPLATE_TESTE = "cnpj_atualizado_2";

const diaBrt = () => new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date());

function janelaExperimentoHoje(): number | null {
  const hoje = diaBrt();
  const inicio = "2026-09-23";
  if (hoje < inicio) return null;
  const cursor = new Date(`${inicio}T12:00:00Z`);
  const fim = new Date(`${hoje}T12:00:00Z`);
  let diasUteis = 0;
  while (cursor < fim) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (![0, 6].includes(cursor.getUTCDay())) diasUteis++;
  }
  return [5, 10, 15, 20, 25, 30][diasUteis] ?? null;
}

async function usuarioAdmin(req: Request, service: any) {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (token === serviceKey) return { id: null, interno: true };
  const { data } = await service.auth.getUser(token);
  if (!data.user?.id) return null;
  const { data: admin } = await service.rpc("has_role", { _user_id: data.user.id, _role: "admin" });
  return admin === true ? { id: data.user.id, interno: false } : null;
}

async function atualizar(service: any, id: string, patch: Record<string, unknown>) {
  const { error } = await service.from("certificado_prospeccao_preparacoes")
    .update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

async function processarLote(service: any, preparacao: any, profundidade: number) {
  const agora = new Date();
  if (preparacao.status === "pausada" || preparacao.status === "falhou" || preparacao.status === "campanha_criada") return;
  if (preparacao.lease_ate && new Date(preparacao.lease_ate) > agora && preparacao.status === "processando") return;

  await atualizar(service, preparacao.id, {
    status: "processando",
    lease_ate: new Date(Date.now() + 90_000).toISOString(),
    erro: null,
  });

  const contar = async (status?: string[]) => {
    let query = service.from("certificado_leads").select("id", { count: "exact", head: true })
      .eq("preparacao_id", preparacao.id).eq("situacao", "novo").not("telefone_principal", "is", null);
    if (status) query = query.in("whatsapp_status", status);
    const { count, error } = await query;
    if (error) throw error;
    return Number(count ?? 0);
  };

  let confirmados = await contar(["com_whatsapp"]);
  let verificadosAcumulados = Number(preparacao.numeros_verificados ?? 0);
  let pagina = Math.max(1, Number(preparacao.pagina_atual ?? 1));
  let consultados = Number(preparacao.cnpjs_consultados ?? 0);
  let novos = Number(preparacao.leads_novos ?? 0);

  for (let lote = 0; lote < 5 && confirmados < preparacao.quantidade_alvo; lote++) {
    const pendentes = await contar(["pendente", "nao_verificado", "erro_temporario"]);
    if (pendentes > 0) {
      const verificacao = await verificarLeadsCertificado(
        service,
        Math.min(preparacao.quantidade_alvo - confirmados, pendentes),
        preparacao.janela,
        String(preparacao.data_alvo),
        preparacao.id,
      );
      if (verificacao.instancias_validadoras.length === 0) {
        throw new Error("Nenhuma instância UAZAPI verificadora está conectada");
      }
      verificadosAcumulados += verificacao.verificados + verificacao.erros;
      confirmados = await contar(["com_whatsapp"]);
      if (confirmados >= preparacao.quantidade_alvo) break;
    }

    const resultado = await coletarJanela(service, preparacao.config, preparacao.janela, true, {
      maxPaginas: 1,
      paginaInicial: pagina,
      maxTentativas: 2,
      timeoutMs: 20_000,
      preparacaoId: preparacao.id,
    });
    if (resultado.erro) throw new Error(resultado.erro);
    consultados += resultado.encontrados;
    novos += resultado.novos;
    pagina = resultado.proxima_pagina ?? pagina;

    await atualizar(service, preparacao.id, {
      pagina_atual: pagina,
      cnpjs_consultados: consultados,
      leads_novos: novos,
      numeros_verificados: verificadosAcumulados,
      confirmados_whatsapp: confirmados,
      lease_ate: new Date(Date.now() + 90_000).toISOString(),
    });

    if (resultado.proxima_pagina === null) {
      const finaisPendentes = await contar(["pendente", "nao_verificado", "erro_temporario"]);
      if (finaisPendentes === 0) {
        await atualizar(service, preparacao.id, {
          status: "falhou",
          erro: `A data pesquisada terminou com ${confirmados} de ${preparacao.quantidade_alvo} WhatsApps confirmados. Nenhuma campanha foi criada.`,
          lease_ate: null,
          concluido_em: new Date().toISOString(),
        });
        return;
      }
    }
  }

  confirmados = await contar(["com_whatsapp"]);
  await atualizar(service, preparacao.id, {
    confirmados_whatsapp: confirmados,
    numeros_verificados: verificadosAcumulados,
    lease_ate: null,
  });

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (confirmados >= preparacao.quantidade_alvo) {
    await atualizar(service, preparacao.id, { status: "pronta" });
    const response = await fetch(`${url}/functions/v1/certificado-prospeccao-processar`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ manual_preparacao_id: preparacao.id }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.error || !payload?.job_id) {
      await atualizar(service, preparacao.id, { status: "falhou", erro: payload?.error ?? "Falha ao criar a campanha" });
    }
    return;
  }

  if (profundidade <= 1) {
    await atualizar(service, preparacao.id, {
      status: "pausada",
      erro: "A preparação atingiu o limite seguro desta execução. Clique em continuar para retomar do ponto salvo.",
    });
    return;
  }

  const proximo = (async () => {
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    const response = await fetch(`${url}/functions/v1/certificado-prospeccao-manual`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "processar", preparacao_id: preparacao.id, profundidade: profundidade - 1 }),
    });
    if (!response.ok) console.error("Falha ao continuar preparação", response.status, await response.text());
  })();
  EdgeRuntime.waitUntil(proximo);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);
  const service = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  try {
    const auth = await usuarioAdmin(req, service);
    if (!auth) return json({ error: "Acesso permitido apenas para administradores" }, 403);
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "iniciar");

    if (action === "processar" || action === "continuar") {
      if (action === "processar" && !auth.interno) return json({ error: "Ação interna" }, 403);
      const { data: preparacao } = await service.from("certificado_prospeccao_preparacoes").select("*").eq("id", body?.preparacao_id).maybeSingle();
      if (!preparacao) return json({ error: "Preparação não encontrada" }, 404);
      if (action === "continuar" && preparacao.status !== "pausada") return json({ error: "Esta preparação não está aguardando continuação" }, 409);
      if (action === "continuar") await atualizar(service, preparacao.id, { status: "pendente", erro: null, lease_ate: null });
      const { data: config } = await service.from("certificado_config").select("*").limit(1).maybeSingle();
      const trabalho = processarLote(service, { ...preparacao, status: action === "continuar" ? "pendente" : preparacao.status, config }, Math.min(50, Math.max(1, Number(body?.profundidade ?? 50))));
      if (action === "continuar") {
        EdgeRuntime.waitUntil(trabalho);
        return json({ success: true, retomada: true }, 202);
      }
      await trabalho;
      return json({ success: true });
    }

    const quantidade = Number(body?.quantidade);
    const instanciaIds = Array.isArray(body?.instancia_ids) ? [...new Set(body.instancia_ids.map(String).filter(Boolean))] : [];
    if (!Number.isSafeInteger(quantidade) || quantidade <= 0) return json({ error: "Informe uma quantidade inteira maior que zero" }, 400);
    if (instanciaIds.length === 0) return json({ error: "Selecione pelo menos uma instância para envio" }, 400);

    const { data: cfg, error: cfgError } = await service.from("certificado_config").select("*").limit(1).maybeSingle();
    if (cfgError) throw cfgError;
    if (!cfg?.motor_ativo) return json({ error: "Ative a coleta antes de iniciar" }, 409);
    const modoCasaDados = cfg.modo_teste_casa_dados === true;
    const templateNome = modoCasaDados ? TEMPLATE_TESTE : cfg.template_nome;
    const templateIdioma = "pt_BR";
    if (!templateNome) return json({ error: "Selecione o template" }, 409);
    const janela = janelaExperimentoHoje();
    if (janela === null) return json({ error: "Não há uma faixa de idade ativa para hoje" }, 409);

    const { data: instancias } = await service.from("meta_whatsapp_instances")
      .select("id,meta_bm_id,aquecimento_meta_ativo,estado_pool,pool_fora_manual,saude_status,saude_ban_info,pausa_automatica_ate")
      .in("id", instanciaIds).eq("provider", "meta").eq("ativo", true).eq("instancia_teste_aquecimento", false);
    if ((instancias ?? []).length !== instanciaIds.length) return json({ error: "Uma ou mais instâncias não estão disponíveis" }, 409);
    if (modoCasaDados && (instancias ?? []).some((instancia: any) => instancia.aquecimento_meta_ativo !== true)) return json({ error: "Use somente números marcados para aquecimento de nova BM" }, 409);
    const agora = new Date();
    const aptas = (instancias ?? []).filter((instancia: any) =>
      instancia.estado_pool === "ativo"
      && instancia.pool_fora_manual !== true
      && String(instancia.saude_status ?? "").toUpperCase() === "CONNECTED"
      && !instancia.saude_ban_info
      && (!instancia.pausa_automatica_ate || new Date(instancia.pausa_automatica_ate) <= agora)
    );
    if (aptas.length !== instanciaIds.length) return json({ error: "Uma ou mais instâncias selecionadas não estão conectadas ou disponíveis no pool" }, 409);
    const { data: templatesAprovados, error: templatesError } = await service.from("meta_whatsapp_templates")
      .select("instancia_id")
      .in("instancia_id", instanciaIds)
      .eq("nome_template", templateNome)
      .eq("idioma", templateIdioma)
      .eq("status", "approved");
    if (templatesError) throw templatesError;
    const aprovadas = new Set((templatesAprovados ?? []).map((item: any) => item.instancia_id));
    if (instanciaIds.some((id: string) => !aprovadas.has(id))) return json({ error: "O template não está aprovado em todas as instâncias selecionadas" }, 409);

    const { data: criada, error: criarError } = await service.from("certificado_prospeccao_preparacoes").insert({
      solicitante_id: auth.id,
      quantidade_alvo: quantidade,
      janela,
      data_alvo: dataBRT(janela),
      bm_id: (instancias?.[0] as any)?.meta_bm_id,
      template_nome: templateNome,
      template_idioma: templateIdioma,
      instancia_ids: instanciaIds,
    }).select("*").single();
    if (criarError) {
      if (criarError.code === "23505") return json({ error: "Já existe uma preparação em andamento. Aguarde ou continue a atual." }, 409);
      throw criarError;
    }
    await service.from("certificado_config").update({ prospeccao_instancia_ids: instanciaIds }).eq("id", cfg.id);

    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const trabalho = fetch(`${url}/functions/v1/certificado-prospeccao-manual`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "processar", preparacao_id: criada.id, profundidade: 50 }),
    }).catch((error) => console.error("Falha ao iniciar preparação", error));
    EdgeRuntime.waitUntil(trabalho);
    return json({ success: true, preparacao_id: criada.id, status: criada.status }, 202);
  } catch (error) {
    console.error("certificado-prospeccao-manual", error);
    return json({ error: error instanceof Error ? error.message : "Falha na preparação manual" }, 500);
  }
});
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { coletarJanela, dataBRT } from "../_shared/certificado-ingest.ts";
import { verificarLeadsCertificado } from "../_shared/certificado-whatsapp.ts";

const FOLDER_CERTIFICADO = "9267b296-24e6-425d-9f0e-0e4114c782d9";
const CLARA_ID = "d318692e-dc9a-4895-aa67-e21368a9de04";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const agoraBrt = () => new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
const diaBrt = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const nomeCampanha = () => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(new Date());
const VALOR_CERTIFICADO = "R$ 129,90";
const EXPERIMENTO_INICIO = "2026-09-23";
const EXPERIMENTO_JANELAS = [5, 10, 15, 20, 25, 30] as const;

function janelaExperimentoHoje(): number | null {
  const hoje = diaBrt();
  if (hoje < EXPERIMENTO_INICIO) return null;
  const cursor = new Date(`${EXPERIMENTO_INICIO}T12:00:00Z`);
  const fim = new Date(`${hoje}T12:00:00Z`);
  let diasUteis = 0;
  while (cursor < fim) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const dia = cursor.getUTCDay();
    if (dia !== 0 && dia !== 6) diasUteis++;
  }
  return EXPERIMENTO_JANELAS[diasUteis] ?? null;
}

function formatarDataAbertura(data: string | null | undefined): string {
  const iso = String(data ?? "").slice(0, 10);
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return partes ? `${partes[3]}/${partes[2]}/${partes[1]}` : "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const service = createClient(url, serviceKey);
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    let userId = CLARA_ID;
    if (token !== serviceKey) {
      const { data } = await service.auth.getUser(token);
      if (!data.user?.id) return json({ error: "Não autorizado" }, 401);
      const { data: admin } = await service.rpc("has_role", { _user_id: data.user.id, _role: "admin" });
      if (admin !== true) return json({ error: "Acesso permitido apenas para administradores" }, 403);
      userId = data.user.id;
    }

    const body = await req.json().catch(() => ({}));
    const simulacao = body?.simulacao === true;
    const modoTeste = body?.modo_teste === true;
    const telefoneTeste = String(body?.telefone_teste ?? "").replace(/\D/g, "");
    const completo = body?.iniciar_completo === true;
    const brt = agoraBrt();
    const diaSemana = brt.getDay();
    if (!modoTeste && (diaSemana === 0 || diaSemana === 6)) return json({ success: true, skipped: true, motivo: "A prospecção funciona de segunda a sexta" });
    const janelaExperimento = janelaExperimentoHoje();
    const dataAlvoExperimento = janelaExperimento === null ? undefined : dataBRT(janelaExperimento);

    const { data: cfg, error: cfgError } = await service.from("certificado_config").select("*").limit(1).maybeSingle();
    if (cfgError) throw cfgError;
    if (!cfg?.meta_bm_id || !cfg?.template_nome) return json({ error: "Selecione a BM e o template" }, 409);
    if (!cfg.prospeccao_ativa && !simulacao && !modoTeste) return json({ error: "Piloto desativado" }, 409);
    if (!modoTeste && janelaExperimento === null) {
      if (diaBrt() > "2026-09-30") {
        await service.from("certificado_config").update({ prospeccao_ativa: false, prospeccao_pausada_motivo: "Experimento D+5 a D+30 concluído" }).eq("id", cfg.id);
        return json({ success: true, skipped: true, motivo: "Experimento D+5 a D+30 concluído" });
      }
      return json({ success: true, skipped: true, motivo: "O experimento começa amanhã com CNPJs D+5" });
    }

    const inicioDia = `${diaBrt()}T03:00:00.000Z`;
    let restante = Number(cfg.limite_diario ?? 50);
    let jobExistente: any = null;
    if (!modoTeste) {
      const { data } = await service.from("envio_meta_job").select("id,status,total,enviados,erros").eq("folder_id", FOLDER_CERTIFICADO).gte("created_at", inicioDia).in("status", ["rodando", "pausado", "concluido"]).limit(1).maybeSingle();
      jobExistente = data;
      if (jobExistente && Number(jobExistente.total ?? 0) >= Number(cfg.limite_diario ?? 50) && !simulacao) {
        return json({ success: true, skipped: true, motivo: "A campanha do Certificado Digital de hoje já atingiu o limite configurado", job_id: jobExistente.id, total: jobExistente.total });
      }

      const { count } = await service.from("certificado_prospeccao_envios").select("id", { count: "exact", head: true }).eq("bm_id", cfg.meta_bm_id).gte("reservado_em", inicioDia).in("status", ["reservado","enviado","entregue","lido","respondido"]);
      restante = Math.max(0, Number(cfg.limite_diario ?? 50) - Number(count ?? 0));
      if (!restante) return json({ success: true, skipped: true, motivo: "Limite diário atingido" });
    }

    let resumoColeta: Record<string, unknown> | null = null;
    let resumoVerificacao: Record<string, unknown> | null = null;
    if (completo && cfg.motor_ativo) {
      const metaConfirmados = Number(cfg.limite_diario ?? 50);
      const contarConfirmados = async () => {
        const { count, error } = await service.from("certificado_leads")
          .select("id", { count: "exact", head: true })
          .eq("whatsapp_status", "com_whatsapp").eq("situacao", "novo").eq("dias_desde_abertura", janelaExperimento).eq("data_abertura", dataAlvoExperimento).not("telefone_principal", "is", null);
        if (error) throw error;
        return Number(count ?? 0);
      };
      const contarPendentes = async () => {
        const { count, error } = await service.from("certificado_leads")
          .select("id", { count: "exact", head: true })
          .in("whatsapp_status", ["pendente", "nao_verificado", "erro_temporario"])
          .eq("situacao", "novo").eq("dias_desde_abertura", janelaExperimento).eq("data_abertura", dataAlvoExperimento).not("telefone_principal", "is", null);
        if (error) throw error;
        return Number(count ?? 0);
      };

      let confirmados = await contarConfirmados();
      let pendentes = await contarPendentes();
      resumoColeta = { pulada: true, motivo: "Estoque local suficiente", encontrados: 0, novos: 0, janelas: 0, janelas_sucesso: 0, janelas_falha: 0, janelas_pendentes: 0 };

      if (confirmados < metaConfirmados && pendentes > 0) {
        const verificacao = await verificarLeadsCertificado(service, Math.min(metaConfirmados - confirmados, pendentes), janelaExperimento ?? undefined, dataAlvoExperimento);
        resumoVerificacao = verificacao;
        confirmados = await contarConfirmados();
        pendentes = await contarPendentes();
        if (verificacao.instancias_validadoras.length === 0) {
          return json({ error: "Nenhuma instância UAZAPI selecionada está conectada para verificar os números. Nenhuma campanha foi criada.", coleta: resumoColeta }, 409);
        }
      }

      // A Casa dos Dados só é consultada quando todo o estoque local foi esgotado
      // e ainda faltam contatos para completar o limite diário.
      if (confirmados < metaConfirmados) {
        const inicioProcessamento = Date.now();
        const LIMITE_COLETA_MS = 120_000;
        const janelas = janelaExperimento === null ? [] : [janelaExperimento];
        const resultados = [];
        for (const janela of janelas) {
          let paginaInicial = 1;
          while (Date.now() - inicioProcessamento < LIMITE_COLETA_MS && confirmados < metaConfirmados) {
            const resultado = await coletarJanela(service, cfg, janela, true, { maxPaginas: 10, paginaInicial, maxTentativas: 1, timeoutMs: 15_000 });
            resultados.push(resultado);
            if (resultado.erro || resultado.erro_temporario) break;
            const faltam = Math.max(0, metaConfirmados - confirmados);
            if (faltam > 0 && resultado.novos > 0) {
              resumoVerificacao = await verificarLeadsCertificado(service, Math.min(faltam, resultado.novos), janelaExperimento ?? undefined, dataAlvoExperimento);
            }
            confirmados = await contarConfirmados();
            pendentes = await contarPendentes();
            if (confirmados >= metaConfirmados || resultado.proxima_pagina === null) break;
            paginaInicial = resultado.proxima_pagina;
          }
        }
        const falhas = resultados.filter((resultado) => !!resultado.erro);
        const sucessos = resultados.filter((resultado) => !resultado.erro);
        resumoColeta = {
          pulada: false, janelas: resultados.length, janelas_sucesso: sucessos.length, janelas_falha: falhas.length,
          encontrados: sucessos.reduce((total, resultado) => total + resultado.encontrados, 0),
          novos: sucessos.reduce((total, resultado) => total + resultado.novos, 0),
          paginas_consultadas: sucessos.reduce((total, resultado) => total + resultado.paginas_consultadas, 0),
          janelas_pendentes: Math.max(0, janelas.length - resultados.length),
        };
        if (resultados.length > 0 && sucessos.length === 0) {
          const primeiroErro = falhas[0]?.erro ?? "A coleta não pôde ser concluída.";
          return json({ error: `${primeiroErro} Nenhuma campanha foi criada.`, coleta: resumoColeta }, falhas.some((resultado) => resultado.erro_temporario) ? 503 : 400);
        }
      }

      if (confirmados < metaConfirmados && pendentes > 0 && !resumoVerificacao) {
        const verificacao = await verificarLeadsCertificado(service, Math.min(metaConfirmados - confirmados, pendentes), janelaExperimento ?? undefined, dataAlvoExperimento);
        resumoVerificacao = verificacao;
      }
      const { count: aindaPendentes } = await service.from("certificado_leads")
        .select("id", { count: "exact", head: true })
        .in("whatsapp_status", ["pendente", "nao_verificado", "erro_temporario"])
        .eq("dias_desde_abertura", janelaExperimento)
        .eq("data_abertura", dataAlvoExperimento)
        .not("telefone_principal", "is", null);
      if ((aindaPendentes ?? 0) > 0 && resumoVerificacao && (resumoVerificacao as any).instancias_validadoras.length === 0) {
        return json({
          error: "Nenhuma instância UAZAPI selecionada está conectada para verificar os números. Nenhuma campanha foi criada.",
          coleta: resumoColeta,
        }, 409);
      }
    } else if (completo) {
      return json({ error: "A coleta está desligada. Ative a coleta antes de iniciar o processamento e os envios." }, 409);
    }

    const { data: mestre } = await service.from("meta_templates_mestre").select("id").eq("nome", cfg.template_nome).eq("idioma", cfg.template_idioma).maybeSingle();
    if (!mestre) return json({ error: "Template selecionado não foi encontrado" }, 409);
    const { data: disponibilidade } = await service.from("certificado_prospeccao_templates").select("ativo").eq("template_mestre_id", mestre.id).maybeSingle();
    if (disponibilidade?.ativo === false) return json({ error: "Template inabilitado no Certificado Digital" }, 409);

    const { data: instancias } = await service.from("meta_whatsapp_instances")
      .select("id,nome,user_id,display_phone,saude_status,saude_quality,saude_ban_info,estado_pool,pool_fora_manual,pausa_automatica_ate,ativo,instancia_teste_aquecimento")
      .eq("meta_bm_id", cfg.meta_bm_id).eq("provider", "meta").eq("ativo", true).eq("instancia_teste_aquecimento", false);
    const agora = new Date();
    const aptas = (instancias ?? []).filter((i: any) => i.estado_pool === "ativo" && i.pool_fora_manual !== true && String(i.saude_status ?? "").toUpperCase() === "CONNECTED" && !i.saude_ban_info && (!i.pausa_automatica_ate || new Date(i.pausa_automatica_ate) <= agora));
    const { data: templates } = aptas.length ? await service.from("meta_whatsapp_templates").select("id,instancia_id,nome_template,idioma,status").in("instancia_id", aptas.map((i: any) => i.id)).eq("nome_template", cfg.template_nome).eq("idioma", cfg.template_idioma).eq("status", "approved") : { data: [] };
    const porInstancia = new Map((templates ?? []).map((t: any) => [t.instancia_id, t]));
    const participantes = aptas.filter((i: any) => porInstancia.has(i.id));
    if (!participantes.length) return json({ success: true, skipped: true, motivo: "Template não aprovado em nenhuma instância apta" });

    if (modoTeste) {
      if (telefoneTeste.length < 10) return json({ error: "Informe um telefone de teste válido" }, 400);
      const instancia: any = participantes[0];
      const template: any = porInstancia.get(instancia.id);
      const response = await fetch(`${url}/functions/v1/send-whatsapp-meta`, { method: "POST", headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ template_id: template.id, instancia_id: instancia.id, cliente: { telefone: telefoneTeste, nome: "Cliente teste" }, user_id: userId, modo_teste: true, folder_id: FOLDER_CERTIFICADO, atendente_nome: "Clara Ribeiro de Souza" }) });
      return json({ success: response.ok, resultado: await response.json().catch(() => ({})), instancia: instancia.nome });
    }

    const dataAlvo = dataAlvoExperimento ?? null;
    let leadsQuery = service.from("certificado_leads").select("id,cnpj,razao_social,nome_fantasia,telefone_principal,data_abertura,dias_desde_abertura").eq("whatsapp_status", "com_whatsapp").eq("situacao", "novo").not("telefone_principal", "is", null);
    if (janelaExperimento !== null && dataAlvo) leadsQuery = leadsQuery.eq("dias_desde_abertura", janelaExperimento).eq("data_abertura", dataAlvo);
    const { data: leadsCandidatos, error: leadsError } = await leadsQuery.order("created_at", { ascending: true }).limit(Math.max(restante * 4, restante));
    if (leadsError) throw leadsError;
    const sufixosJaUsados = new Set<string>();
    for (let inicio = 0; ; inicio += 1000) {
      const { data: usados, error: usadosError } = await service.from("certificado_prospeccao_envios")
        .select("certificado_leads!inner(telefone_principal)").in("status", ["reservado", "enviado", "entregue", "lido", "respondido"])
        .range(inicio, inicio + 999);
      if (usadosError) throw usadosError;
      for (const envio of usados ?? []) {
        const telefone = String((envio as any).certificado_leads?.telefone_principal ?? "").replace(/\D/g, "");
        if (telefone.length >= 8) sufixosJaUsados.add(telefone.slice(-8));
      }
      if ((usados ?? []).length < 1000) break;
    }
    const leads = (leadsCandidatos ?? []).filter((lead: any) => {
      const telefone = String(lead.telefone_principal ?? "").replace(/\D/g, "");
      const sufixo = telefone.slice(-8);
      if (!sufixo || sufixosJaUsados.has(sufixo)) return false;
      sufixosJaUsados.add(sufixo);
      return true;
    }).slice(0, restante);
    if (simulacao) return json({ success: true, simulacao: true, elegiveis: leads?.length ?? 0, limite_restante: restante, participantes: participantes.map((i: any) => ({ id: i.id, nome: i.nome, telefone: i.display_phone })) });
    if (!leads?.length) return json({
      success: true,
      skipped: true,
      motivo: "A coleta terminou, mas nenhum contato com WhatsApp ficou elegível para envio.",
      coleta: resumoColeta,
      verificacao: resumoVerificacao,
      parcial: Number((resumoColeta as any)?.janelas_falha ?? 0) > 0,
    });

    // Revalida imediatamente antes da criação para reduzir o risco de cliques concorrentes.
    const { data: jobCriadoEnquantoProcessava } = await service.from("envio_meta_job").select("id,total,status").eq("folder_id", FOLDER_CERTIFICADO).gte("created_at", inicioDia).in("status", ["rodando", "pausado", "concluido"]).limit(1).maybeSingle();
    if (jobCriadoEnquantoProcessava) jobExistente = jobCriadoEnquantoProcessava;

    const principal: any = porInstancia.get(participantes[0].id);
    const templateIdByInstance = Object.fromEntries(participantes.map((i: any) => [i.id, (porInstancia.get(i.id) as any).id]));
    let job = jobExistente ? { id: jobExistente.id } : null;
    if (!job) {
      const { data: criado, error: jobError } = await service.from("envio_meta_job").insert({
        user_id: userId, status: "rodando", template_id: principal.id, template_nome: cfg.template_nome,
        template_id_by_instance: templateIdByInstance, instancia_ids: participantes.map((i: any) => i.id),
        min_seg: 30, max_seg: 90, total: leads.length, proximo_em: new Date().toISOString(),
        nome_campanha: `Certificado Digital — D+${janelaExperimento} — ${nomeCampanha()}`, folder_id: FOLDER_CERTIFICADO,
        validar_no_envio: false,
      }).select("id").single();
      if (jobError || !criado) throw jobError ?? new Error("Falha ao criar campanha");
      job = criado;
    }

    let rr = Number(cfg.ultimo_rr_indice ?? 0);
    const reservas: any[] = [];
    const ordemInicial = Number(jobExistente?.total ?? 0);
    for (const lead of leads) {
      const instancia: any = participantes[rr % participantes.length];
      const { data: reserva, error } = await service.from("certificado_prospeccao_envios").insert({ lead_id: lead.id, bm_id: cfg.meta_bm_id, instancia_id: instancia.id, template_nome: cfg.template_nome, template_idioma: cfg.template_idioma, job_id: job.id }).select("id").maybeSingle();
      if (!error && reserva) reservas.push({ lead, reserva, ordem: ordemInicial + reservas.length });
      rr++;
    }
    if (!reservas.length) {
      await service.from("envio_meta_job").update({ status: "erro", status_motivo: "Nenhum contato pôde ser reservado", concluido_em: new Date().toISOString() }).eq("id", job.id);
      return json({ success: true, skipped: true, motivo: "Os contatos elegíveis já pertencem a outra campanha" });
    }
    await service.from("envio_meta_job").update({
      total: ordemInicial + reservas.length,
      status: "rodando",
      status_motivo: null,
      concluido_em: null,
      proximo_em: new Date().toISOString(),
    }).eq("id", job.id);
    const itens = reservas.map(({ lead, reserva, ordem }) => {
      const nome = lead.nome_fantasia || lead.razao_social || "cliente";
      return {
        job_id: job.id, ordem, telefone: lead.telefone_principal, nome, cpf: lead.cnpj,
        status: "pendente",
        vars: {
          "1": nome,
          "2": String(lead.cnpj ?? "").replace(/\D/g, "").padStart(14, "0"),
          "3": formatarDataAbertura(lead.data_abertura),
          "4": VALOR_CERTIFICADO,
          certificado_lead_id: lead.id,
          certificado_envio_id: reserva.id,
        },
        wa_validado: "sim",
      };
    });
    const { data: itensCriados, error: itensError } = await service.from("envio_meta_job_item").insert(itens).select("id,vars");
    if (itensError) throw itensError;
    for (const item of itensCriados ?? []) {
      const envioId = (item.vars as any)?.certificado_envio_id;
      if (envioId) await service.from("certificado_prospeccao_envios").update({ job_item_id: item.id }).eq("id", envioId);
    }
    await service.from("certificado_config").update({ ultimo_rr_indice: rr, prospeccao_ultima_execucao: new Date().toISOString(), prospeccao_pausada_motivo: null }).eq("id", cfg.id);
    fetch(`${url}/functions/v1/envio-meta-massa-tick`, { method: "POST", headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ job_id: job.id }) }).catch(() => {});
    return json({
      success: true,
      job_id: job.id,
      total: reservas.length,
      janela: janelaExperimento,
      data_abertura: dataAlvo,
      participantes: participantes.map((i: any) => i.nome),
      coleta: resumoColeta,
      verificacao: resumoVerificacao,
      parcial: Number((resumoColeta as any)?.janelas_falha ?? 0) > 0,
    });
  } catch (error) {
    console.error("certificado-prospeccao-processar", error);
    return json({ error: error instanceof Error ? error.message : "Falha na prospecção" }, 500);
  }
});
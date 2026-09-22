import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { coletarJanela } from "../_shared/certificado-ingest.ts";
import { verificarLeadsCertificado } from "../_shared/certificado-whatsapp.ts";

const FOLDER_CERTIFICADO = "9267b296-24e6-425d-9f0e-0e4114c782d9";
const CLARA_ID = "d318692e-dc9a-4895-aa67-e21368a9de04";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const agoraBrt = () => new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
const diaBrt = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const nomeCampanha = () => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(new Date());

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

    const { data: cfg, error: cfgError } = await service.from("certificado_config").select("*").limit(1).maybeSingle();
    if (cfgError) throw cfgError;
    if (!cfg?.meta_bm_id || !cfg?.template_nome) return json({ error: "Selecione a BM e o template" }, 409);
    if (!cfg.prospeccao_ativa && !simulacao && !modoTeste) return json({ error: "Piloto desativado" }, 409);

    let resumoColeta: Record<string, unknown> | null = null;
    let resumoVerificacao: Record<string, unknown> | null = null;
    if (completo && cfg.motor_ativo) {
      const janelas = [...new Set((cfg.janelas_dias ?? []).map(Number))].filter((n) => Number.isInteger(n) && n >= 0 && n <= 30).sort((a, b) => a - b);
      const resultados = [];
      for (const janela of janelas) {
        const resultado = await coletarJanela(service, cfg, janela, true);
        resultados.push(resultado);
        if (resultado.erro_temporario) break;
      }
      const falhas = resultados.filter((resultado) => !!resultado.erro);
      const sucessos = resultados.filter((resultado) => !resultado.erro);
      resumoColeta = {
        janelas: resultados.length,
        janelas_sucesso: sucessos.length,
        janelas_falha: falhas.length,
        encontrados: sucessos.reduce((total, resultado) => total + resultado.encontrados, 0),
        novos: sucessos.reduce((total, resultado) => total + resultado.novos, 0),
      };
      if (resultados.length > 0 && sucessos.length === 0) {
        return json({
          error: "A Casa dos Dados está temporariamente indisponível. Nenhuma campanha foi criada. Tente novamente em alguns minutos.",
          coleta: resumoColeta,
        }, 503);
      }

      const verificacao = await verificarLeadsCertificado(service, 2000);
      resumoVerificacao = verificacao;
      const { count: pendentes } = await service.from("certificado_leads")
        .select("id", { count: "exact", head: true })
        .in("whatsapp_status", ["pendente", "nao_verificado", "erro_temporario"])
        .not("telefone_principal", "is", null);
      if ((pendentes ?? 0) > 0 && verificacao.instancias_validadoras.length === 0) {
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
      .select("id,nome,user_id,display_phone,saude_status,saude_quality,saude_ban_info,estado_pool,pool_fora_manual,pausa_automatica_ate,ativo")
      .eq("meta_bm_id", cfg.meta_bm_id).eq("provider", "meta").eq("ativo", true);
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

    const inicioDia = `${diaBrt()}T03:00:00.000Z`;
    const { data: jobExistente } = await service.from("envio_meta_job").select("id,status,total,enviados,erros").eq("folder_id", FOLDER_CERTIFICADO).gte("created_at", inicioDia).in("status", ["rodando", "pausado", "concluido"]).limit(1).maybeSingle();
    if (jobExistente && !simulacao) return json({ success: true, skipped: true, motivo: "A campanha do Certificado Digital de hoje já foi criada", job_id: jobExistente.id, total: jobExistente.total });

    const { count } = await service.from("certificado_prospeccao_envios").select("id", { count: "exact", head: true }).eq("bm_id", cfg.meta_bm_id).gte("reservado_em", inicioDia).in("status", ["reservado","enviado","entregue","lido","respondido"]);
    const restante = Math.max(0, Number(cfg.limite_diario ?? 50) - Number(count ?? 0));
    if (!restante) return json({ success: true, skipped: true, motivo: "Limite diário atingido" });
    const { data: leads, error: leadsError } = await service.from("certificado_leads").select("id,cnpj,razao_social,nome_fantasia,telefone_principal").eq("whatsapp_status", "com_whatsapp").eq("situacao", "novo").not("telefone_principal", "is", null).order("created_at", { ascending: true }).limit(restante);
    if (leadsError) throw leadsError;
    if (simulacao) return json({ success: true, simulacao: true, elegiveis: leads?.length ?? 0, limite_restante: restante, participantes: participantes.map((i: any) => ({ id: i.id, nome: i.nome, telefone: i.display_phone })) });
    if (!leads?.length) return json({
      success: true,
      skipped: true,
      motivo: "A coleta terminou, mas nenhum contato com WhatsApp ficou elegível para envio.",
      coleta: resumoColeta,
      verificacao: resumoVerificacao,
      parcial: Number((resumoColeta as any)?.janelas_falha ?? 0) > 0,
    });

    const principal: any = porInstancia.get(participantes[0].id);
    const templateIdByInstance = Object.fromEntries(participantes.map((i: any) => [i.id, (porInstancia.get(i.id) as any).id]));
    const { data: job, error: jobError } = await service.from("envio_meta_job").insert({
      user_id: userId, status: "rodando", template_id: principal.id, template_nome: cfg.template_nome,
      template_id_by_instance: templateIdByInstance, instancia_ids: participantes.map((i: any) => i.id),
      min_seg: 30, max_seg: 90, total: leads.length, proximo_em: new Date().toISOString(),
      nome_campanha: `Certificado Digital — ${nomeCampanha()}`, folder_id: FOLDER_CERTIFICADO,
      validar_no_envio: false,
    }).select("id").single();
    if (jobError || !job) throw jobError ?? new Error("Falha ao criar campanha");

    let rr = Number(cfg.ultimo_rr_indice ?? 0);
    const reservas: any[] = [];
    for (const lead of leads) {
      const instancia: any = participantes[rr % participantes.length];
      const { data: reserva, error } = await service.from("certificado_prospeccao_envios").insert({ lead_id: lead.id, bm_id: cfg.meta_bm_id, instancia_id: instancia.id, template_nome: cfg.template_nome, template_idioma: cfg.template_idioma, job_id: job.id }).select("id").maybeSingle();
      if (!error && reserva) reservas.push({ lead, reserva, ordem: reservas.length });
      rr++;
    }
    if (!reservas.length) {
      await service.from("envio_meta_job").update({ status: "erro", status_motivo: "Nenhum contato pôde ser reservado", concluido_em: new Date().toISOString() }).eq("id", job.id);
      return json({ success: true, skipped: true, motivo: "Os contatos elegíveis já pertencem a outra campanha" });
    }
    await service.from("envio_meta_job").update({ total: reservas.length }).eq("id", job.id);
    const itens = reservas.map(({ lead, reserva, ordem }) => ({
      job_id: job.id, ordem, telefone: lead.telefone_principal, nome: lead.nome_fantasia || lead.razao_social || "cliente", cpf: lead.cnpj,
      status: "pendente", vars: { certificado_lead_id: lead.id, certificado_envio_id: reserva.id }, wa_validado: "sim",
    }));
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
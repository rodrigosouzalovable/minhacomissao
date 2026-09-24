import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { enviarTexto, etiquetasAtendente, etiquetarAguardandoHumano, ehOptOut, iagoAtendeCaixa, suprimirDestinatario, temAtendenteHumanoNoTelefone } from "../_shared/iago.ts";
import { notificarAdmin } from "../_shared/notificar-admin.ts";

const CLARA_ID = "d318692e-dc9a-4895-aa67-e21368a9de04";
const FOLDER_CERTIFICADO = "9267b296-24e6-425d-9f0e-0e4114c782d9";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
type Classificacao = "interesse" | "duvida" | "objecao" | "recusa" | "numero_errado" | "optout" | "documentos" | "humano";
type Decisao = { classificacao: Classificacao; resposta: string; interesse: boolean; transferir_humano: boolean; etapa: string };

const OFERTA_INICIAL = "Estamos entrando em contato para verificar se o certificado digital da sua empresa já foi emitido. Estamos com uma promoção para emissão do certificado digital PJ A1 pelo valor de R$ 129,90. Você tem interesse em emitir o certificado?";

async function garantirAtribuicaoClara(service: any, contatoId: string) {
  const tags = await etiquetasAtendente(service, contatoId);
  if (tags.some((tag) => tag.replace(/^atendente:\s*/i, "").trim().toLowerCase() === "clara ribeiro de souza")) return true;
  const { data: etiqueta } = await service.from("meta_whatsapp_etiquetas")
    .select("id").ilike("nome", "Atendente: Clara Ribeiro de Souza").limit(1).maybeSingle();
  if (!etiqueta?.id) return false;
  const { error } = await service.from("meta_whatsapp_contato_etiquetas").upsert(
    { contato_id: contatoId, etiqueta_id: etiqueta.id, origem: "manual" },
    { onConflict: "contato_id,etiqueta_id", ignoreDuplicates: true },
  );
  if (error) console.error("[Clara] falha ao atribuir conversa", error.message);
  return !error;
}

async function escalarParaAdmin(service: any, contato: any, entradaId: string, motivo: string) {
  await etiquetarAguardandoHumano(service, contato.id);
  const telefone = String(contato.telefone || "").replace(/\D/g, "");
  const mensagem = `A Clara precisa de auxílio humano na caixa CERTIFICADO.\n\nCliente: ${contato.nome || "Não identificado"}\nTelefone: ${telefone || "Não informado"}\nMotivo: ${motivo || "Atendimento encaminhado pela Clara"}`;
  const chaveIdempotencia = `clara:${contato.id}:${entradaId || "sem-entrada"}`;
  try {
    await service.from("admin_notificacoes_log").upsert({
      tipo: "clara_humano_painel",
      chave_idempotencia: chaveIdempotencia,
      mensagem,
      status: "interno",
    }, { onConflict: "chave_idempotencia", ignoreDuplicates: true });
  } catch (error) {
    console.error("[Clara] falha ao registrar aviso interno", error);
  }
  const aviso = await notificarAdmin(service, {
    tipo: "clara_humano",
    mensagem,
    chaveIdempotencia,
  });
  if (!aviso.success && aviso.skipped !== "ja_enviado") console.error("[Clara] falha ao avisar admin", aviso.error || aviso.skipped);
}

function extrairJson(texto: string): Decisao | null {
  try {
    const inicio = texto.indexOf("{");
    const fim = texto.lastIndexOf("}");
    if (inicio < 0 || fim <= inicio) return null;
    const valor = JSON.parse(texto.slice(inicio, fim + 1));
    const permitidas: Classificacao[] = ["interesse", "duvida", "objecao", "recusa", "numero_errado", "optout", "documentos", "humano"];
    if (!permitidas.includes(valor.classificacao) || typeof valor.resposta !== "string") return null;
    return {
      classificacao: valor.classificacao,
      resposta: valor.resposta.trim().slice(0, 900),
      interesse: valor.interesse === true,
      transferir_humano: valor.transferir_humano === true,
      etapa: String(valor.etapa || "conversa").slice(0, 60),
    };
  } catch {
    return null;
  }
}

async function decidirComIA(texto: string, historico: Array<{ direcao: string; conteudo: string }>, contexto: Record<string, unknown>, fluxo: { mensagemAgendar: string; mensagemDocumentos: string; mensagemRecebido: string }): Promise<Decisao> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) return { classificacao: "humano", resposta: "", interesse: false, transferir_humano: true, etapa: "aguardando_humano" };
  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "fetch" },
    body: JSON.stringify({
      model: "openai/gpt-6-astra",
      stream: true,
      reasoning: { effort: "low", summary: "auto" },
      store: false,
      input: [
        { role: "developer", content: [{ type: "input_text", text: `Você é Clara Ribeiro de Souza, vendedora ultra profissional de certificados digitais no Brasil. Interprete antes de responder. Seja humana, objetiva, educada e consultiva; nunca invente autoridade pública nem diga que houve uma atualização real do CNPJ. O contato inicial usou uma mensagem de prospecção e agora você deve esclarecer a oferta. Quando a promoção ainda não tiver sido apresentada e a resposta não for uma recusa, opt-out, número realmente errado ou situação sensível, responda exatamente: "${OFERTA_INICIAL}". Dizer que o contador informou, cuida disso ou sabe do assunto NÃO significa número errado e deve receber essa oferta. Só classifique numero_errado quando a pessoa disser claramente que não é responsável, não conhece a empresa ou que o número está errado. O preço oficial desta oferta é certificado digital PJ A1 por R$ 129,90. Quando o cliente demonstrar interesse em avançar, use esta mensagem de agendamento: "${fluxo.mensagemAgendar}". Depois que aceitar o agendamento, use esta mensagem de documentos: "${fluxo.mensagemDocumentos}". Quando CNPJ, e-mail e CNH estiverem todos recebidos, use esta confirmação: "${fluxo.mensagemRecebido}" e transfira ao humano. Pedido de parar/sair é optout. Reclamação, situação sensível, dúvida jurídica, desconfiança forte ou pedido explícito de uma pessoa deve ir para humano. Não responda novamente a uma recusa clara. Retorne somente JSON válido: {"classificacao":"interesse|duvida|objecao|recusa|numero_errado|optout|documentos|humano","resposta":"texto curto em pt-BR ou vazio quando não deve responder","interesse":boolean,"transferir_humano":boolean,"etapa":"conversa|agendamento|aguardando_documentos|aguardando_humano|encerrado"}. Contexto registrado: ${JSON.stringify(contexto)}. Histórico: ${JSON.stringify(historico.slice(-12))}` }] },
        { role: "user", content: [{ type: "input_text", text: texto.slice(0, 1500) }] },
      ],
    }),
  });
  if (!res.ok) {
    const detalhe = await res.text();
    console.error("[Clara] AI Gateway", res.status, detalhe.slice(0, 500));
    return { classificacao: "humano", resposta: "", interesse: false, transferir_humano: true, etapa: "aguardando_humano" };
  }
  const reader = res.body?.getReader();
  if (!reader) return { classificacao: "humano", resposta: "", interesse: false, transferir_humano: true, etapa: "aguardando_humano" };
  const decoder = new TextDecoder();
  let buffer = "";
  let saida = "";
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    buffer += decoder.decode(chunk.value, { stream: true });
    const linhas = buffer.split("\n");
    buffer = linhas.pop() || "";
    for (const linha of linhas) {
      if (!linha.startsWith("data: ") || linha === "data: [DONE]") continue;
      try {
        const evento = JSON.parse(linha.slice(6));
        if (evento.type === "response.output_text.delta") saida += String(evento.delta || "");
      } catch { /* evento incompleto */ }
    }
  }
  return extrairJson(saida) ?? { classificacao: "humano", resposta: "", interesse: false, transferir_humano: true, etapa: "aguardando_humano" };
}

async function atualizarMetrica(service: any, contato: any, decisao: Decisao, texto: string) {
  const sufixo = String(contato.telefone || "").replace(/\D/g, "").slice(-8);
  if (sufixo.length !== 8) return;
  const { data: envios } = await service.from("certificado_prospeccao_envios")
    .select("id,certificado_leads!inner(telefone_principal)")
    .eq("instancia_id", contato.instancia_id).in("status", ["enviado", "entregue", "lido", "respondido"])
    .order("reservado_em", { ascending: false }).limit(100);
  const envio = (envios || []).find((item: any) => String(item.certificado_leads?.telefone_principal || "").replace(/\D/g, "").endsWith(sufixo));
  if (!envio?.id) return;
  await service.from("certificado_prospeccao_envios").update({
    status: "respondido",
    respondido_em: new Date().toISOString(),
    resposta_texto: texto.slice(0, 1000),
    resposta_classificacao: decisao.classificacao,
    interesse_confirmado: decisao.interesse,
    transferido_humano: decisao.transferir_humano,
    updated_at: new Date().toISOString(),
  }).eq("id", envio.id);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const service = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const body = await req.json().catch(() => ({}));
    const contatoId = String(body?.contato_id ?? "");
    const texto = String(body?.texto ?? "").trim();
    if (!contatoId || !texto) return json({ success: false, error: "contato_id e texto são obrigatórios" }, 400);
    const { data: cfg } = await service.from("clara_config").select("*").eq("id", 1).maybeSingle();
    if (cfg?.ativo !== true) return json({ success: true, skipped: "Clara desligada" });
    const { data: contato } = await service.from("meta_whatsapp_contatos").select("id,instancia_id,telefone,bsuid,nome,folder_id").eq("id", contatoId).maybeSingle();
    if (!contato || contato.folder_id !== FOLDER_CERTIFICADO) return json({ success: true, skipped: "fora da caixa CERTIFICADO" });
    if (!(await iagoAtendeCaixa(service, CLARA_ID, contato.folder_id))) return json({ success: true, skipped: "Clara não vinculada à caixa" });
    if (!(await garantirAtribuicaoClara(service, contatoId))) return json({ success: true, skipped: "não foi possível atribuir a conversa à Clara" });
    if (await temAtendenteHumanoNoTelefone(service, contatoId, "Clara Ribeiro de Souza", { folderId: contato.folder_id })) return json({ success: true, skipped: "atendente humano vinculado" });

    let { data: estado } = await service.from("clara_conversa_estado").select("*").eq("contato_id", contatoId).maybeSingle();
    if (!estado) {
      const { data } = await service.from("clara_conversa_estado").insert({ contato_id: contatoId, telefone: contato.telefone ?? "" }).select("*").maybeSingle();
      estado = data;
    }
    if (!estado || estado.optout || estado.aguardando_humano) return json({ success: true, skipped: "atendimento automático encerrado" });
    if (ehOptOut(texto)) {
      const decisao: Decisao = { classificacao: "optout", resposta: "", interesse: false, transferir_humano: false, etapa: "encerrado" };
      await service.from("clara_conversa_estado").update({ optout: true, etapa: "optout", updated_at: new Date().toISOString() }).eq("id", estado.id);
      await suprimirDestinatario(service, contato.telefone, "blacklist: cliente pediu bloqueio no Certificado Digital", { instancia_id: contato.instancia_id, contato_nome: contato.nome, caixa_id: contato.folder_id, caixa_nome: "CERTIFICADO" });
      await atualizarMetrica(service, contato, decisao, texto);
      return json({ success: true, etapa: "optout" });
    }

    const sufixo = String(contato.telefone || "").replace(/\D/g, "").slice(-8);
    const { data: mensagens } = await service.from("meta_whatsapp_mensagens")
      .select("direcao,conteudo,timestamp_msg").eq("instancia_id", contato.instancia_id)
      .ilike("telefone", `%${sufixo}`).order("timestamp_msg", { ascending: false }).limit(12);
    const contexto = { ...(estado.contexto || {}) };
    const digits = texto.replace(/\D/g, "");
    if (digits.length >= 14) contexto.cnpj = true;
    if (/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(texto)) contexto.email = true;
    if (String(body?.tipo_conteudo || "").toLowerCase() === "documento" || /\b(cnh|carteira (nacional )?de habilita[cç][aã]o)\b/i.test(texto)) contexto.cnh = true;

    const decisao = await decidirComIA(texto, (mensagens || []).reverse(), contexto, {
      mensagemAgendar: String(cfg.mensagem_agendar || ""),
      mensagemDocumentos: String(cfg.mensagem_documentos || ""),
      mensagemRecebido: String(cfg.mensagem_recebido || ""),
    });
    const primeiraAbordagem = contexto.oferta_apresentada !== true;
    if (primeiraAbordagem && /\bcontador(?:a)?\b/i.test(texto) && !ehOptOut(texto)) {
      decisao.classificacao = "duvida";
      decisao.resposta = OFERTA_INICIAL;
      decisao.interesse = false;
      decisao.transferir_humano = false;
      decisao.etapa = "conversa";
    }
    if (decisao.resposta === OFERTA_INICIAL) contexto.oferta_apresentada = true;
    await atualizarMetrica(service, contato, decisao, texto);
    const agora = new Date().toISOString();
    if (decisao.classificacao === "optout") {
      await suprimirDestinatario(service, contato.telefone, "blacklist: cliente pediu bloqueio no Certificado Digital", { instancia_id: contato.instancia_id, contato_nome: contato.nome, caixa_id: contato.folder_id, caixa_nome: "CERTIFICADO" });
    }
    if (decisao.resposta && !["recusa", "numero_errado", "optout"].includes(decisao.classificacao)) await enviarTexto(service, contato, decisao.resposta);
    if (decisao.transferir_humano) {
      await escalarParaAdmin(service, contato, String(body?.entrada_id ?? ""), `Classificação: ${decisao.classificacao}. Mensagem recebida: ${texto.slice(0, 350)}`);
    }
    await service.from("clara_conversa_estado").update({
      contexto,
      etapa: decisao.etapa,
      optout: decisao.classificacao === "optout",
      aguardando_humano: decisao.transferir_humano,
      ultima_resposta_em: agora,
      updated_at: agora,
    }).eq("id", estado.id);
    return json({ success: true, classificacao: decisao.classificacao, etapa: decisao.etapa, transferido_humano: decisao.transferir_humano });
  } catch (error) {
    console.error("clara-atendimento", error);
    return json({ error: error instanceof Error ? error.message : "Falha no atendimento da Clara" }, 500);
  }
});
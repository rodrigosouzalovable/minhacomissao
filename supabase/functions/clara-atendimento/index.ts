import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { enviarTexto, etiquetasAtendente, etiquetarAguardandoHumano, ehOptOut, iagoAtendeCaixa, suprimirDestinatario, temAtendenteHumanoNoTelefone } from "../_shared/iago.ts";

const CLARA_ID = "d318692e-dc9a-4895-aa67-e21368a9de04";
const FOLDER_CERTIFICADO = "9267b296-24e6-425d-9f0e-0e4114c782d9";
const MSG_AGENDAR = "Para emissão do certificado digital é necessário agendar com você uma videoconferência hoje que leva apenas 3 minutos. Podemos realizar o agendamento?";
const MSG_DOCUMENTOS = "Para que possamos realizar o agendamento da videoconferência para emissão do seu certificado digital é necessário que nos encaminhe o seu CNPJ seu e-mail e uma CNH que pode ser física ou digital. Consegue nos enviar por gentileza?";
const MSG_RECEBIDO = "Recebi seus dados e documentos. Obrigada! Vou encaminhar seu atendimento para nossa equipe concluir o agendamento.";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const normalizar = (v: string) => v.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const ehInteresse = (t: string) => /(tenho interesse|me interessa|quero|gostaria|preciso|como funciona|pode explicar|certificado)/.test(normalizar(t));
const ehAceite = (t: string) => /(^|\b)(sim|pode|podemos|claro|ok|certo|vamos|consigo|aceito|quero)(\b|$)/.test(normalizar(t));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const service = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const body = await req.json().catch(() => ({}));
    const contatoId = String(body?.contato_id ?? "");
    const texto = String(body?.texto ?? "").trim();
    const tipo = String(body?.tipo_conteudo ?? "texto").toLowerCase();
    if (!contatoId) return json({ success: false, error: "contato_id é obrigatório" }, 400);
    const { data: cfg } = await service.from("clara_config").select("*").eq("id", 1).maybeSingle();
    if (cfg?.ativo !== true) return json({ success: true, skipped: "Clara desligada" });
    const { data: contato } = await service.from("meta_whatsapp_contatos").select("id,instancia_id,telefone,bsuid,nome,folder_id").eq("id", contatoId).maybeSingle();
    if (!contato || contato.folder_id !== FOLDER_CERTIFICADO) return json({ success: true, skipped: "fora da caixa CERTIFICADO" });
    if (!(await iagoAtendeCaixa(service, CLARA_ID, contato.folder_id))) return json({ success: true, skipped: "Clara não vinculada à caixa" });
    const tags = await etiquetasAtendente(service, contatoId);
    if (!tags.some((tag) => tag.replace(/^atendente:\s*/i, "").trim().toLowerCase() === "clara ribeiro de souza")) return json({ success: true, skipped: "conversa não atribuída à Clara" });
    if (await temAtendenteHumanoNoTelefone(service, contatoId, "Clara Ribeiro de Souza", { folderId: contato.folder_id })) return json({ success: true, skipped: "atendente humano vinculado" });

    let { data: estado } = await service.from("clara_conversa_estado").select("*").eq("contato_id", contatoId).maybeSingle();
    if (!estado) {
      const { data } = await service.from("clara_conversa_estado").insert({ contato_id: contatoId, telefone: contato.telefone ?? "" }).select("*").maybeSingle();
      estado = data;
    }
    if (!estado) return json({ success: false, error: "Não foi possível iniciar o atendimento" }, 500);
    if (estado.optout || estado.aguardando_humano) return json({ success: true, skipped: "atendimento automático encerrado" });
    if (ehOptOut(texto)) {
      await service.from("clara_conversa_estado").update({ optout: true, etapa: "optout", updated_at: new Date().toISOString() }).eq("id", estado.id);
      await suprimirDestinatario(service, contato.telefone, "blacklist: cliente pediu bloqueio no Certificado Digital", { instancia_id: contato.instancia_id, contato_nome: contato.nome, caixa_id: contato.folder_id, caixa_nome: "CERTIFICADO" });
      return json({ success: true, etapa: "optout" });
    }

    const contexto = { ...(estado.contexto ?? {}) };
    const digits = texto.replace(/\D/g, "");
    if (digits.length >= 14) contexto.cnpj = true;
    if (/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(texto)) contexto.email = true;
    if (["imagem", "documento"].includes(tipo) || /\bcnh\b/i.test(texto)) contexto.cnh = true;
    const agora = new Date().toISOString();

    if (contexto.cnpj && contexto.email && contexto.cnh) {
      await enviarTexto(service, contato, cfg?.mensagem_recebido || MSG_RECEBIDO);
      await etiquetarAguardandoHumano(service, contatoId);
      await service.from("clara_conversa_estado").update({ contexto, etapa: "aguardando_humano", aguardando_humano: true, ultima_resposta_em: agora, updated_at: agora }).eq("id", estado.id);
      return json({ success: true, etapa: "aguardando_humano" });
    }

    if (estado.etapa === "aguardando_documentos") {
      await service.from("clara_conversa_estado").update({ contexto, updated_at: agora }).eq("id", estado.id);
      return json({ success: true, etapa: "aguardando_documentos", documentos: contexto });
    }
    if (estado.etapa === "aguardando_confirmacao" && ehAceite(texto)) {
      await enviarTexto(service, contato, cfg?.mensagem_documentos || MSG_DOCUMENTOS);
      await service.from("clara_conversa_estado").update({ contexto, etapa: "aguardando_documentos", ultima_resposta_em: agora, updated_at: agora }).eq("id", estado.id);
      return json({ success: true, etapa: "aguardando_documentos" });
    }
    if (ehInteresse(texto) || ehAceite(texto)) {
      await enviarTexto(service, contato, cfg?.mensagem_agendar || MSG_AGENDAR);
      await service.from("clara_conversa_estado").update({ contexto, etapa: "aguardando_confirmacao", ultima_resposta_em: agora, updated_at: agora }).eq("id", estado.id);
      return json({ success: true, etapa: "aguardando_confirmacao" });
    }

    await etiquetarAguardandoHumano(service, contatoId);
    await service.from("clara_conversa_estado").update({ contexto, etapa: "aguardando_humano", aguardando_humano: true, updated_at: agora }).eq("id", estado.id);
    return json({ success: true, etapa: "aguardando_humano", motivo: "dúvida fora do roteiro" });
  } catch (error) {
    console.error("clara-atendimento", error);
    return json({ error: error instanceof Error ? error.message : "Falha no atendimento da Clara" }, 500);
  }
});
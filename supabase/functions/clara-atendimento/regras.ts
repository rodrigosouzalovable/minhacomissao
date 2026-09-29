export type DecisaoDeterministica = {
  classificacao: "duvida" | "interesse";
  resposta: string;
  interesse: boolean;
  transferir_humano: false;
  etapa: "conversa" | "agendamento" | "aguardando_documentos";
  contexto: Record<string, unknown>;
};

export const RESPOSTA_VALIDADE = "O certificado digital PJ A1 possui validade de 1 ano.";
export const RESPOSTA_AGENDAMENTO = "Para a emissão do certificado digital, é necessário agendar com você uma videoconferência hoje, que leva apenas três minutos. Podemos realizar o agendamento?";
export const RESPOSTA_DOCUMENTOS = "Para que possamos realizar o agendamento da videoconferência para emissão do seu certificado digital é necessário que nos encaminhe o seu CNPJ seu e-mail e uma CNH que pode ser física ou digital. Consegue nos enviar por gentileza?";

function normalizar(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function perguntaValidade(texto: string) {
  return /\b(qual|quanto|qto|que)\b.*\b(periodo|validade|tempo)\b/.test(texto)
    || /\b(periodo|validade)\b.*\b(certificado|pj|a1)\b/.test(texto)
    || /\bquanto tempo (vale|dura)\b/.test(texto);
}

function perguntaComoProceder(texto: string) {
  return /\bcomo (procedo|faco|funciona|continuo)\b/.test(texto)
    || /\b(qual|quais) (e |sao )?(o )?(proximo passo|proximos passos|procedimento)\b/.test(texto)
    || /\bo que (preciso|devo) fazer\b/.test(texto);
}

function confirmaAgendamento(texto: string) {
  return /^(sim|pode|podemos|vamos|quero|aceito|claro|ok|okay|confirmo|combinado)(\b|$)/.test(texto)
    || /\b(quero|pode) agendar\b/.test(texto)
    || /\bpode ser\b/.test(texto);
}

export function confirmaResponsabilidade(textoOriginal: string) {
  const texto = normalizar(textoOriginal);
  if (/\b(nao|nunca) (sou|fui) (o |a )?responsavel\b/.test(texto)) return false;
  return /\b(sou|eu sou|sim sou) (o |a )?responsavel\b/.test(texto)
    || /\b(responsavel (sou eu|aqui|sim))\b/.test(texto)
    || /\b(sim|confirmo)[, ]+(sou )?(eu|o responsavel|a responsavel)\b/.test(texto);
}

export function decidirFluxoConhecido(
  textoOriginal: string,
  etapaAtual: string,
  contextoAtual: Record<string, unknown>,
): DecisaoDeterministica | null {
  const texto = normalizar(textoOriginal);
  const contexto = { ...contextoAtual };

  if (perguntaValidade(texto)) {
    contexto.validade_informada = true;
    return {
      classificacao: "duvida",
      resposta: RESPOSTA_VALIDADE,
      interesse: false,
      transferir_humano: false,
      etapa: "conversa",
      contexto,
    };
  }

  if (perguntaComoProceder(texto)) {
    contexto.agendamento_oferecido = true;
    return {
      classificacao: "interesse",
      resposta: RESPOSTA_AGENDAMENTO,
      interesse: true,
      transferir_humano: false,
      etapa: "agendamento",
      contexto,
    };
  }

  if ((etapaAtual === "agendamento" || contexto.agendamento_oferecido === true) && confirmaAgendamento(texto)) {
    contexto.agendamento_confirmado = true;
    return {
      classificacao: "interesse",
      resposta: RESPOSTA_DOCUMENTOS,
      interesse: true,
      transferir_humano: false,
      etapa: "aguardando_documentos",
      contexto,
    };
  }

  return null;
}
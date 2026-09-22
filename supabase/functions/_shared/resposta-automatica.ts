export type ClassificacaoRespostaAutomatica = {
  automatica: boolean;
  confianca: number;
  motivo: string;
};

export type TipoRespostaAquecimento =
  | "automatica"
  | "positiva"
  | "negativa"
  | "numero_errado"
  | "optout"
  | "humana_neutra";

const normalizar = (valor: unknown) => String(valor || "")
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/\s+/g, " ")
  .trim();

const SINAIS_FORTES = [
  /mensagem automatica/,
  /resposta automatica/,
  /assistente virtual/,
  /atendimento virtual/,
  /fora do horario de atendimento/,
  /nosso horario de atendimento/,
  /horario de funcionamento/,
  /assim que possivel.*(atender|responder|retornar)/,
  /(equipe|atendente).*(atender|responder|retornar).*em breve/,
  /no momento nao (podemos|posso) atender/,
  /estamos ausentes/,
];

const SINAIS_ATENDIMENTO = [
  /agradece(mos)? (o )?seu contato/,
  /seja bem[- ]?vind[oa]/,
  /como podemos (te )?ajudar/,
  /em que posso (te )?ajudar/,
  /aguarde (um instante|um momento)/,
  /logo (iremos|vamos|vou) (lhe |te )?(atender|responder|retornar)/,
  /em breve (iremos|vamos|vou) (lhe |te )?(atender|responder|retornar)/,
  /para agilizar (o )?seu atendimento/,
  /informe (seu|o seu) nome/,
  /digite [0-9]/,
  /escolha uma (das )?opco(es|ao)/,
];

export function classificarRespostaAutomatica(
  texto: unknown,
  segundosParaResposta?: number | null,
): ClassificacaoRespostaAutomatica {
  const t = normalizar(texto);
  if (!t || t.length < 12) return { automatica: false, confianca: 0, motivo: "texto insuficiente" };

  const fortes = SINAIS_FORTES.filter((padrao) => padrao.test(t)).length;
  const atendimento = SINAIS_ATENDIMENTO.filter((padrao) => padrao.test(t)).length;
  const estruturada = t.length >= 100 || /\n|[•✅➡️📍📞🕐🐾]/u.test(String(texto || ""));
  const rapida = Number.isFinite(segundosParaResposta) && Number(segundosParaResposta) <= 120;

  let confianca = fortes * 55 + atendimento * 25 + (estruturada ? 15 : 0) + (rapida ? 10 : 0);
  confianca = Math.min(100, confianca);

  const automatica = fortes >= 1 || atendimento >= 2 || (atendimento >= 1 && estruturada && rapida);
  const sinais: string[] = [];
  if (fortes) sinais.push("frase explícita de automação/ausência");
  if (atendimento) sinais.push("texto padronizado de atendimento");
  if (estruturada) sinais.push("mensagem estruturada");
  if (rapida) sinais.push("resposta em até 2 minutos");

  return {
    automatica,
    confianca,
    motivo: sinais.join("; ") || "sem sinais suficientes",
  };
}

export function classificarRespostaAquecimento(
  texto: unknown,
  segundosParaResposta?: number | null,
): { tipo: TipoRespostaAquecimento; automatica: ClassificacaoRespostaAutomatica } {
  const automatica = classificarRespostaAutomatica(texto, segundosParaResposta);
  if (automatica.automatica) return { tipo: "automatica", automatica };

  const t = normalizar(texto);
  if (/\b(numero errado|pessoa errada|nao conheco|nao sou|nao e daqui|nao pertence)\b/.test(t)) {
    return { tipo: "numero_errado", automatica };
  }
  if (/\b(pare de mandar|nao mande mais|nao me envie|remova meu numero|retire meu numero|sair|descadastrar|bloquear)\b/.test(t)) {
    return { tipo: "optout", automatica };
  }
  if (/\b(nao tenho interesse|sem interesse|nao quero|agora nao|nao preciso|dispenso|recuso)\b/.test(t)) {
    return { tipo: "negativa", automatica };
  }
  if (/\b(tenho interesse|me interessa|quero saber|pode explicar|mande mais|mais informacoes|como funciona|qual o valor|gostaria)\b/.test(t)) {
    return { tipo: "positiva", automatica };
  }
  return { tipo: "humana_neutra", automatica };
}
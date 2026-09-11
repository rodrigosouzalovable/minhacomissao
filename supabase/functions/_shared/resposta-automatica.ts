export type ClassificacaoRespostaAutomatica = {
  automatica: boolean;
  confianca: number;
  motivo: string;
};

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
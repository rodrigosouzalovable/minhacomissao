/** Caixas de venda B2B: quando parar de responder para não gastar mensagens sem chance de venda. */
export const MAX_RESPOSTAS_SEM_INTERESSE = 4;
export const INTERVALO_MIN_MS = 2 * 60_000;

const PADROES_ROBO = [
  /digite\s*\d/i, /\b(op[cç][aã]o|opcao)\s*\d/i, /^\s*\d\s*[-–.)]\s*\S+/m,
  /assistente\s+virtual/i, /atendente\s+virtual/i, /mensagem\s+autom[aá]tica/i, /resposta\s+autom[aá]tica/i,
  /n[aã]o\s+consigo\s+confirmar/i, /sou\s+(um|uma)\s+(ia|intelig[eê]ncia|rob[oô]|bot)/i,
  /nosso\s+hor[aá]rio\s+de\s+atendimento/i, /em\s+breve\s+(retornaremos|responderemos)/i,
  /agradecemos\s+(o\s+)?(seu\s+)?contato/i, /card[aá]pio/i, /menu\s+principal/i,
];

export function pareceRobo(texto: string, entradasAnteriores: string[] = []): boolean {
  const t = String(texto || '').trim();
  if (!t) return false;
  if (PADROES_ROBO.some((r) => r.test(t))) return true;
  const n = t.toLowerCase().replace(/\s+/g, ' ');
  return n.length >= 20 && entradasAnteriores.some((a) => a.toLowerCase().replace(/\s+/g, ' ') === n);
}

export type MotivoEncerrar = 'robo' | 'sem_progresso' | 'intervalo' | null;

/** Decide antes de chamar a IA. 'intervalo' só pula esta mensagem; os outros encerram a conversa. */
export function decidirParada(p: {
  texto: string; entradasAnteriores: string[]; respostasIago: number; ultimaSaidaMs: number | null;
  agoraMs: number; interessado: boolean; esclarecimentoIdioma?: boolean;
}): MotivoEncerrar {
  if (pareceRobo(p.texto, p.entradasAnteriores)) return 'robo';
  if (!p.interessado && p.respostasIago >= MAX_RESPOSTAS_SEM_INTERESSE) return 'sem_progresso';
  if (!p.esclarecimentoIdioma && p.ultimaSaidaMs && p.agoraMs - p.ultimaSaidaMs < INTERVALO_MIN_MS) return 'intervalo';
  return null;
}

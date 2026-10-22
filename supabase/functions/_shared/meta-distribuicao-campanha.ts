// Distribuição igual por número dentro da campanha.
// GREEN/sem leitura: vence quem enviou menos na campanha.
// YELLOW/RED: só elegíveis enquanto enviaram menos de 30% da média dos saudáveis.
export const TETO_QUALIDADE_BAIXA = 0.3;

export interface CandidatoDistribuicao { id: string; quality: string | null }

export function qualidadeBaixa(q: string | null): boolean {
  const v = String(q || '').toUpperCase();
  return v === 'YELLOW' || v === 'RED';
}

export function escolherPorMenorUso<T extends CandidatoDistribuicao>(
  candidatos: T[], uso: Map<string, number>, excluirId?: string | null, rand: () => number = Math.random,
): T | null {
  const saudaveis = candidatos.filter((c) => !qualidadeBaixa(c.quality));
  const media = saudaveis.length
    ? saudaveis.reduce((s, c) => s + (uso.get(c.id) || 0), 0) / saudaveis.length
    : 0;
  let elegiveis = candidatos.filter((c) => !qualidadeBaixa(c.quality)
    || (saudaveis.length === 0) || (uso.get(c.id) || 0) < Math.max(1, media * TETO_QUALIDADE_BAIXA));
  if (!elegiveis.length) return null;
  if (excluirId && elegiveis.length > 1) elegiveis = elegiveis.filter((c) => c.id !== excluirId);
  const min = Math.min(...elegiveis.map((c) => uso.get(c.id) || 0));
  const empatados = elegiveis.filter((c) => (uso.get(c.id) || 0) === min);
  return empatados[Math.floor(rand() * empatados.length)] || empatados[0];
}

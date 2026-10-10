export const RECUPERACAO_MAX_DIA = 26;
export const RECUPERACAO_MIN_DIA = 13;
export const RECUPERACAO_TETO_BRL = 26.39;

export function metaRecuperacao(value: number): number {
  return Math.min(RECUPERACAO_MAX_DIA, Math.max(1, Math.floor(value)));
}

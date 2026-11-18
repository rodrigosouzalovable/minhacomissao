import { GRADE_POR_CREDOR, type CredorPlanilha } from './gradeCredor';

export interface FaixaDesconto { de: number; ate: number | null; vista: number; parcelado: number }

export const MAX_PADRAO: Record<CredorPlanilha, number> = { novo_mundo: 12, ume: 18 };

/** Grade do credor limitada ao máximo; o máximo sempre entra como última opção. */
export function gradeAte(credor: CredorPlanilha, max: number): number[] {
  const m = Math.max(1, Math.floor(max || 1));
  const g = GRADE_POR_CREDOR[credor].filter((n) => n < m);
  if (m >= 2) g.push(m);
  return g;
}

/** Desconto da faixa onde o valor se encaixa (de <= valor <= ate); senão, o padrão. */
export function descontoPorFaixa(
  valor: number,
  faixas: FaixaDesconto[],
  padrao: { vista: number; parcelado: number },
): { vista: number; parcelado: number } {
  const f = faixas.find((x) => valor >= (x.de || 0) && (x.ate == null || valor <= x.ate));
  return f ? { vista: f.vista, parcelado: f.parcelado } : padrao;
}

export function faixasSobrepostas(faixas: FaixaDesconto[]): boolean {
  const s = [...faixas].sort((a, b) => (a.de || 0) - (b.de || 0));
  for (let i = 1; i < s.length; i++) {
    const ant = s[i - 1];
    if (ant.ate == null || ant.ate >= (s[i].de || 0)) return true;
  }
  return false;
}

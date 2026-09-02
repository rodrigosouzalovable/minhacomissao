import { PARCELA_MINIMA } from '@/lib/parseCobmaisPlanilha';

export type CredorPlanilha = 'novo_mundo' | 'ume';

export const GRADE_POR_CREDOR: Record<CredorPlanilha, number[]> = {
  novo_mundo: [2, 4, 8, 12, 16, 20, 24],
  ume: [2, 4, 8, 10, 12, 18],
};

export const CREDOR_LABEL: Record<CredorPlanilha, string> = {
  novo_mundo: 'Novo Mundo (até 24x)',
  ume: 'UME (até 18x)',
};

const fmtBRL = (n: number) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Monta o texto de parcelamento respeitando a grade do credor e a parcela mínima. */
export function montarParcelamentoTexto(
  base: number,
  grade: number[],
  minima: number = PARCELA_MINIMA,
): string {
  if (!base || base <= 0) return 'Somente à vista';
  const opcoes = grade.filter((n) => base / n >= minima);
  if (opcoes.length === 0) return 'Somente à vista';
  const partes = opcoes.map((n) => `${n}x de R$ ${fmtBRL(base / n)}`);
  if (partes.length === 1) return partes[0];
  return `${partes.slice(0, -1).join(', ')} ou ${partes[partes.length - 1]}`;
}

/** Converte valor de célula (número, "1.234,56", "R$ 1234.56") em número. */
export function parseValorPlanilha(v: any): number {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return v;
  const s = String(v).trim().replace(/\s/g, '').replace(/R\$/gi, '');
  if (s.includes(',')) return Number(s.replace(/\./g, '').replace(',', '.')) || 0;
  return Number(s) || 0;
}

const PREPOSICOES = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'del', 'di']);

/** Retorna apenas o primeiro nome, capitalizado (ex.: "MARIA DAS DORES" -> "Maria"). */
export function primeiroNome(nome: any): string {
  const partes = String(nome ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const escolhida = partes.find((p) => !PREPOSICOES.has(p.toLowerCase())) ?? partes[0] ?? '';
  if (!escolhida) return '';
  return escolhida.charAt(0).toLocaleUpperCase('pt-BR') + escolhida.slice(1).toLocaleLowerCase('pt-BR');
}

/** Normaliza CPF/CNPJ recompondo zeros à esquerda removidos pelo Excel. */
export function normalizarDocumento(v: any): string {
  const d = String(v ?? '').replace(/\D+/g, '');
  if (!d) return '';
  if (d.length <= 11) return d.padStart(11, '0');
  if (d.length <= 14) return d.padStart(14, '0');
  return d;
}

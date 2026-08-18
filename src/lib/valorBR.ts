// Formatação de valores monetários da planilha importada (Envio Meta) e
// split de linhas CSV que preserva a vírgula decimal de valores em reais.

export type FormatoValor = "brl" | "numero" | "raw";

/** Converte "4607.58" | "4.607,58" | "R$ 4607,58" em número. Retorna null se não for numérico. */
export function parseNumeroBR(raw: unknown): number | null {
  let s = String(raw ?? "").trim();
  if (!s) return null;
  s = s.replace(/R\$/gi, "").replace(/\s/g, "");
  if (!/^-?[\d.,]+$/.test(s)) return null;
  const ultimaVirgula = s.lastIndexOf(",");
  const ultimoPonto = s.lastIndexOf(".");
  if (ultimaVirgula >= 0 && ultimaVirgula > ultimoPonto) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (ultimaVirgula >= 0 && ultimoPonto >= 0) {
    s = s.replace(/,/g, "");
  } else if (ultimaVirgula >= 0) {
    // só vírgulas: decimal se tiver 1-2 casas depois da última
    const casas = s.length - ultimaVirgula - 1;
    s = casas > 0 && casas <= 2 ? s.replace(",", ".") : s.replace(/,/g, "");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Formata como "R$ 4.607,58" (brl), "4.607,58" (numero) ou devolve o original (raw). */
export function formatarValorBR(raw: unknown, modo: FormatoValor = "brl"): string {
  const original = String(raw ?? "").trim();
  if (modo === "raw" || !original) return original;
  const n = parseNumeroBR(original);
  if (n == null) return original;
  const fmt = n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return modo === "brl" ? `R$ ${fmt}` : fmt;
}

/** True quando a maioria das amostras parece valor monetário (inclui inteiros como 450). */
export function amostrasParecemValor(samples: unknown[]): boolean {
  const nonEmpty = samples.map((s) => String(s ?? "").trim()).filter(Boolean);
  if (nonEmpty.length === 0) return false;
  const monetarias = nonEmpty.filter((v) => {
    const s = v.replace(/\s/g, "");
    if (/R\$/i.test(v)) return true;
    if (!/^-?[\d.,]+$/.test(s)) return false;
    const n = parseNumeroBR(v);
    if (n == null) return false;
    const digitos = s.replace(/\D/g, "");
    const temDecimal = /[.,]\d+$/.test(s);
    // evita telefones/CPF/CNPJ (10-14 dígitos) quando não há centavos
    if (!temDecimal && digitos.length >= 10) return false;
    if (!temDecimal && digitos.length > 14) return false;
    // evita anos (1900-2100) inteiros de 4 dígitos
    if (!temDecimal && digitos.length === 4 && n >= 1900 && n <= 2100) return false;
    return true;
  });
  return monetarias.length / nonEmpty.length > 0.6;
}


const SENTINELA = "\u0000";

/**
 * Divide uma linha de destinatários por , ; ou TAB, preservando a vírgula
 * decimal de valores em reais (ex.: "R$ 4.607,58" continua uma única célula).
 */
export function splitLinhaEnvio(linha: string): string[] {
  const protegida = String(linha ?? "").replace(/(\d),(\d{1,2})(?!\d)/g, `$1${SENTINELA}$2`);
  return protegida
    .split(/[,;\t]/)
    .map((p) => p.replace(new RegExp(SENTINELA, "g"), ",").trim());
}

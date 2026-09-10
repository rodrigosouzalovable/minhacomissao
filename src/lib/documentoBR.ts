// Formatação de CPF/CNPJ para pré-visualização de importações.

export type FormatoDocumento = "cpf" | "cnpj" | "raw";

function onlyDigits(raw: unknown): string {
  return String(raw ?? "").replace(/\D/g, "");
}

function maskCpf(d: string): string {
  if (d.length !== 11) return d;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`;
}

function maskCnpj(d: string): string {
  if (d.length !== 14) return d;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`;
}

/** Detecta se um número de 11/14 dígitos é CPF ou CNPJ. Fallback para CPF. */
export function detectarTipoDocumento(raw: unknown): "cpf" | "cnpj" {
  const d = onlyDigits(raw);
  if (d.length === 14) return "cnpj";
  return "cpf";
}

/**
 * Formata como CPF (000.000.000-00), CNPJ (00.000.000/0000-00)
 * ou devolve o original (raw).
 * Recompõe zeros à esquerda para CPF (11 dígitos) e CNPJ (14 dígitos).
 */
export function formatarDocumentoBR(
  raw: unknown,
  modo: FormatoDocumento = "cpf",
): string {
  const original = String(raw ?? "").trim();
  if (modo === "raw" || !original) return original;

  let d = onlyDigits(raw);
  if (!d) return original;

  // Excel frequentemente remove zeros à esquerda: recompõe.
  if (modo === "cpf") d = d.padStart(11, "0").slice(-11);
  if (modo === "cnpj") d = d.padStart(14, "0").slice(-14);

  if (modo === "cnpj") return maskCnpj(d);
  return maskCpf(d);
}

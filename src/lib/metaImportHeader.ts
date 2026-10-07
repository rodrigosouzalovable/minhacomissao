const HEADER_LABEL = /^(telefone|celular|whatsapp|whats|fone|phone|tel|numero|numero de telefone|cpf|cnpj|cpf\/cnpj|cpf \/ cnpj|documento|nome|nome completo|cliente|razao social|contato|credor|carteira|saldo|saldo devedor|valor|valor total|atraso|dias|dias de atraso|variavel\s*\d+|\{\{\s*\d+\s*\}\})$/i;

/** Ambiguous rows remain data; users can explicitly mark an uncommon header. */
export function metaFirstRowIsHeader(rows: unknown[][]): boolean {
  const cells = (rows[0] ?? []).map((value) => String(value ?? '').trim()).filter(Boolean);
  if (!cells.length) return false;
  const normalized = cells.map((value) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' '));
  const labels = normalized.filter((value) => HEADER_LABEL.test(value)).length;
  return labels > 0 && labels >= Math.ceil(cells.length / 2) && !cells.some((value) => /^\+?[\d\s().-]{8,}$/.test(value));
}

export function metaImportDataRows<T>(rows: T[][], hasHeader: boolean): T[][] {
  return hasHeader ? rows.slice(1) : rows;
}
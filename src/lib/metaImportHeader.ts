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

/** Explicit numbered headers take precedence over guesses from cell contents. */
export function metaHeaderVariable(value: unknown): string | null {
  const label = String(value ?? '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const match = label.match(/^\{\{\s*([1-9]\d*)\s*\}\}$/) ?? label.match(/^variavel\s*([1-9]\d*)$/i);
  return match?.[1] ?? null;
}

export function metaHeaderMappingIssues(headers: unknown[], mapping: string[], placeholders: string[]): string[] {
  if (!headers.some(value => metaHeaderVariable(value))) return [];
  const issues: string[] = [];
  headers.forEach((value, col) => {
    const key = metaHeaderVariable(value);
    if (!key || mapping[col]?.startsWith('tplvar:')) return;
    issues.push(`Coluna ${col + 1}: cabeçalho {{${key}}} ${placeholders.includes(key) ? 'sem variável definida ou repetido' : 'não existe no template'}. Revise o mapeamento.`);
  });
  for (const key of placeholders) {
    const count = mapping.filter(role => role === `tplvar:${key}`).length;
    if (count !== 1) issues.push(`Variável {{${key}}}: ${count === 0 ? 'selecione uma coluna' : 'selecione apenas uma coluna'}.`);
  }
  return issues;
}
export interface ParcelaDocumento {
  numero_parcela: number;
  data_vencimento: string;
  valor: number;
}

export interface DadosDocumentoAcordo {
  cliente_nome: string | null;
  cliente_cpf: string | null;
  cliente_telefone: string | null;
  valor_total: number | null;
  parcelas: number | null;
  valor_parcela: number | null;
  data_primeiro_pagamento: string | null;
  dias_atraso: number | null;
  empresa?: 'ume_novo_mundo' | 'mundo_da_moda' | 'odres_cred' | null;
  parcelas_detalhadas?: ParcelaDocumento[];
}

export function dataDocumentoISO(value: string): string {
  const match = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{2}|\d{4})$/);
  let iso = value.trim();
  if (match) {
    const year = match[3].length === 2 ? `20${match[3]}` : match[3];
    iso = `${year}-${match[2]}-${match[1]}`;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) throw new Error('Vencimento inválido no documento.');
  const date = new Date(`${iso}T12:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== iso) {
    throw new Error('Vencimento inválido no documento.');
  }
  return iso;
}

export function totalParcelasDocumento(rows: ParcelaDocumento[]): number {
  return rows.reduce((sum, row) => sum + Math.round(row.valor * 100), 0) / 100;
}

export function validarParcelasDocumento(rows: ParcelaDocumento[], total?: number | null): ParcelaDocumento[] {
  if (!rows.length || rows.length > 120) throw new Error('Confira a quantidade de parcelas do documento.');
  const result = rows.map((row, index) => {
    if (!Number.isFinite(row.valor) || row.valor <= 0 || Math.abs(row.valor * 100 - Math.round(row.valor * 100)) > 0.00001) {
      throw new Error(`Valor inválido na parcela ${index + 1}.`);
    }
    return { numero_parcela: index + 1, data_vencimento: dataDocumentoISO(row.data_vencimento), valor: row.valor };
  });
  if (total != null && Math.round(total * 100) !== Math.round(totalParcelasDocumento(result) * 100)) {
    throw new Error('A soma das parcelas não confere com o total negociado do documento.');
  }
  return result;
}

/** Um comprovante não autoriza usar o telefone do suporte nem inferir atraso/credor. */
export function normalizarDocumentoAcordo(data: DadosDocumentoAcordo): DadosDocumentoAcordo {
  const rows = data.parcelas_detalhadas?.length
    ? validarParcelasDocumento(data.parcelas_detalhadas, data.valor_total)
    : undefined;
  const cpf = data.cliente_cpf?.replace(/\D/g, '') || null;
  if (cpf && cpf.length !== 11) throw new Error('CPF incompleto no documento. Confira o arquivo.');
  return {
    ...data,
    cliente_cpf: cpf,
    cliente_telefone: null,
    dias_atraso: null,
    empresa: null,
    ...(rows ? {
      parcelas_detalhadas: rows,
      parcelas: rows.length,
      valor_total: totalParcelasDocumento(rows),
      valor_parcela: rows[0]?.valor ?? null,
      data_primeiro_pagamento: rows[0]?.data_vencimento ?? null,
    } : {}),
  };
}

export function parseComprovanteAcordo(text: string): DadosDocumentoAcordo {
  const source = text.replace(/\u00a0/g, ' ').replace(/\r/g, '');
  const name = source.match(/Cliente\s*:\s*([^\n]+?)(?=\s+CPF\s*:|\n|$)/i)?.[1]?.trim();
  const cpf = source.match(/CPF\s*:\s*([\d.\-]+)/i)?.[1]?.replace(/\D/g, '');
  const section = source.match(/PARCELAS[\s\S]*?(?=Valor da D[ií]vida|Desconto\s*:|Total parcelas\s*:|$)/i)?.[0];
  if (!name || !cpf || !section) {
    throw new Error('Não foi possível reconhecer este comprovante. Envie um print legível ou preencha manualmente.');
  }
  const rows: ParcelaDocumento[] = [];
  const pattern = /(\d{2}\/\d{2}\/(?:\d{4}|\d{2}))\s*\|?\s*([^\n]*?)\s*\|?\s*R\$\s*([\d.]+,\d{2})/gi;
  for (const match of section.matchAll(pattern)) {
    rows.push({ numero_parcela: rows.length + 1, data_vencimento: match[1], valor: Number(match[3].replace(/\./g, '').replace(',', '.')) });
  }
  const totalMatch = source.match(/Total parcelas\s*:\s*R\$\s*([\d.]+,\d{2})/i);
  if (!totalMatch || !rows.length) throw new Error('Tabela de parcelas incompleta. Envie um print legível ou preencha manualmente.');
  const total = Number(totalMatch[1].replace(/\./g, '').replace(',', '.'));
  return normalizarDocumentoAcordo({
    cliente_nome: name, cliente_cpf: cpf, cliente_telefone: null,
    valor_total: total, parcelas: rows.length, valor_parcela: rows[0]?.valor ?? null,
    data_primeiro_pagamento: rows[0]?.data_vencimento ?? null,
    dias_atraso: null, empresa: null, parcelas_detalhadas: rows,
  });
}

export function pagamentosDocumento(rows: ParcelaDocumento[], percentual: number) {
  return validarParcelasDocumento(rows).map(row => ({
    numero_parcela: row.numero_parcela,
    data_prevista: row.data_vencimento,
    valor_parcela: row.valor,
    comissao_parcela: Math.round(row.valor * percentual) / 100,
    status: 'pendente' as const,
  }));
}
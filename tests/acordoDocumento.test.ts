import { describe, expect, test } from 'bun:test';
import { dataDocumentoISO, normalizarDocumentoAcordo, pagamentosDocumento, parseComprovanteAcordo, validarParcelasDocumento } from '../src/lib/acordoDocumento';

const dates = ['09/10/26', '09/11/26', '09/12/26', '09/01/27', '09/02/27', '09/03/27', '09/04/27', '09/05/27', '09/06/27', '09/07/27', '09/08/27', '09/09/27'];
const text = `COMPROVANTE DE ACORDO
Cliente: Weriky Jose Soares dos Santos
CPF: 437.307.008-39
PARCELAS
DATA | LINHA DIGITAVEL | VALOR
${dates.map(date => `${date} | 1234567890 | R$ 101,29`).join('\n')}
Valor da Dívida: R$ 4.298,69
Desconto: R$ 3.083,21
Total parcelas: R$ 1.215,48
Contato: (11) 4020-4045`;

describe('Comprovantes Novo Acordo', () => {
  test('cliente e CPF do comprovante', () => {
    const result = parseComprovanteAcordo(text);
    expect(result.cliente_nome).toBe('Weriky Jose Soares dos Santos');
    expect(result.cliente_cpf).toBe('43730700839');
    expect(parseComprovanteAcordo(text.replace('Jose Soares', 'Jose   Soares')).cliente_nome).toBe('Weriky Jose Soares dos Santos');
  });
  test('total negociado é 12x101,29, nunca o saldo antes do desconto', () => {
    const result = parseComprovanteAcordo(text);
    expect(result.valor_total).toBe(1215.48);
    expect(result.parcelas).toBe(12);
    expect(result.parcelas_detalhadas?.every(row => row.valor === 101.29)).toBe(true);
  });
  test('telefone do suporte nunca preenche o cliente', () => {
    expect(parseComprovanteAcordo(text).cliente_telefone).toBeNull();
  });
  test('dias de atraso permanecem manuais', () => {
    expect(normalizarDocumentoAcordo({ ...parseComprovanteAcordo(text), dias_atraso: 300 }).dias_atraso).toBeNull();
  });
  test('credor não é inferido do documento', () => {
    expect(normalizarDocumentoAcordo({ ...parseComprovanteAcordo(text), empresa: 'mundo_da_moda' }).empresa).toBeNull();
  });
  test('datas abreviadas preservam dia e mudança de ano', () => {
    const rows = parseComprovanteAcordo(text).parcelas_detalhadas;
    expect(rows?.[0]?.data_vencimento).toBe('2026-10-09');
    expect(rows?.[3]?.data_vencimento).toBe('2027-01-09');
    expect(rows?.[11]?.data_vencimento).toBe('2027-09-09');
    expect(dataDocumentoISO('09/01/2027')).toBe('2027-01-09');
  });
  test('pagamentos usam cada valor/data e a comissão atual sem uniformizar parcelas', () => {
    const rows = [{ numero_parcela: 1, data_vencimento: '2026-10-09', valor: 100 }, { numero_parcela: 2, data_vencimento: '2026-11-11', valor: 111.29 }];
    const result = pagamentosDocumento(rows, 3);
    expect(result.map(row => [row.data_prevista, row.valor_parcela, row.comissao_parcela])).toEqual([['2026-10-09', 100, 3], ['2026-11-11', 111.29, 3.34]]);
    expect(result.every(row => row.status === 'pendente')).toBe(true);
  });
  test('soma divergente importa todas as parcelas para correção manual', () => {
    const result = parseComprovanteAcordo(text.replace('1.215,48', '1.315,49'));
    expect(result.valor_total).toBe(1215.48);
    expect(result.valor_total_documento).toBe(1315.49);
    expect(result.divergencia_valor_documento).toBe(true);
    expect(result.parcelas_detalhadas).toHaveLength(12);
    expect(result.parcelas_detalhadas?.[0]?.valor).toBe(101.29);
    expect(normalizarDocumentoAcordo(result).divergencia_valor_documento).toBe(true);
    expect(pagamentosDocumento(result.parcelas_detalhadas ?? [], 3)).toHaveLength(12);
  });
  test('documento sem divergência não gera aviso', () => {
    expect(parseComprovanteAcordo(text).divergencia_valor_documento).toBe(false);
  });
  test('datas inexistentes, tabela vazia, CPF inválido e valores inválidos não importam', () => {
    expect(() => dataDocumentoISO('31/02/27')).toThrow();
    expect(() => validarParcelasDocumento([])).toThrow();
    expect(() => parseComprovanteAcordo(text.replace('437.307.008-39', '123'))).toThrow('CPF');
    for (const valor of [0, -1, NaN, 1.001]) {
      expect(() => validarParcelasDocumento([{ numero_parcela: 1, data_vencimento: '2027-01-09', valor }])).toThrow('Valor');
    }
    expect(() => parseComprovanteAcordo('documento desconhecido')).toThrow();
  });
});
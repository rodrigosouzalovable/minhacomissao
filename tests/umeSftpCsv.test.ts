import { describe, expect, it } from 'vitest';
import { lerArquivoSftp } from '../src/lib/umeSftpCsv';

const arquivo = [
  '00;14/10/2026;201845262',
  '01;10420511;1;24111562272;CINTIA;;14/04/1968;;;;;;;;;',
  '06;10420511;24111562272;1439051;4238703;25/02/2025;1.93;',
  '08;863047;66974593287;;17/08/2026;228.93;669286542;1722017;18/08/2026;228.93;1;',
  '22;11040806;70374907250;703318334;840179;2448716;28/09/2024;164.82;;;;;164.82;;',
  '99;5',
].join('\n');

describe('arquivo SFTP UME', () => {
  it('lê data do lote e somente as baixas 08 e 22', () => {
    const r = lerArquivoSftp(arquivo);
    expect(r.dataLote).toBe('2026-10-14');
    expect(r.totalLinhas).toBe(6);
    expect(r.baixas).toHaveLength(2);
  });
  it('pagamento 08 traz data e valor pagos', () => {
    const b = lerArquivoSftp(arquivo).baixas[0];
    expect(b).toMatchObject({ cpf: '66974593287', vencimento: '2026-08-17', data_pagamento: '2026-08-18', valor_pago: 228.93 });
  });
  it('baixa 22 traz vencimento e valor pago', () => {
    const b = lerArquivoSftp(arquivo).baixas[1];
    expect(b).toMatchObject({ cpf: '70374907250', vencimento: '2024-09-28', valor_pago: 164.82 });
  });
  it('cliente 01 liga CPF ao borrowerId', () => {
    expect(lerArquivoSftp(arquivo).clientes).toEqual([{ cpf: '24111562272', borrower_id: '10420511', nome: 'CINTIA' }]);
  });
  it('parcela 06 traz installmentId como texto', () => {
    expect(lerArquivoSftp(arquivo).parcelas[0]).toMatchObject({ installment_id: '4238703', borrower_id: '10420511', contrato: '1439051', vencimento: '2025-02-25', valor: 1.93 });
  });
});

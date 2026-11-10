import { describe, expect, it } from 'vitest';
import { lerArquivoSftp } from './umeSftpCsv';

// Linha real do arquivo Odres de 10/11/2026: pago em 09/11/2026 a parcela que vence em 12/02/2027.
const arquivo = [
  '00;10/11/2026;ODRES',
  '08;15297521;50258679832;3372454;09/11/2026;117.98;502316994;1937543;12/02/2027;117.98;1;',
  '08;15246159;62154676340;2237580;01/10/2026;234.08;621188133;1009061;13/07/2026;223.6;1;',
].join('\n');

describe('leitura do registro 08 (pagamento) do SFTP', () => {
  it('usa a 5ª coluna como data do pagamento e a 9ª como vencimento', () => {
    const [b] = lerArquivoSftp(arquivo).baixas;
    expect(b.data_pagamento).toBe('2026-11-09');
    expect(b.vencimento).toBe('2027-02-12');
  });
  it('separa valor pago (com juros) do valor da parcela', () => {
    const b = lerArquivoSftp(arquivo).baixas[1];
    expect(b.valor_pago).toBe(234.08);
    expect(b.valor).toBe(223.6);
  });
});

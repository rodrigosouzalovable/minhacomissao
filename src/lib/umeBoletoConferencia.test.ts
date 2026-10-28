import { describe, expect, it } from 'vitest';
import { conferirBoletoUme } from './umeBoletoConferencia';

const esp = { valorParcela: 180.4, vencimento: '2026-10-28' };
describe('conferirBoletoUme', () => {
  it('bloqueia boleto de R$ 60,14 para parcela de R$ 180,40', () => {
    expect(conferirBoletoUme({ valor: 60.14, vencimento: '2026-10-28' }, esp)).not.toBeNull();
  });
  it('aceita diferença de até R$ 1', () => {
    expect(conferirBoletoUme({ valor: 181.4, vencimento: '2026-10-28' }, esp)).toBeNull();
  });
  it('bloqueia vencimento diferente', () => {
    expect(conferirBoletoUme({ valor: 180.4, vencimento: '2026-10-29' }, esp)).not.toBeNull();
  });
});

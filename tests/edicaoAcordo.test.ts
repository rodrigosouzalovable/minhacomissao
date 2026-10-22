import { describe, expect, it } from 'vitest';
import { ajustarNovas, parcelasRemovidas, quantidadeMinima, totalEditado } from '../src/lib/edicaoAcordo';

const parcelas = [
  { numero_parcela: 1, status: 'pago', valor_parcela: 100, data_prevista: '2026-10-10' },
  { numero_parcela: 2, status: 'pago', valor_parcela: 100, data_prevista: '2026-11-10' },
  { numero_parcela: 3, status: 'pendente', valor_parcela: 100, data_prevista: '2026-12-10' },
  { numero_parcela: 4, status: 'pendente', valor_parcela: 100, data_prevista: '2027-01-10' },
];

describe('edição do próprio acordo', () => {
  it('quantidade mínima é o número de parcelas pagas', () => {
    expect(quantidadeMinima(parcelas)).toBe(2);
  });
  it('ao diminuir, remove só pendentes do fim', () => {
    expect(parcelasRemovidas(parcelas, 2)).toEqual([4, 3]);
  });
  it('ao aumentar, cria parcelas mensais a partir da última', () => {
    expect(ajustarNovas(parcelas, 6, [])).toEqual([
      { valor: '100', data: '2027-02-10' }, { valor: '100', data: '2027-03-10' },
    ]);
  });
  it('total é a soma das parcelas finais', () => {
    expect(totalEditado(parcelas, 3, [])).toBe(300);
    expect(totalEditado(parcelas, 5, [{ valor: '50', data: '2027-02-10' }])).toBe(450);
  });
});

import { describe, expect, test } from 'bun:test';
import { estenderParcelasUme } from './umePropostaModelo';

describe('tabela UME até 18x', () => {
  const base = Array.from({ length: 11 }, (_, i) => ({ parcelas: i + 1, valorParcela: 1 }));
  test('Desconto Especial (4x+ = 2.986) vai até 18x de 166', () => {
    const r = estenderParcelasUme(base, 2986);
    expect(r.length).toBe(18);
    expect(r.find((p) => p.parcelas === 12)?.valorParcela).toBe(249);
    expect(r.find((p) => p.parcelas === 18)?.valorParcela).toBe(166);
  });
  test('mantém valores vindos da UME até 11x', () => {
    expect(estenderParcelasUme(base, 2986).find((p) => p.parcelas === 11)?.valorParcela).toBe(1);
  });
  test('Padrão (4x+ = 3.411) 18x de 190', () => {
    expect(estenderParcelasUme(base, 3411).find((p) => p.parcelas === 18)?.valorParcela).toBe(190);
  });
});

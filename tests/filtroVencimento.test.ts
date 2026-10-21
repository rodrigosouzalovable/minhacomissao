import { describe, it, expect } from 'vitest';
import { vencimentoNoIntervalo } from '../src/lib/filtroVencimento';

describe('filtro de vencimento por intervalo', () => {
  it('inclui parcela dentro do intervalo', () => {
    expect(vencimentoNoIntervalo(['2026-10-15'], '2026-10-01', '2026-10-31')).toBe(true);
  });
  it('inclui as datas de início e fim', () => {
    expect(vencimentoNoIntervalo(['2026-10-01'], '2026-10-01', '2026-10-31')).toBe(true);
    expect(vencimentoNoIntervalo(['2026-10-31'], '2026-10-01', '2026-10-31')).toBe(true);
  });
  it('exclui parcelas fora do intervalo', () => {
    expect(vencimentoNoIntervalo(['2026-09-30', '2026-11-01'], '2026-10-01', '2026-10-31')).toBe(false);
  });
  it('só início filtra apenas aquele dia', () => {
    expect(vencimentoNoIntervalo(['2026-10-02'], '2026-10-01')).toBe(false);
    expect(vencimentoNoIntervalo(['2026-10-01'], '2026-10-01')).toBe(true);
  });
});

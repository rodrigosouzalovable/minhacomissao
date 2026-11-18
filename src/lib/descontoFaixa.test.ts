import { describe, it, expect } from 'vitest';
import { gradeAte, descontoPorFaixa, faixasSobrepostas } from './descontoFaixa';

const faixas = [
  { de: 0, ate: 500, vista: 60, parcelado: 40 },
  { de: 500.01, ate: null, vista: 50, parcelado: 30 },
];
const padrao = { vista: 10, parcelado: 5 };

describe('descontoFaixa', () => {
  it('Novo Mundo limitado a 12x', () => expect(gradeAte('novo_mundo', 12)).toEqual([2, 4, 8, 12]));
  it('máximo fora da grade entra como última opção', () => expect(gradeAte('novo_mundo', 10)).toEqual([2, 4, 8, 10]));
  it('abaixo de 500 usa primeira faixa', () => expect(descontoPorFaixa(499, faixas, padrao)).toEqual({ vista: 60, parcelado: 40 }));
  it('500 exato fica na primeira faixa', () => expect(descontoPorFaixa(500, faixas, padrao).vista).toBe(60));
  it('acima de 500 usa faixa sem limite', () => expect(descontoPorFaixa(9000, faixas, padrao).vista).toBe(50));
  it('sem faixa usa padrão', () => expect(descontoPorFaixa(100, [{ de: 200, ate: 300, vista: 1, parcelado: 1 }], padrao)).toEqual(padrao));
  it('detecta sobreposição', () => expect(faixasSobrepostas([{ de: 0, ate: 600, vista: 1, parcelado: 1 }, ...faixas.slice(1)])).toBe(true));
  it('faixas válidas não sobrepõem', () => expect(faixasSobrepostas(faixas)).toBe(false));
});

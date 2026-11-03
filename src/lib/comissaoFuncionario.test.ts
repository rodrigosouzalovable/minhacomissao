import { describe, it, expect } from 'vitest';
import { calcularPercentualComissaoFuncionario as p } from './comissao';

describe('comissão funcionário a partir de 01/11/2026', () => {
  it('1-90 dias = 2%', () => { expect(p(90, '2026-11-05')).toBe(2); });
  it('91-360 dias = 4%', () => { expect(p(91, '2026-11-05')).toBe(4); expect(p(360, '2026-11-05')).toBe(4); });
  it('361+ dias = 7%', () => { expect(p(361, '2026-11-05')).toBe(7); expect(p(2000, '2026-11-05')).toBe(7); });
  it('outubro mantém tabela anterior', () => { expect(p(181, '2026-10-20')).toBe(5); });
});

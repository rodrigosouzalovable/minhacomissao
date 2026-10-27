import { describe, it, expect } from 'vitest';
import { traduzirErroUme } from '../../supabase/functions/_shared/ume-erros.ts';

describe('traduzirErroUme', () => {
  it('parcela paga em renegociação anterior', () => {
    expect(traduzirErroUme('Installment 8441643 was paid in previous renegotiation 208474.'))
      .toContain('A parcela 8441643 já foi paga no acordo anterior 208474');
  });
  it('juros acima do limite', () => {
    expect(traduzirErroUme('Interest rate 999% is above maximum = 8%.')).toContain('máximo permitido pela UME (8%)');
  });
  it('erro desconhecido', () => {
    expect(traduzirErroUme('xyz')).toContain('motivo não identificado');
  });
});

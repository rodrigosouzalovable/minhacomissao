import { describe, it, expect } from 'vitest';
import { traduzirErroUme } from '../../supabase/functions/_shared/ume-erros';

describe('traduzirErroUme', () => {
  it('número com 403 no meio não vira acesso negado', () => {
    expect(traduzirErroUme('Borrower 14034012 has no eligible installments')).not.toMatch(/acesso à UME foi negado/);
  });
  it('status 401 real vira acesso negado', () => {
    expect(traduzirErroUme('erro 401', 'o acordo', 401)).toMatch(/acesso à UME foi negado/);
  });
  it('parcela paga em acordo anterior continua reconhecida', () => {
    expect(traduzirErroUme('installment 8840312 was paid in previous renegotiation 403')).toMatch(/já foi paga/);
  });
});

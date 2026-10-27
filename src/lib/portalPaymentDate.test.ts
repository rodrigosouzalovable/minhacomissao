import { describe, expect, it } from 'vitest';
import { portalMaxPaymentDate, portalPaymentDateValid } from './portalNegotiation';

describe('vencimento da entrada no portal (D+0/D+1)', () => {
  it('permite hoje e amanhã', () => {
    expect(portalPaymentDateValid('2026-10-27', '2026-10-27')).toBe(true);
    expect(portalPaymentDateValid('2026-10-28', '2026-10-27')).toBe(true);
  });
  it('recusa D+2', () => {
    expect(portalPaymentDateValid('2026-10-29', '2026-10-27')).toBe(false);
  });
  it('sábado pula domingo e vai para segunda', () => {
    expect(portalMaxPaymentDate('2026-10-31')).toBe('2026-11-02');
  });
});

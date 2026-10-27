import { describe, expect, it } from 'vitest';
import { portalFifthBusinessDay, portalMaxPaymentDate, portalNextPaymentDate, portalPaymentDateValid } from './portalNegotiation';

describe('vencimento da entrada no portal (até 10 dias)', () => {
  it('permite de hoje até D+10', () => {
    expect(portalPaymentDateValid('2026-10-27', '2026-10-27')).toBe(true);
    expect(portalPaymentDateValid('2026-11-06', '2026-10-27')).toBe(true);
  });
  it('recusa D+11 e datas passadas', () => {
    expect(portalPaymentDateValid('2026-11-07', '2026-10-27')).toBe(false);
    expect(portalPaymentDateValid('2026-10-26', '2026-10-27')).toBe(false);
  });
  it('limite é hoje + 10 dias', () => {
    expect(portalMaxPaymentDate('2026-10-27')).toBe('2026-11-06');
  });
  it('amanhã de sábado vira segunda', () => {
    expect(portalNextPaymentDate('2026-10-31')).toBe('2026-11-02');
  });
  it('5º dia útil de novembro aparece só se couber nos 10 dias', () => {
    expect(portalFifthBusinessDay('2026-10-27')).toBe('2026-11-06');
    expect(portalFifthBusinessDay('2026-10-20')).toBeNull();
  });
});

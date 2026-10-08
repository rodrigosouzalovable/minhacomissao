import { describe, expect, it } from 'bun:test';
import { recoveryAverages } from '../src/lib/metaRecoveryMetrics';

describe('observed recovery averages', () => {
  it('counts accepted sends across the complete cycle, not a required sending dose', () => {
    const result = recoveryAverages([{ primeiro_envio_recuperacao_em: '2026-10-08T11:00:00Z', voltou_green_em: '2026-10-10T11:00:00Z', envios_recuperacao_aceitos: 30 }]);
    expect(result).toEqual({ count: 1, duration: 172800000, accepted: 30, daily: 15 });
  });
  it('does not invent an average before GREEN or without accepted sends', () => {
    expect(recoveryAverages([{ primeiro_envio_recuperacao_em: null, voltou_green_em: null, envios_recuperacao_aceitos: 0 }])).toEqual({ count: 0, duration: null, accepted: null, daily: null });
  });
  it('excludes invalid dates and floors the denominator at one day', () => {
    expect(recoveryAverages([{ primeiro_envio_recuperacao_em: '2026-10-08T11:00:00Z', voltou_green_em: '2026-10-08T12:00:00Z', envios_recuperacao_aceitos: 4 }, { primeiro_envio_recuperacao_em: 'invalid', voltou_green_em: '2026-10-08T12:00:00Z', envios_recuperacao_aceitos: 50 }]).daily).toBe(4);
  });
});
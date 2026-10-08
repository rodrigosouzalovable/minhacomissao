import { describe, expect, it } from 'bun:test';
import { recoveryAverages, recoveryTimingSummary } from '../src/lib/metaRecoveryMetrics';

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

describe('separate recovery clocks', () => {
  const cycle = { caiu_em: '2026-10-08T11:00:00Z', primeiro_envio_recuperacao_em: '2026-10-08T13:00:00Z', voltou_green_em: '2026-10-08T17:00:00Z', envios_recuperacao_aceitos: 3, precisao: 'exata' };
  it('measures six hours from the drop separately from four hours after the first send', () => {
    const result = recoveryTimingSummary([cycle]);
    expect(result.fromDrop).toEqual({ count: 1, mean: 21600000, median: 21600000 });
    expect(result.fromFirstSend).toEqual({ count: 1, mean: 14400000, median: 14400000 });
  });
  it('includes recovery without sends only in the drop clock', () => {
    const result = recoveryTimingSummary([{ ...cycle, primeiro_envio_recuperacao_em: null, envios_recuperacao_aceitos: 0 }]);
    expect(result.fromDrop.count).toBe(1);
    expect(result.fromFirstSend).toEqual({ count: 0, mean: null, median: null });
  });
  it('excludes partial history and open cycles from both clocks', () => {
    const result = recoveryTimingSummary([{ ...cycle, precisao: 'historico_parcial' }, { ...cycle, voltou_green_em: null }]);
    expect(result.fromDrop.count).toBe(0);
    expect(result.fromFirstSend.count).toBe(0);
  });
  it('excludes invalid and negative durations independently', () => {
    const result = recoveryTimingSummary([{ ...cycle, caiu_em: 'invalid' }, { ...cycle, caiu_em: '2026-10-09T11:00:00Z', primeiro_envio_recuperacao_em: '2026-10-09T13:00:00Z' }]);
    expect(result.fromDrop.count).toBe(0);
    expect(result.fromFirstSend.count).toBe(1);
  });
  it('calculates mean and median with each clocks own sample', () => {
    const result = recoveryTimingSummary([cycle, { ...cycle, caiu_em: '2026-10-08T09:00:00Z', primeiro_envio_recuperacao_em: null, envios_recuperacao_aceitos: 0 }]);
    expect(result.fromDrop).toEqual({ count: 2, mean: 25200000, median: 25200000 });
    expect(result.fromFirstSend).toEqual({ count: 1, mean: 14400000, median: 14400000 });
  });
});

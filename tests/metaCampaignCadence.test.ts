import { describe, expect, it } from 'bun:test';
import { remainingDelay, retryDelay } from '../supabase/functions/_shared/meta-campaign-cadence';
describe('Intervalo global da campanha', () => {
  it('um segundo é contado entre inícios, descontando processamento', () => {
    expect(remainingDelay(10000, 1000, 10250)).toBe(750);
    expect(remainingDelay(10000, 1000, 11500)).toBe(0);
  });
  it('não usa intervalo menor que um segundo nem compensa com rajada', () => {
    expect(remainingDelay(10000, 0, 10000)).toBe(1000);
    expect(remainingDelay(20000, 1000, 20000)).toBe(1000);
  });
  it('cumpre o prazo informado pelo serviço sem reduzir', () => {
    expect(retryDelay({ retry_after_ms: 6656 })).toBe(6656);
    expect(retryDelay({ retry_after_ms: 400000 })).toBe(400000);
  });
  it('entende o erro observado e espera conservadora sem prazo', () => {
    expect(retryDelay({ error: 'RateLimitError: Retry after 6656ms.' })).toBe(6656);
    expect(retryDelay({ error: 'Retry after 15sec' })).toBe(15000);
    expect(retryDelay({ error: 'rate limit' })).toBe(30000);
  });
});
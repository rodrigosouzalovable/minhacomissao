import { describe, expect, test } from 'bun:test';
import { summarizeBmQuotas, type BmQuotaInstance } from '../src/lib/metaBmQuotaSummary';

const quota = (id: string, tier = 250, count = 1, unlimited = false) => ({
  bm_id: id, nome: id, tier_diario: tier, tier_ilimitado: unlimited,
  enviados_24h: 10, restantes: tier - 10, instancias: count,
});
const instance = (bm: string, patch: Partial<BmQuotaInstance> = {}): BmQuotaInstance => ({
  meta_bm_id: bm, business_id: `business-${bm}`, waba_id: `waba-${bm}`,
  phone_number_id: `phone-${bm}`, ativo: true, saude_status: 'CONNECTED', ...patch,
});
const health = (type: string, id: string, code = 141014) => ({ phone_health: { entities: [
  { entity_type: type, id, can_send_message: 'BLOCKED', errors: [{ error_code: code, error_description: 'The account is banned.' }] },
] } });
describe('BM quota presentation excludes confirmed bans', () => {
  test('removes exactly 250 from 62500 and recalculates all summary fields', () => {
    expect(summarizeBmQuotas([quota('a', 62250), quota('b')], [instance('a'), instance('b', { saude_status: 'BANNED' })], [])).toEqual({
      quantidade: 1, ilimitadas: 0, limite: 62250, usados: 10, restantes: 62240,
    });
  });
  test('counts each BM once even with multiple active numbers', () => {
    expect(summarizeBmQuotas([quota('a', 250, 2)], [instance('a'), instance('a')], []).limite).toBe(250);
  });
  test('partial phone ban preserves the BM quota', () => {
    expect(summarizeBmQuotas([quota('a', 250, 2)], [instance('a', { saude_status: 'BANNED' }), instance('a')], []).limite).toBe(250);
  });
  test('total ban removes the BM', () => {
    expect(summarizeBmQuotas([quota('a', 250, 2)], [instance('a', { saude_status: 'BANNED' }), instance('a', { saude_status: 'BANNED' })], []).quantidade).toBe(0);
  });
  test('confirmed WABA ban excludes stale siblings in that same WABA', () => {
    expect(summarizeBmQuotas([quota('a', 250, 2)], [instance('a', { saude_restricoes: health('WABA', 'waba-a') }), instance('a')], []).limite).toBe(0);
  });
  test('another unbanned WABA preserves the BM quota', () => {
    expect(summarizeBmQuotas([quota('a', 250, 2)], [instance('a', { saude_restricoes: health('WABA', 'waba-a') }), instance('a', { waba_id: 'other' })], []).limite).toBe(250);
  });
  test('matching BUSINESS ban removes even otherwise connected numbers', () => {
    expect(summarizeBmQuotas([quota('a')], [instance('a', { saude_restricoes: health('BUSINESS', 'business-a', 1) })], []).limite).toBe(0);
  });
  test('unrelated BUSINESS and WABA warnings never remove the BM', () => {
    for (const type of ['BUSINESS', 'WABA']) {
      expect(summarizeBmQuotas([quota('a')], [instance('a', { saude_restricoes: health(type, 'unrelated') })], []).limite).toBe(250);
    }
  });
  test('RED YELLOW LIMITED and inconclusive health do not imply ban', () => {
    for (const status of ['RED', 'YELLOW', 'LIMITED', 'UNKNOWN']) {
      expect(summarizeBmQuotas([quota('a')], [instance('a', { saude_status: status, saude_restricoes: null })], []).limite).toBe(250);
    }
  });
  test('banned unlimited BM no longer makes the summary unlimited', () => {
    expect(summarizeBmQuotas([quota('a', 999999, 1, true)], [instance('a', { saude_status: 'BANNED' })], []).ilimitadas).toBe(0);
  });
  test('restores quota after confirmed updated state clears the ban', () => {
    const quotas = [quota('a')];
    expect(summarizeBmQuotas(quotas, [instance('a', { saude_status: 'BANNED' })], []).limite).toBe(0);
    expect(summarizeBmQuotas(quotas, [instance('a')], []).limite).toBe(250);
  });
  test('incomplete authorized list is not evidence of total ban', () => {
    expect(summarizeBmQuotas([quota('a', 250, 2)], [instance('a', { saude_status: 'BANNED' })], []).limite).toBe(250);
  });
  test('WABA ban_info removes the quota without status BANNED', () => {
    expect(summarizeBmQuotas([quota('a')], [instance('a', { saude_ban_info: { state: 'banned' } })], []).limite).toBe(0);
  });
});
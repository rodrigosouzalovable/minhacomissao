import { expect, test } from 'bun:test';
import { templateIntervalSeconds, claimTemplatePacing, finishTemplatePacing, deferTemplate } from '../supabase/functions/_shared/meta-template-pacing';

test('template interval includes exactly the chosen 120 and 300 second bounds', () => {
  expect(templateIntervalSeconds(() => 0)).toBe(120);
  expect(templateIntervalSeconds(() => 0.999999)).toBe(300);
  expect(templateIntervalSeconds(() => 0.5)).toBe(210);
});
test('every submission asks the shared atomic admission and preserves deferral time', async () => {
  const calls: unknown[] = [];
  const db = { rpc: async (name: string, args: unknown) => {
    calls.push([name, args]);
    return { data: { allowed: false, next_allowed_at: '2026-10-11T03:04:00Z' }, error: null };
  } };
  expect(await claimTemplatePacing(db, 'number', 'chosen')).toEqual({ allowed: false, next_allowed_at: '2026-10-11T03:04:00Z' });
  expect(calls).toEqual([['claim_meta_template_pacing', { p_instancia_id: 'number', p_mestre_id: 'chosen' }]]);
});
test('unavailable atomic reservation fails closed', async () => {
  await expect(claimTemplatePacing({ rpc: async () => ({ data: null, error: new Error('offline') }) }, 'i', 'm')).rejects.toThrow('offline');
});
test('completion releases only its own lease token', async () => {
  const calls: unknown[] = [];
  await finishTemplatePacing({ rpc: async (name: string, args: unknown) => { calls.push([name, args]); return { error: null }; } }, 'own-token');
  expect(calls).toEqual([['finish_meta_template_pacing', { p_token: 'own-token' }]]);
});
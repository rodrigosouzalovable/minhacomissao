import { expect, test } from 'bun:test';
import { applyManualTemplate } from '../src/lib/metaManualTemplateApplication';
import { queueRecoveryDecision } from '../supabase/functions/_shared/meta-template-queue-recovery';

test('75 selected instances are all submitted in bounded batches using only the selected master', async () => {
  const calls: Array<{ mestre_id: string; instancia_ids: string[] }> = [];
  const ids = Array.from({ length: 75 }, (_, i) => String(i));
  const results = await applyManualTemplate('chosen', ids, async body => {
    calls.push(body); return { success: true, instancias: body.instancia_ids.map(id => ({ id })) };
  }, async () => {}, () => {});
  expect(calls).toHaveLength(15);
  expect(calls.flatMap(c => c.instancia_ids)).toEqual(ids);
  expect(calls.every(c => c.mestre_id === 'chosen' && c.instancia_ids.length <= 5)).toBe(true);
  expect(results.filter(r => r.status === 'ENVIADO')).toHaveLength(75);
});
test('a failed batch never prevents the remaining instances from being considered', async () => {
  let calls = 0;
  const results = await applyManualTemplate('m', Array.from({ length: 11 }, (_, i) => String(i)), async body => {
    if (++calls === 1) throw new Error('failed read');
    return { success: true, instancias: body.instancia_ids.map(id => ({ id })) };
  }, async () => {}, () => {});
  expect(calls).toBe(3);
  expect(results.filter(r => r.status === 'FALHA_ENVIO')).toHaveLength(5);
  expect(results.filter(r => r.status === 'ENVIADO')).toHaveLength(6);
});
test('tier deferrals enter the existing queue and existing submissions are not deferred again', async () => {
  let queued: string[] = [];
  const results = await applyManualTemplate('m', ['a', 'b'], async () => ({ success: true, adiadas: [{ instancia_id: 'a', motivo: 'limite_tier_250' }], ignoradas: [{ instancia_id: 'b', motivo: 'submissao_existente_preservada' }] }), async ids => { queued = ids; }, () => {});
  expect(queued).toEqual(['a']);
  expect(results.map(r => r.status)).toEqual(['PENDENTE', 'EXISTENTE']);
});
test('failed deferral is not reported as a queued success', async () => {
  const results = await applyManualTemplate('m', ['a'], async () => ({ success: true, adiadas: [{ instancia_id: 'a', motivo: 'limite_tier_250' }] }), async () => { throw new Error('queue failure'); }, () => {});
  expect(results[0]?.status).toBe('FALHA_ENVIO');
});
test('only an identified internal slot failure can recover a terminal row', () => {
  expect(queueRecoveryDecision({ status: 'FALHA_ENVIO', motivo: 'meta_template_daily_reservations_slot_check' })).toBe('recover');
  expect(queueRecoveryDecision({ status: 'REJECTED', motivo: 'Meta rejected template' })).toBe('terminal');
  expect(queueRecoveryDecision({ status: 'FALHA_ENVIO', motivo: 'Meta 141006' })).toBe('terminal');
  expect(queueRecoveryDecision({ status: 'ENVIADO' })).toBe('active');
});
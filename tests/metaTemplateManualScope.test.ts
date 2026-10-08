import { expect, test } from 'bun:test';
import { manualInstanceIds, validManualBatch } from '../supabase/functions/meta-verificar-status-templates/manual-scope';

test('manual verification includes all 150 connected instances, even without pending templates', () => {
  const rows = Array.from({ length: 150 }, (_, i) => ({ id: String(i), user_id: 'owner', ativo: true, provider: 'meta', saude_status: 'CONNECTED' }));
  expect(manualInstanceIds(rows, 'owner')).toHaveLength(150);
  expect(manualInstanceIds(rows, 'owner').at(-1)).toBe('149');
});
test('manual verification excludes other owners, inactive, disconnected and UAZAPI instances', () => {
  const base = { id: 'own', user_id: 'owner', ativo: true, provider: 'meta', saude_status: 'CONNECTED' };
  expect(manualInstanceIds([base, { ...base, user_id: 'other' }, { ...base, ativo: false }, { ...base, provider: 'uazapi' }, { ...base, saude_status: 'BANNED' }], 'owner')).toEqual(['own']);
});
test('manual batches are bounded and reject duplicates or malformed IDs', () => {
  const ids = Array.from({ length: 6 }, (_, i) => `00000000-0000-0000-0000-00000000000${i}`);
  expect(validManualBatch(ids.slice(0, 5))).toBe(true);
  expect(validManualBatch(ids)).toBe(false);
  expect(validManualBatch([ids[0], ids[0]])).toBe(false);
  expect(validManualBatch(['bad'])).toBe(false);
});
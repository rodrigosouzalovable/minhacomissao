import { expect, test } from 'bun:test';
import { decidirLiberacaoReprovacoes } from '../supabase/functions/_shared/meta-template-rejection-release';

test('releases pause when sync ok and no rejected templates remain', () => {
  expect(decidirLiberacaoReprovacoes(true, []).liberar).toBe(true);
});
test('keeps pause when a rejected template remains', () => {
  expect(decidirLiberacaoReprovacoes(true, ['x']).liberar).toBe(false);
});
test('keeps pause when Meta sync fails', () => {
  expect(decidirLiberacaoReprovacoes(false, []).liberar).toBe(false);
});

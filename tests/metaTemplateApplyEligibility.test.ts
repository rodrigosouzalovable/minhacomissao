import { expect, test } from 'bun:test';
import { instanciaAptaParaTemplate } from '../src/lib/metaTemplateApplyEligibility';

test('banned number does not count as pending', () => {
  expect(instanciaAptaParaTemplate({ ativo: true, saude_status: 'BANNED' })).toBe(false);
});
test('connected number paused by a real Meta block is excluded', () => {
  expect(instanciaAptaParaTemplate({ ativo: true, saude_status: 'CONNECTED', pausa_automatica_motivo: 'Meta #131031 account locked' })).toBe(false);
});
test('connected number with an informative quality pause stays eligible', () => {
  expect(instanciaAptaParaTemplate({ ativo: true, saude_status: 'CONNECTED', pausa_automatica_motivo: 'quality=RED' })).toBe(true);
});
test('inactive number is excluded', () => {
  expect(instanciaAptaParaTemplate({ ativo: false, saude_status: 'CONNECTED' })).toBe(false);
});

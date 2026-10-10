import { expect, test } from 'bun:test';
import { metaRecuperacao, RECUPERACAO_MIN_DIA, RECUPERACAO_MAX_DIA, RECUPERACAO_TETO_BRL } from '../supabase/functions/_shared/recuperacao-volume';
import { NOVO_MUNDO_TETO } from '../supabase/functions/_shared/novo-mundo-contatos-rules';
test('metas autorizadas aumentam 30% de 10–20 para 13–26', () => {
  expect(RECUPERACAO_MIN_DIA).toBe(13);
  expect(RECUPERACAO_MAX_DIA).toBe(26);
  expect(metaRecuperacao(30)).toBe(26);
});
test('teto autorizado aumenta 30% de 20,30 para 26,39', () => {
  expect(RECUPERACAO_TETO_BRL).toBe(26.39);
  expect(NOVO_MUNDO_TETO).toBe(26.39);
});
test('redução por piora continua em cinco mensagens', () => {
  expect(metaRecuperacao(5)).toBe(5);
});

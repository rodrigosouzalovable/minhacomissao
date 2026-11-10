import { expect, test } from 'bun:test';
import { metaRecuperacao, RECUPERACAO_MIN_DIA, RECUPERACAO_MAX_DIA, RECUPERACAO_TETO_BRL } from '../supabase/functions/_shared/recuperacao-volume';
import { NOVO_MUNDO_TETO } from '../supabase/functions/_shared/novo-mundo-contatos-rules';
test('aceleração autorizada: 20 a 40 mensagens por número/dia', () => {
  expect(RECUPERACAO_MIN_DIA).toBe(20);
  expect(RECUPERACAO_MAX_DIA).toBe(40);
  expect(metaRecuperacao(60)).toBe(40);
});
test('teto diário segue em R$ 26,39', () => {
  expect(RECUPERACAO_TETO_BRL).toBe(26.39);
  expect(NOVO_MUNDO_TETO).toBe(26.39);
});
test('redução por piora continua em cinco mensagens', () => {
  expect(metaRecuperacao(5)).toBe(5);
});

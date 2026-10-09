import { expect, test } from 'bun:test';
import { executarBaseNovoMundo } from '../supabase/functions/_shared/novo-mundo-contatos-envio';
import { NOVO_MUNDO_TETO, NOVO_MUNDO_AVISO } from '../supabase/functions/_shared/novo-mundo-contatos-rules';

test('sem remetentes não reserva nem envia', async () => {
  let calls = 0;
  const db = { from: () => { calls++; throw Error('Consulta inesperada'); }, rpc: () => { calls++; throw Error('Reserva inesperada'); } };
  const result = await executarBaseNovoMundo(db, [], false);
  expect(result.resultados).toEqual([]); expect(calls).toBe(0);
});
test('simulação com estoque mantém reserva e envio desligados', async () => {
  let reservations = 0;
  const q: any = { select: () => q, eq: () => q, limit: async () => ({ data: [{ id: 'pendente' }], error: null }) };
  const db = { from: () => q, rpc: () => { reservations++; throw Error('Reserva inesperada'); } };
  const result = await executarBaseNovoMundo(db, [{ user_id: 'owner', id: 'inst', nome: 'Teste', display_phone: '5562999990001' }], true);
  expect(result.resultados).toEqual([{ instancia: 'Teste', simulado: true, fonte: 'novo_mundo' }]);
  expect(reservations).toBe(0);
});
test('teto compartilhado mantém R$20,30 e reposição avisa em 500', () => {
  expect(NOVO_MUNDO_TETO).toBe(20.30); expect(NOVO_MUNDO_AVISO).toBe(500);
});
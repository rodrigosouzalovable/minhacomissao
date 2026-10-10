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
  const q: any = { select: () => q, eq: () => q, limit: async () => ({ data: [{ id: 'pendente' }], error: null }), then: (resolve: any) => resolve({ data: [{ instancia_id: 'inst', meta_templates_mestre: { reclassificado_marketing: false } }], error: null }) };
  const db = { from: () => q, rpc: () => { reservations++; throw Error('Reserva inesperada'); } };
  const result = await executarBaseNovoMundo(db, [{ user_id: 'owner', id: 'inst', nome: 'Teste', display_phone: '5562999990001' }], true);
  expect(result.resultados).toEqual([{ instancia: 'Teste', simulado: true, fonte: 'novo_mundo' }]);
  expect(reservations).toBe(0);
});
test('teto compartilhado mantém R$20,30 e reposição avisa em 500', () => {
  expect(NOVO_MUNDO_TETO).toBe(20.30); expect(NOVO_MUNDO_AVISO).toBe(500);
});

test('cópias ausentes no início não impedem os oito remetentes aprovados posteriores', async () => {
  const copies = Array.from({ length: 9 }, (_, n) => ({ instancia_id: `approved-${n}`, meta_templates_mestre: { reclassificado_marketing: false } }));
  copies.push({ instancia_id: 'marketing', meta_templates_mestre: { reclassificado_marketing: true } });
  const q: any = { select: () => q, eq: () => q, limit: async () => ({ data: [{ id: 'pendente' }], error: null }), then: (resolve: any) => resolve({ data: copies, error: null }) };
  const db = { from: () => q, rpc: () => { throw Error('Simulação não reserva'); } };
  const insts = ['marketing', ...Array.from({ length: 12 }, (_, n) => `missing-${n}`), ...Array.from({ length: 9 }, (_, n) => `approved-${n}`)].map(id => ({ id, user_id: 'owner', nome: id, display_phone: '5562999990001' }));
  const result = await executarBaseNovoMundo(db, insts, true);
  expect(result.resultados.map(r => r.instancia)).toEqual(Array.from({ length: 8 }, (_, n) => `approved-${n}`));
});
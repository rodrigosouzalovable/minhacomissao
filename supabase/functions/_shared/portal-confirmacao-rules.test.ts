import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { ordenarCandidatasConfirmacao, MAX_TENTATIVAS_CONFIRMACAO } from './portal-confirmacao-rules.ts';

const c = (instancia: string, quality = 'GREEN', sufixo = '00000000') => ({ instancia, template: 't' + instancia, ativo: true, quality, status: 'CONNECTED', sufixo });
const lista = [c('verde'), c('red', 'RED'), c('odres', 'GREEN', '81810202'), c('p3144'), c('campanha')];

Deno.test('primeira tentativa usa o 3144', () => {
  const r = ordenarCandidatasConfirmacao(lista, { principal: 'p3144', recentes: ['campanha'], exclusivaSufixo: '81810202', excluidas: [] });
  assertEquals(r[0].instancia, 'p3144');
});

Deno.test('após falha: número da campanha, depois exclusivo Odres, nunca RED nem repetida', () => {
  const r = ordenarCandidatasConfirmacao(lista, { principal: 'p3144', recentes: ['campanha'], exclusivaSufixo: '81810202', excluidas: ['p3144'] });
  assertEquals(r.map((x) => x.instancia), ['campanha', 'odres', 'verde']);
});

Deno.test('limite de 4 tentativas', () => assertEquals(MAX_TENTATIVAS_CONFIRMACAO, 4));

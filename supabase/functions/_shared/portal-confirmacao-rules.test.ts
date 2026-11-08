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

import { preferirTemplateNovo, condicaoAcordo, credorComArtigo, cpfFormatado } from './portal-confirmacao-rules.ts';

Deno.test('prefere o template novo na mesma instância e mantém o antigo onde o novo não existe', () => {
  const r = preferirTemplateNovo([
    { instancia: 'a', nome: 'confirmacao_acordo_portal' }, { instancia: 'a', nome: 'confirmacao_formalizacao_acordo' },
    { instancia: 'b', nome: 'confirmacao_acordo_portal' },
  ]);
  assertEquals(r.find((x) => x.instancia === 'a')!.nome, 'confirmacao_formalizacao_acordo');
  assertEquals(r.find((x) => x.instancia === 'b')!.nome, 'confirmacao_acordo_portal');
});

Deno.test('condição 1x e parcelada', () => {
  assertEquals(condicaoAcordo(1, 2414, '2026-11-07'), '1 parcela no valor de R$ 2.414,00, com vencimento em 07/11/2026');
  assertEquals(condicaoAcordo(6, 157.06, '2026-11-07'), '6 parcelas mensais de R$ 157,06, com primeiro vencimento em 07/11/2026');
});

Deno.test('credor e CPF', () => {
  assertEquals(credorComArtigo('ODRES CRED'), 'a Odres Cred');
  assertEquals(cpfFormatado('07612097273'), '076.120.972-73');
});

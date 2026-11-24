import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { umeClient, alvoConta, contaDe } from './ume-api.ts';
import { contaUmeDoUsuario } from './ume-conta.ts';
import { THIAGO_NOGUEIRA_USER_ID } from './thiago-meta-override.ts';

const fakeDb = (parceiro: boolean) => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { parceiro_meta: parceiro } }) }) }) }) });

Deno.test('conta padrão continua usando as credenciais da empresa', () => {
  for (const [k, v] of Object.entries({ UME_PRD_CLIENT_ID: 'empresa', UME_PRD_CLIENT_SECRET: 's', UME_PRD_USERNAME: 'u', UME_PRD_PASSWORD: 'p',
    UME_AMARAL_PRD_CLIENT_ID: 'amaral', UME_AMARAL_PRD_CLIENT_SECRET: 's2', UME_AMARAL_PRD_USERNAME: 'u2', UME_AMARAL_PRD_PASSWORD: 'p2' })) Deno.env.set(k, v);
  assertEquals(umeClient('prd').client_id, 'empresa');
  assertEquals(umeClient('prd', 'amaral').client_id, 'amaral');
  assertEquals(alvoConta('prd'), 'prd');
  assertEquals(contaDe(alvoConta('prd', 'amaral')), 'amaral');
});

Deno.test('só o Thiago com a tag parceiro usa a conta Amaral', async () => {
  assertEquals(await contaUmeDoUsuario(fakeDb(true), THIAGO_NOGUEIRA_USER_ID), 'amaral');
  assertEquals(await contaUmeDoUsuario(fakeDb(false), THIAGO_NOGUEIRA_USER_ID), 'padrao');
  assertEquals(await contaUmeDoUsuario(fakeDb(true), 'ee649720-b8ce-47a2-859e-100a3a9ae6bb'), 'padrao');
  assertEquals(await contaUmeDoUsuario(fakeDb(true), null), 'padrao');
});

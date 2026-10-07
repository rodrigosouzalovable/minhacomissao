import { expect, test } from 'bun:test';
import { createClient } from '@supabase/supabase-js';

const token = process.env.ODRES_TEST_ACCESS_TOKEN;
const url = process.env.ODRES_TEST_URL;
const key = process.env.ODRES_TEST_ANON_KEY;

test.skipIf(!token || !url || !key)('incomplete or empty replacement cannot remove current Odres snapshot', async () => {
  if (!token || !url || !key) return;
  const client = createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: before, error: readError } = await client.from('portal_odres_listas').select('id,total_esperado').eq('ativo', true).single();
  expect(readError).toBeNull();
  expect(before?.total_esperado).toBeGreaterThan(0);
  const { error: emptyError } = await client.rpc('portal_odres_iniciar', { p_arquivo: 'teste-vazio', p_total: 0 });
  expect(emptyError).not.toBeNull();
  const { data: id, error } = await client.rpc('portal_odres_iniciar', { p_arquivo: 'teste-incompleto-sem-publicacao', p_total: 2 });
  expect(error).toBeNull();
  expect(id).toBeTruthy();
  const { error: addError } = await client.rpc('portal_odres_adicionar_lote', { p_lista: id, p_cpfs: ['52998224725'] });
  expect(addError).toBeNull();
  const { error: publishError } = await client.rpc('portal_odres_publicar', { p_lista: id });
  expect(publishError?.message).toContain('Lista incompleta');
  const { data: after } = await client.from('portal_odres_listas').select('id,total_esperado').eq('ativo', true).single();
  expect(after).toEqual(before);
  const anonymous = createClient(url, key, { auth: { persistSession: false } });
  const { error: denied } = await anonymous.rpc('portal_odres_iniciar', { p_arquivo: 'nao-autorizado', p_total: 1 });
  expect(denied).not.toBeNull();
});
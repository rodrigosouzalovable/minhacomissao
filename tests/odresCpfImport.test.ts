import { expect, test } from 'bun:test';
import { parseOdresCpfs } from '../src/lib/odresCpfImport';
import { publicUmeWallet, remotePortalCredor, portalRemoteDecision } from '../supabase/functions/_shared/portal-public';

test('Odres list keeps first CPF with or without header and deduplicates', () => {
  const data = [['17169689685'], ['171.696.896-85'], ['52998224725']];
  expect(parseOdresCpfs(data)).toMatchObject({ cpfs: ['17169689685', '52998224725'], repetidos: 1, invalidos: 0 });
  expect(parseOdresCpfs([['CPF/CNPJ'], ...data]).cpfs).toEqual(parseOdresCpfs(data).cpfs);
});
test('normalization preserves leading zeros and rejects invalid identifiers', () => {
  expect(parseOdresCpfs([['03589154306'], [3589154306], ['11111111111'], ['52998224724'], ['CPF inválido']])).toMatchObject({ cpfs: ['03589154306'], repetidos: 1, invalidos: 3 });
});
test('directory assigns remote debt to Odres rather than duplicate UME', () => {
  const empty = { acordos: [], debitos: [] };
  expect(remotePortalCredor(true)).toBe('odres_cred');
  expect(remotePortalCredor(false)).toBe('ume');
  expect(portalRemoteDecision('odres_cred', true, empty, empty)).toBe('remote');
  expect(portalRemoteDecision('ume', true, empty, empty)).toBe('local');
  expect(portalRemoteDecision('novo_mundo', true, empty, empty)).toBe('local');
});
test('CPF identification does not create debt, remote principal remains unchanged', () => {
  expect(publicUmeWallet({ encontrado: false, nome: '', valorSemJuros: null, consultadoEm: '' }, [], 'odres_cred')).toMatchObject({ credor: 'odres_cred', estado: 'empty', principal: null });
  expect(publicUmeWallet({ encontrado: true, nome: 'Cliente', valorSemJuros: 1000, consultadoEm: '' }, [], 'odres_cred')).toMatchObject({ credor: 'odres_cred', principal: 1000, principalValidado: true });
});
test('agreements remain local and ambiguous distinct portfolios require review', () => {
  expect(portalRemoteDecision('odres_cred', true, { acordos: [{}], debitos: [] }, null)).toBe('local');
  expect(portalRemoteDecision('odres_cred', true, { acordos: [], debitos: [{}] }, { acordos: [], debitos: [{}] })).toBe('conflict');
});
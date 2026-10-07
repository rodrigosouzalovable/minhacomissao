import { expect, test } from 'bun:test';
import { validPublicQuery, publicUmeWallet } from '../supabase/functions/_shared/portal-public';

test('public input accepts only exact valid CPF and authorized creditor', () => {
  expect(validPublicQuery('52998224725', 'ume')).toBe(true);
  expect(validPublicQuery('52998224725', 'odres_cred')).toBe(true);
  expect(validPublicQuery('52998224724', 'ume')).toBe(false);
  expect(validPublicQuery('52998224725', 'other')).toBe(false);
  expect(validPublicQuery('11111111111', 'novo_mundo')).toBe(false);
});
test('public UME uses interest-free principal, never accrued balance', () => {
  const source = { encontrado: true, nome: 'Teste', valorSemJuros: 1000, valorComJuros: 2000, telefone: 'private', borrowerId: 'private', limiteTotal: 5000, consultadoEm: '2026-10-07' };
  const wallet = publicUmeWallet(source, []);
  expect(wallet.principal).toBe(1000);
  expect(wallet.principalValidado).toBe(true);
  expect(wallet).not.toHaveProperty('telefone');
  expect(wallet).not.toHaveProperty('borrowerId');
  expect(wallet).not.toHaveProperty('limiteTotal');
});
test('missing UME principal blocks proposals without a fallback balance', () => {
  expect(publicUmeWallet({ encontrado: true, nome: 'Teste', valorSemJuros: null, consultadoEm: '' }, [])).toMatchObject({ estado: 'pending', principal: null, principalValidado: false });
  expect(publicUmeWallet({ encontrado: false, nome: '', valorSemJuros: null, consultadoEm: '' }, [])).toMatchObject({ estado: 'empty', principalValidado: false });
});
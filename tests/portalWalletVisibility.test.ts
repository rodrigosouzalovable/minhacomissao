import { expect, test } from 'bun:test';
import { portalVisibleWallet } from '../src/lib/portalWalletVisibility';
import type { PortalWallet, PortalCredor, PortalAgreement } from '../src/lib/portalNegotiation';

const wallet = (credor: PortalCredor, change: Partial<PortalWallet> = {}): PortalWallet => ({ credor, estado: 'empty', nome: 'Cliente teste', principal: null, principalValidado: false, debitos: [], acordos: [], faixas: [], ...change });
const paid = { numero_parcela: 1, valor_parcela: 147, data_prevista: '2026-07-28', data_paga: '2026-07-28', status: 'pago' };
const pending = { ...paid, numero_parcela: 2, data_paga: null, status: 'pendente', valor_parcela: 200 };
const agreement = (parcelas: PortalAgreement['parcelas'], status = 'ativo'): PortalAgreement => ({ id: 'a', status, parcelas });
const debt = { id: 'd', nome: 'Teste', cpf: '52998224725', valor_original: 1000, valor_atualizado: 1000, contrato: 'C2', descricao: null, data_vencimento: '2026-10-01', credor: 'odres_cred' };

test('only UME pending: excludes empty Novo Mundo and Odres', () => {
  const result = [wallet('novo_mundo'), wallet('ume', { estado: 'ok', principal: 1000, principalValidado: true }), wallet('odres_cred')].map(portalVisibleWallet).filter(Boolean);
  expect(result.map(w => w?.credor)).toEqual(['ume']);
});
test('each sole creditor is retained without other creditors', () => {
  for (const credor of ['novo_mundo', 'ume', 'odres_cred'] as const) expect(portalVisibleWallet(wallet(credor, { estado: 'ok', principal: 1000 }))?.credor).toBe(credor);
});
test('multiple pending creditors retain independent balances', () => {
  const result = [wallet('ume', { principal: 1000 }), wallet('odres_cred', { principal: 2000 })].map(portalVisibleWallet);
  expect(result.map(w => w?.principal)).toEqual([1000, 2000]);
});
test('fully paid agreement and its aggregate principal are hidden', () => {
  expect(portalVisibleWallet(wallet('novo_mundo', { estado: 'ok', principal: 147, acordos: [agreement([paid], 'concluido')] }))).toBeNull();
});
test('paid installments remain inside agreements with outstanding installments', () => {
  expect(portalVisibleWallet(wallet('ume', { estado: 'ok', acordos: [agreement([paid, pending])] }))?.acordos[0].parcelas).toEqual([paid, pending]);
});
test('paid agreement is removed alongside another pending agreement', () => {
  expect(portalVisibleWallet(wallet('ume', { acordos: [agreement([paid], 'concluido'), { ...agreement([pending]), id: 'b' }] }))?.acordos.map(a => a.id)).toEqual(['b']);
});
test('debt alongside settled agreement remains visible but cannot be renegotiated without validation', () => {
  expect(portalVisibleWallet(wallet('odres_cred', { principal: 1000, principalValidado: true, debitos: [debt], acordos: [agreement([paid], 'concluido')] }))).toMatchObject({ estado: 'pending', principalValidado: false, acordos: [], debitos: [debt] });
});
test('missing installments in active agreement remains uncertain, not settled', () => {
  expect(portalVisibleWallet(wallet('ume', { acordos: [agreement([])] }))?.acordos).toHaveLength(1);
});
test('failed and incomplete consultations are not hidden as empty', () => {
  expect(portalVisibleWallet(wallet('ume', { estado: 'error' }))?.estado).toBe('error');
  expect(portalVisibleWallet(wallet('ume', { estado: 'pending' }))?.estado).toBe('pending');
});
import type { PortalAgreement, PortalWallet } from './portalNegotiation';

export function portalAgreementPending(agreement: PortalAgreement): boolean {
  return agreement.parcelas.some(p => p.status !== 'pago' && Number(p.valor_parcela) > 0);
}

export function portalAgreementUncertain(agreement: PortalAgreement): boolean {
  return agreement.parcelas.length === 0 && agreement.status !== 'concluido';
}

export function portalVisibleWallet(wallet: PortalWallet): PortalWallet | null {
  if (wallet.estado === 'loading' || wallet.estado === 'error') return wallet;
  const acordos = wallet.acordos.filter(a => portalAgreementPending(a) || portalAgreementUncertain(a));
  const hasDebt = wallet.debitos.some(d => Number(d.valor_original) > 0) || (wallet.acordos.length === 0 && Number(wallet.principal) > 0);
  if (!acordos.length && !hasDebt && wallet.estado !== 'pending') return null;
  return { ...wallet, acordos };
}
import { getDescontoComFaixas, type FaixaDescontoCredor } from './descontoPortal';

export type PortalCredor = 'novo_mundo' | 'ume' | 'odres_cred';
export const PORTAL_CREDORES: PortalCredor[] = ['novo_mundo', 'ume', 'odres_cred'];
export const PORTAL_LABELS: Record<PortalCredor, string> = { novo_mundo: 'Novo Mundo', ume: 'UME', odres_cred: 'Odres Cred' };

export function portalCredorFromSource(value: string): PortalCredor | null {
  const v = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (['umenovomundo', 'umenovomundoaporte', 'novomundo', 'nm'].includes(v)) return 'novo_mundo';
  if (['ume', 'mundodamoda'].includes(v)) return 'ume';
  if (v === 'odrescred') return 'odres_cred';
  return null;
}

export function validPortalCpf(value: string): boolean {
  const cpf = value.replace(/\D/g, '');
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  for (let n = 9; n <= 10; n++) {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += Number(cpf[i]) * (n + 1 - i);
    const check = (sum * 10) % 11;
    if ((check === 10 ? 0 : check) !== Number(cpf[n])) return false;
  }
  return true;
}

export function portalPaymentDateValid(date: string, today: string): boolean {
  const start = Date.parse(`${today}T00:00:00Z`);
  const chosen = Date.parse(`${date}T00:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(chosen) && new Date(chosen).toISOString().slice(0, 10) === date && chosen >= start && chosen <= start + 10 * 86400000;
}

export function portalBrtToday(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(new Date());
}

/** All totals are rounded once to cents; the last installment carries the remainder. */
export function portalTerms(principal: number, credor: PortalCredor, dias = 0, faixas?: FaixaDescontoCredor[] | null) {
  if (!Number.isFinite(principal) || principal <= 0) return null;
  const cents = Math.round(principal * 100);
  const avistaPct = credor === 'novo_mundo' ? getDescontoComFaixas(dias, 'avista', faixas) : 0;
  const parceladoPct = credor === 'novo_mundo' ? getDescontoComFaixas(dias, 'parcelado', faixas) : 0;
  const avista = Math.round(cents * (1 - avistaPct / 100)) / 100;
  const total = Math.round(credor === 'novo_mundo' ? cents * (1 - parceladoPct / 100) : cents * 1.1) / 100;
  return { principal: cents / 100, avista, total, acrescimo: credor === 'novo_mundo' ? 0 : Math.round((total - cents / 100) * 100) / 100, avistaPct, parceladoPct, maxParcelas: Math.min(credor === 'novo_mundo' ? 24 : 18, Math.floor(Math.round(total * 100) / 10000)) };
}

export function portalInstallments(total: number, quantity: number, cap = 18): number[] {
  if (!Number.isFinite(total) || !Number.isInteger(quantity) || quantity < 2 || quantity > cap) return [];
  const cents = Math.round(total * 100);
  const each = Math.floor(cents / quantity);
  if (each < 10000) return [];
  return Array.from({ length: quantity }, (_, i) => (i === quantity - 1 ? cents - each * (quantity - 1) : each) / 100);
}

export interface PortalDebt { id: string; nome: string; cpf: string; valor_original: number; valor_atualizado: number; contrato: string | null; descricao: string | null; data_vencimento: string | null; credor: string }
export interface PortalAgreement { id: string; status: string; parcelas: { numero_parcela: number; valor_parcela: number; data_prevista: string; status: string; data_paga: string | null }[] }
export interface PortalWallet { credor: PortalCredor; estado: 'loading' | 'ok' | 'empty' | 'error' | 'pending'; nome: string; principal: number | null; principalValidado: boolean; debitos: PortalDebt[]; acordos: PortalAgreement[]; faixas: FaixaDescontoCredor[]; mensagem?: string; consultadoEm?: string }

export function portalProposalText(args: { credor: PortalCredor; nome: string; cpf: string; principal: number; total: number; installments: number[]; date: string; entrada?: number; contratos?: string[] }) {
  const money = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const date = args.date.split('-').reverse().join('/');
  const final = args.installments[args.installments.length - 1];
  const first = args.installments[0];
  const parcelas = first == null ? `À vista: ${money(args.total)}.` : `${args.installments.length} parcelas: ${money(first)}${final !== first && final != null ? `, sendo a última de ${money(final)}` : ' cada'}.`;
  return `Olá! Meu nome é ${args.nome}, CPF ${args.cpf}. Quero negociar meu débito com ${PORTAL_LABELS[args.credor]}.${args.contratos?.length ? ` Contratos: ${args.contratos.join(', ')}.` : ''} Principal: ${money(args.principal)}.${args.credor !== 'novo_mundo' && first != null ? ` Acréscimo de 10%: ${money(Math.round((args.total - args.principal) * 100) / 100)}.` : ''} Total: ${money(args.total)}. ${args.entrada ? `Entrada: ${money(args.entrada)}. ` : ''}${parcelas} Primeiro pagamento: ${date}. Gostaria de confirmar as condições e solicitar o boleto.`;
}
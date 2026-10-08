import { EMPRESAS_ACORDO, type EmpresaAcordo } from './empresaLabels';
import type { QueryClient } from '@tanstack/react-query';

export type TotaisCredor = Record<EmpresaAcordo, number>;

export function totaisCredorVazios(): TotaisCredor {
  return { ume_novo_mundo: 0, mundo_da_moda: 0, odres_cred: 0 };
}

export interface ParcelaRecebimento {
  id: string;
  acordo_id: string;
  status: string;
  data_paga: string | null;
  valor_parcela: number | string;
}

export function resumirRecebimentos(
  parcelas: ParcelaRecebimento[],
  acordos: { id: string; empresa: string; user_id: string }[],
  inicio: string,
  fimExclusivo: string,
) {
  const porCredor = totaisCredorVazios();
  const porUsuario: Record<string, TotaisCredor> = {};
  const porDia: Record<string, number> = {};
  const mapa = new Map(acordos.map(a => [a.id, a]));
  const vistos = new Set<string>();
  let quantidade = 0;
  for (const p of parcelas) {
    if (vistos.has(p.id) || p.status !== 'pago' || !p.data_paga || p.data_paga < inicio || p.data_paga >= fimExclusivo) continue;
    const acordo = mapa.get(p.acordo_id);
    if (!acordo || !EMPRESAS_ACORDO.includes(acordo.empresa as EmpresaAcordo)) continue;
    const valor = Number(p.valor_parcela);
    if (!Number.isFinite(valor)) continue;
    vistos.add(p.id);
    const credor = acordo.empresa as EmpresaAcordo;
    porCredor[credor] += valor;
    porUsuario[acordo.user_id] ||= totaisCredorVazios();
    porUsuario[acordo.user_id][credor] += valor;
    porDia[p.data_paga] = (porDia[p.data_paga] || 0) + valor;
    quantidade++;
  }
  return { porCredor, porUsuario, porDia, quantidade, total: Object.values(porCredor).reduce((s, v) => s + v, 0) };
}

export function invalidarRecebimentos(client: QueryClient) {
  return Promise.all([
    'ranking-mensal', 'mural-top3', 'dashboard', 'historico-mes', 'metas-mensal',
    'meta-banner-pag', 'meus-acordos', 'meus-pagamentos', 'user-acordos', 'user-pagamentos',
    'payment-reminders', 'overdue-installments',
  ].map(key => client.invalidateQueries({ queryKey: [key] })));
}
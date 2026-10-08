import { describe, expect, test } from 'bun:test';
import { resumirRecebimentos, invalidarRecebimentos } from '../src/lib/recebimentosPorCredor';
import { QueryClient } from '@tanstack/react-query';

const acordos = [
  { id: 'nm', empresa: 'ume_novo_mundo', user_id: 'operador' },
  { id: 'ume', empresa: 'mundo_da_moda', user_id: 'operador' },
  { id: 'odres', empresa: 'odres_cred', user_id: 'autor' },
];
const parcela = (id: string, acordo_id = 'odres', valor_parcela = 100, status = 'pago', data_paga: string | null = '2026-10-08') => ({ id, acordo_id, valor_parcela, status, data_paga });
const resumo = (ps: ReturnType<typeof parcela>[]) => resumirRecebimentos(ps, acordos, '2026-10-01', '2026-11-01');

describe('Recebimentos dos três credores', () => {
  test('Odres soma com Novo Mundo e UME sem misturar empresas', () => {
    const r = resumo([parcela('1', 'nm', 200), parcela('2', 'ume', 300), parcela('3')]);
    expect(r.porCredor).toEqual({ ume_novo_mundo: 200, mundo_da_moda: 300, odres_cred: 100 });
    expect(r.total).toBe(600);
  });
  test('lançamento pendente não representa recebido', () => {
    expect(resumo([parcela('1', 'odres', 100, 'pendente', null)]).total).toBe(0);
  });
  test('confirmar entra uma vez mesmo com registro repetido', () => {
    expect(resumo([parcela('1'), parcela('1')]).total).toBe(100);
    expect(resumo([parcela('1'), parcela('1')]).quantidade).toBe(1);
  });
  test('desmarcar retira o recebido', () => {
    expect(resumo([parcela('1')]).total).toBe(100);
    expect(resumo([parcela('1', 'odres', 100, 'pendente', null)]).total).toBe(0);
  });
  test('período usa data efetiva, incluindo primeiro e último dia, não mês do acordo', () => {
    const r = resumo([parcela('1', 'odres', 100, 'pago', '2026-09-30'), parcela('2', 'odres', 200, 'pago', '2026-10-01'), parcela('3', 'odres', 300, 'pago', '2026-10-31'), parcela('4', 'odres', 400, 'pago', '2026-11-01')]);
    expect(r.total).toBe(500);
  });
  test('recebimento pertence ao autor do acordo, não a quem confirmou', () => {
    expect(resumo([parcela('1')]).porUsuario).toEqual({ autor: { ume_novo_mundo: 0, mundo_da_moda: 0, odres_cred: 100 } });
  });
  test('pagamento sem data e credor desconhecido não vira UME', () => {
    expect(resumo([parcela('1', 'odres', 100, 'pago', null), parcela('2', 'desconhecido')]).total).toBe(0);
  });
  test('operação financeira invalida resumos e pagamentos pessoais', async () => {
    const client = new QueryClient();
    for (const key of ['metas-mensal', 'ranking-mensal', 'meta-banner-pag', 'historico-mes', 'meus-pagamentos', 'user-pagamentos']) client.setQueryData([key], 1);
    await invalidarRecebimentos(client);
    expect(client.getQueryState(['metas-mensal'])?.isInvalidated).toBe(true);
    expect(client.getQueryState(['ranking-mensal'])?.isInvalidated).toBe(true);
    expect(client.getQueryState(['meta-banner-pag'])?.isInvalidated).toBe(true);
    expect(client.getQueryState(['historico-mes'])?.isInvalidated).toBe(true);
    expect(client.getQueryState(['meus-pagamentos'])?.isInvalidated).toBe(true);
    expect(client.getQueryState(['user-pagamentos'])?.isInvalidated).toBe(true);
  });
});
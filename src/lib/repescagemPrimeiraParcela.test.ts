import { describe, it, expect } from 'vitest';
import { datasRepescagem, montarClientesRepescagem } from '../../supabase/functions/_shared/repescagem-primeira-parcela';

const base = { valor_parcela: 150, cliente_nome: 'MARIA SILVA', cliente_cpf: '123', empresa: 'odres_cred' };

describe('repescagem da 1ª parcela', () => {
  it('aciona vencimentos de D+1 a D+3', () => {
    expect(datasRepescagem('2026-11-14')).toEqual(['2026-11-13', '2026-11-12', '2026-11-11']);
  });
  it('domingo não envia', () => {
    expect(datasRepescagem('2026-11-15')).toEqual([]);
  });
  it('ignora D+4 e parcelas que não são a primeira', () => {
    const r = montarClientesRepescagem([
      { ...base, numero_parcela: 1, data_prevista: '2026-11-10', cliente_telefone: '62999990001' },
      { ...base, numero_parcela: 2, data_prevista: '2026-11-13', cliente_telefone: '62999990002' },
    ], '2026-11-14', new Set());
    expect(r).toHaveLength(0);
  });
  it('um envio por telefone e respeita os já acionados', () => {
    const r = montarClientesRepescagem([
      { ...base, numero_parcela: 1, data_prevista: '2026-11-13', cliente_telefone: '62999990001' },
      { ...base, numero_parcela: 1, data_prevista: '2026-11-12', cliente_telefone: '5562999990001' },
      { ...base, numero_parcela: 1, data_prevista: '2026-11-13', cliente_telefone: '62999990003' },
    ], '2026-11-14', new Set(['99990003']));
    expect(r).toHaveLength(1);
    expect(r[0].telefone).toBe('5562999990001');
    expect(r[0].vars['1']).toBe('Maria');
  });
  it('só UME e Odres Cred', () => {
    const r = montarClientesRepescagem([
      { ...base, empresa: 'montreal', numero_parcela: 1, data_prevista: '2026-11-13', cliente_telefone: '62999990001' },
    ], '2026-11-14', new Set());
    expect(r).toHaveLength(0);
  });
});

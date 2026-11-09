import { describe, it, expect } from 'vitest';
import { datasAlvoPreventivo, rotuloVencimento, montarClientesPreventivo } from '../../supabase/functions/_shared/lembrete-preventivo';

describe('lembrete preventivo D-1', () => {
  it('segunda a sexta lembra só quem vence amanhã', () => {
    expect(datasAlvoPreventivo('2026-11-09')).toEqual(['2026-11-10']);
  });
  it('sábado lembra domingo e segunda', () => {
    expect(datasAlvoPreventivo('2026-11-14')).toEqual(['2026-11-15', '2026-11-16']);
  });
  it('domingo não envia', () => {
    expect(datasAlvoPreventivo('2026-11-15')).toEqual([]);
  });
  it('rótulo do vencimento', () => {
    expect(rotuloVencimento('2026-11-10', '2026-11-09')).toBe('10/11/2026 (amanhã)');
    expect(rotuloVencimento('2026-11-16', '2026-11-14')).toBe('16/11/2026 (segunda-feira)');
  });
  it('um envio por telefone, credor correto e sufixos já acionados ficam de fora', () => {
    const base = { valor_parcela: 100, cliente_cpf: '1', data_prevista: '2026-11-10' };
    const r = montarClientesPreventivo([
      { ...base, cliente_nome: 'ANA SILVA', cliente_telefone: '62999990001', empresa: 'odres_cred' },
      { ...base, cliente_nome: 'ANA SILVA', cliente_telefone: '5562999990001', empresa: 'odres_cred' },
      { ...base, cliente_nome: 'BIA', cliente_telefone: '62999990002', empresa: 'mundo_da_moda' },
      { ...base, cliente_nome: 'CAIO', cliente_telefone: '62999990003', empresa: 'ume_novo_mundo' },
    ], '2026-11-09', new Set(['99990003']));
    expect(r).toHaveLength(2);
    expect(r[0].vars).toMatchObject({ '1': 'Ana', '2': 'ODRES CRED', '3': '10/11/2026 (amanhã)' });
    expect(r[0].saldo).toBe(200);
    expect(r[1].vars['2']).toBe('UME');
  });
});

import { describe, expect, it } from 'vitest';
import { montarClientesRecuperacao } from './recuperacaoQuebrados';

const base = { acordo_id: 'a', valor_parcela: 100, cliente_cpf: '1', empresa: 'odres_cred' };

describe('montarClientesRecuperacao', () => {
  it('envia uma única mensagem por telefone, com o vencimento mais recente', () => {
    const r = montarClientesRecuperacao([
      { ...base, data_prevista: '2026-10-10', cliente_nome: 'JOAO SILVA', cliente_telefone: '62999998888' },
      { ...base, data_prevista: '2026-10-25', cliente_nome: 'JOAO SILVA', cliente_telefone: '5562999998888' },
    ]);
    expect(r.length).toBe(1);
    expect(r[0].vars['3']).toBe('25/10/2026');
    expect(r[0].vars.name).toBe('Joao');
    expect(r[0].vars['2']).toBe('Odres Cred');
  });

  it('ignora telefones inválidos', () => {
    const r = montarClientesRecuperacao([{ ...base, data_prevista: '2026-10-25', cliente_nome: 'X', cliente_telefone: '123' }]);
    expect(r.length).toBe(0);
  });
});

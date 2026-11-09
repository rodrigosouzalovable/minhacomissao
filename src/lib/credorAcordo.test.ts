import { describe, expect, it } from 'vitest';
import { aplicarCredorDoAcordo } from '../../supabase/functions/_shared/credor-acordo';

describe('credor do acordo prevalece na campanha', () => {
  it('acordo Novo Mundo sai como NOVO MUNDO mesmo com planilha UME', () => {
    const r = aplicarCredorDoAcordo({ credor: 'ume', vars: { '1': 'Weder', '2': 'UME', '3': 'amanhã' } }, 'ume_novo_mundo');
    expect(r.credor).toBe('novo_mundo');
    expect(r.vars).toEqual({ '1': 'Weder', '2': 'NOVO MUNDO', '3': 'amanhã' });
  });
  it('acordo UME sai como UME', () => {
    const r = aplicarCredorDoAcordo({ credor: 'novo_mundo', vars: { '2': 'NOVO MUNDO' } }, 'mundo_da_moda');
    expect(r.credor).toBe('ume');
    expect(r.vars?.['2']).toBe('UME');
  });
  it('acordo Odres sai como ODRES CRED', () => {
    const r = aplicarCredorDoAcordo({ credor: 'ume', vars: { '2': 'ume' } }, 'odres_cred');
    expect(r.credor).toBe('odres_cred');
    expect(r.vars?.['2']).toBe('ODRES CRED');
  });
  it('sem acordo ativo mantém o que veio', () => {
    const item = { credor: 'ume', vars: { '2': 'UME' } };
    expect(aplicarCredorDoAcordo(item, null)).toBe(item);
  });
});

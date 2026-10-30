import { describe, it, expect, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
import { decidirCredor } from './credorPorCpf';

describe('decidirCredor', () => {
  it('marca UME quando só está na carteira UME', () => {
    const r = decidirCredor(['mundo_da_moda']);
    expect(r.tipo === 'unico' && r.empresa).toBe('mundo_da_moda');
  });
  it('marca ODRES CRED quando só está na carteira Odres', () => {
    const r = decidirCredor(['odres_cred']);
    expect(r.tipo === 'unico' && r.empresa).toBe('odres_cred');
  });
  it('não marca quando está em mais de um credor', () => {
    expect(decidirCredor(['odres_cred', 'ume_novo_mundo']).tipo).toBe('ambiguo');
  });
  it('não marca quando não encontra', () => {
    expect(decidirCredor([]).tipo).toBe('nenhum');
  });
});

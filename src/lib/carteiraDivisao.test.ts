import { describe, it, expect } from 'vitest';
import { dividirNumeros } from '../../supabase/functions/_shared/carteira-divisao';

const ids = Array.from({ length: 70 }, (_, i) => `id${String(i).padStart(2, '0')}`);

describe('divisão de números entre UME e Odres Cred', () => {
  it('nenhum número fica nas duas campanhas e todos são usados', () => {
    const d = dividirNumeros(ids, 3000, 4000);
    expect(d.ume.filter((i) => d.odres_cred.includes(i))).toHaveLength(0);
    expect(d.ume.length + d.odres_cred.length).toBe(70);
  });
  it('proporcional ao volume: 3.000 UME e 4.000 Odres em 70 números = 30 e 40', () => {
    const d = dividirNumeros(ids, 3000, 4000);
    expect(d.ume).toHaveLength(30);
    expect(d.odres_cred).toHaveLength(40);
  });
  it('credor sem clientes não recebe números', () => {
    expect(dividirNumeros(ids, 0, 500).odres_cred).toHaveLength(70);
    expect(dividirNumeros(ids, 500, 0).odres_cred).toHaveLength(0);
  });
  it('volume pequeno ainda garante ao menos um número para cada credor', () => {
    const d = dividirNumeros(ids, 6990, 10);
    expect(d.odres_cred).toHaveLength(1);
  });
});

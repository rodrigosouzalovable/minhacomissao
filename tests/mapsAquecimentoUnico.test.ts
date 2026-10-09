import { describe, expect, it } from 'bun:test';
import { filtrarMapsIneditos, reservarMapsAquecimentoUnico } from '../supabase/functions/_shared/maps-aquecimento-unico';

describe('Google Maps sem repetição no reaquecimento', () => {
  it('reserva o sufixo global uma vez mesmo em outra instância', async () => {
    const consumidos = new Set<string>();
    const db = { rpc: async (_: string, args: { p_sufixo: string }) => {
      const livre = !consumidos.has(args.p_sufixo);
      consumidos.add(args.p_sufixo);
      return { data: livre, error: null };
    } };
    expect(await reservarMapsAquecimentoUnico(db, 'instancia-A', '+55 (62) 98218-3144')).toBe(true);
    expect(await reservarMapsAquecimentoUnico(db, 'instancia-B', '5562982183144')).toBe(false);
  });
  it('não envia após reserva inconclusiva', async () => {
    const db = { rpc: async () => ({ data: true, error: new Error('timeout') }) };
    expect(await reservarMapsAquecimentoUnico(db, 'A', '5562982183144')).toBe(false);
  });
  it('rejeita telefone incompleto sem chamar reserva', async () => {
    const db = { rpc: async () => { throw new Error('não deveria consultar'); } };
    expect(await reservarMapsAquecimentoUnico(db, 'A', '3144')).toBe(false);
  });
  it('remove permanentemente usados e mantém inéditos sem limite de dias', async () => {
    const db = { from: () => ({ select: () => ({ in: async () => ({
      data: [{ telefone_sufixo: '82183144' }], error: null,
    }) }) }) };
    expect(await filtrarMapsIneditos(db, [
      { telefone: '5562982183144' }, { telefone: '5562982189999' },
    ])).toEqual([{ telefone: '5562982189999' }]);
  });
  it('não libera candidatos quando histórico não pode ser consultado', async () => {
    const db = { from: () => ({ select: () => ({ in: async () => ({ data: null, error: 'timeout' }) }) }) };
    expect(await filtrarMapsIneditos(db, [{ telefone: '5562982189999' }])).toEqual([]);
  });
});
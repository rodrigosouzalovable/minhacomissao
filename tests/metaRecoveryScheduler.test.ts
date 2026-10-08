import { describe, expect, it } from 'bun:test';
import { schedulerAutorizado } from '../supabase/functions/meta-recuperacao-tick/scheduler-auth';
describe('autorização restrita da recuperação automática', () => {
  const db = (data: unknown, error: unknown = null) => ({ rpc: async () => ({ data, error }) });
  it('aceita credencial confirmada para execução automática', async () => {
    expect(await schedulerAutorizado(db(true), 'test-only', {})).toBe(true);
  });
  it('recusa credencial ausente ou não reconhecida', async () => {
    expect(await schedulerAutorizado(db(true), '', {})).toBe(false);
    expect(await schedulerAutorizado(db(false), 'test-only', {})).toBe(false);
  });
  it('recusa consulta inconclusiva', async () => {
    expect(await schedulerAutorizado(db(true, { message: 'offline' }), 'test-only', {})).toBe(false);
  });
  it('não concede comandos administrativos', async () => {
    for (const body of [{ forcar: true }, { simulacao: true }, { instancia_id: 'test-id' }]) {
      expect(await schedulerAutorizado(db(true), 'test-only', body)).toBe(false);
    }
  });
});
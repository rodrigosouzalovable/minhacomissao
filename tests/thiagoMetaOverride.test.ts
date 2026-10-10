import { describe, expect, it } from 'bun:test';
import { instanciasLiberadasThiago, THIAGO_NOGUEIRA_USER_ID } from '../supabase/functions/_shared/thiago-meta-override';

function client(partner: boolean, ids: string[], fail = false) {
  return { from(table: string) {
    const query = {
      select() { return query; }, eq() { return query; },
      async maybeSingle() { return { data: { parceiro_meta: partner }, error: fail ? 'failed' : null }; },
      async in() { return { data: ids.map(instancia_id => ({ instancia_id })), error: fail ? 'failed' : null }; },
    };
    if (!['user_permissions', 'meta_instance_parceiros'].includes(table)) throw new Error('Unexpected table');
    return query;
  } };
}

describe('Thiago linked-instance exception', () => {
  it('includes only linked requested instances', async () => {
    expect([...await instanciasLiberadasThiago(client(true, ['own', 'other-linked']), THIAGO_NOGUEIRA_USER_ID, ['own', 'foreign'])]).toEqual(['own']);
  });
  it('does not authorize another partner', async () => {
    expect((await instanciasLiberadasThiago(client(true, ['own']), 'another-user', ['own'])).size).toBe(0);
  });
  it('requires the partner permission to remain active', async () => {
    expect((await instanciasLiberadasThiago(client(false, ['own']), THIAGO_NOGUEIRA_USER_ID, ['own'])).size).toBe(0);
  });
  it('fails closed on permission or linkage query errors', async () => {
    expect((await instanciasLiberadasThiago(client(true, ['own'], true), THIAGO_NOGUEIRA_USER_ID, ['own'])).size).toBe(0);
  });
  it('never authorizes a signed-out request', async () => {
    expect((await instanciasLiberadasThiago(client(true, ['own']), null, ['own'])).size).toBe(0);
  });
});
import { expect, test } from 'bun:test';
import { admitTemplateInstances } from '../supabase/functions/_shared/meta-template-admission';
import { applyManualTemplate } from '../src/lib/metaManualTemplateApplication';

function fixture(status = 'FALHA_ENVIO', slot = 'reserved') {
  const calls: Array<{ name: string; args: any }> = [];
  const rows = new Map<string, any>([['closed', { id: 'closed', status, agendado_para: '2026-10-12T18:00:00Z' }]]);
  const db = {
    rpc: async (name: string, args: any) => {
      calls.push({ name, args });
      if (name === 'claim_meta_template_pacing') return { error: null, data:
        args.p_instancia_id === 'first' ? { allowed: true, token: 'first-lease' } :
        args.p_instancia_id === 'quota' ? { allowed: true, token: 'quota-lease' } :
        { allowed: false, next_allowed_at: '2026-10-12T18:05:00Z' } };
      if (name === 'reserve_tier_250_template_slot') return { error: null, data: args.p_instancia_id === 'quota' ? slot : 'reserved' };
      return { error: null, data: null };
    },
    from: () => {
      let id = '';
      const chain: any = {
        upsert: async (row: any) => {
          if (!rows.has(row.instancia_id)) rows.set(row.instancia_id, { id: row.instancia_id, ...row });
          return { error: null };
        },
        select: () => chain,
        eq: (key: string, value: string) => { if (key === 'instancia_id') id = value; return chain; },
        single: async () => ({ error: null, data: rows.get(id) }),
        update: () => chain,
        lte: async () => ({ error: null }),
      };
      return chain;
    },
  };
  return { db, calls, rows };
}

for (const status of ['FALHA_ENVIO', 'CANCELADO']) {
  test(`a ${status} queue row fails only its number and preserves admitted peers`, async () => {
    const { db, calls, rows } = fixture(status);
    const results = await applyManualTemplate('m', ['first', 'closed', 'later'], async body => {
      const result = await admitTemplateInstances(db, body.instancia_ids.map(id => ({ id })), 'm', 'manual');
      expect(result.admitted.map(i => i.id)).toEqual(['first']);
      expect(result.tokens.get('first')).toBe('first-lease');
      return { success: true, instancias: result.admitted, adiadas: result.deferred, ignoradas: result.ignored };
    }, async () => {}, () => {});
    expect(results.map(r => r.status)).toEqual(['ENVIADO', 'FALHA_ENVIO', 'PENDENTE']);
    expect(rows.get('closed').status).toBe(status);
    expect(calls.filter(c => c.name === 'reserve_tier_250_template_slot').map(c => c.args.p_instancia_id)).toEqual(['first']);
    expect(calls.some(c => c.name === 'finish_meta_template_pacing')).toBe(false);
  });
}

test('quota deferral failure releases its lease without releasing another request slot', async () => {
  const { db, calls, rows } = fixture('CANCELADO', 'already_reserved');
  rows.set('quota', { id: 'quota', status: 'CANCELADO' });
  const result = await admitTemplateInstances(db, [{ id: 'quota' }, { id: 'first' }], 'm', 'manual');
  expect(result.admitted.map(i => i.id)).toEqual(['first']);
  expect(result.ignored.map(i => i.instancia_id)).toEqual(['quota']);
  expect(calls.filter(c => c.name === 'finish_meta_template_pacing').map(c => c.args.p_token)).toEqual(['quota-lease']);
  expect(calls.some(c => c.name === 'finish_tier_250_template_slot')).toBe(false);
});

test('a reservation read failure releases the current lease and continues', async () => {
  const { db, calls } = fixture();
  const rpc = db.rpc;
  db.rpc = async (name, args) => name === 'reserve_tier_250_template_slot' && args.p_instancia_id === 'quota'
    ? { error: new Error('slot read failed'), data: null } : rpc(name, args);
  const result = await admitTemplateInstances(db, [{ id: 'quota' }, { id: 'first' }], 'm', 'manual');
  expect(result.admitted.map(i => i.id)).toEqual(['first']);
  expect(result.ignored[0]?.motivo).toContain('slot read failed');
  expect(calls.filter(c => c.name === 'finish_meta_template_pacing').map(c => c.args.p_token)).toEqual(['quota-lease']);
});
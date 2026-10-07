import { afterEach, describe, expect, it } from 'bun:test';
import { revalidarPagamentoAntesDoAviso } from '../supabase/functions/_shared/meta-revalidar-pagamento';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const base = { id: 'inst', ativo: true, estado_pool: 'ativo', pool_fora_manual: false, pausa_automatica_motivo: null, saude_raw: {} };
function db(row: any) {
  const patches: any[] = [];
  let updating = false;
  const chain: any = {
    select: () => chain, eq: () => chain, is: () => chain,
    update: (patch: any) => { updating = true; patches.push(patch); return chain; },
    maybeSingle: async () => ({ data: updating ? { id: 'inst' } : row, error: null }),
  };
  return { client: { from: () => chain }, patches };
}
function response(blocked = false, info: string[] = []) {
  return { status: 'CONNECTED', quality_rating: 'GREEN', health_status: {
    can_send_message: 'AVAILABLE', entities: [
      { entity_type: 'BUSINESS', can_send_message: blocked ? 'BLOCKED' : 'AVAILABLE', additional_info: info },
      { entity_type: 'WABA', can_send_message: 'AVAILABLE' },
      { entity_type: 'PHONE_NUMBER', can_send_message: 'AVAILABLE' },
    ],
  } };
}
const credentials = { id: 'inst', phone_number_id: 'test', access_token: 'test-only' };

describe('Revalidação antes de notificar', () => {
  it('consulta antes do aviso e não alerta quando a Meta confirma disponibilidade', async () => {
    let calls = 0;
    globalThis.fetch = (async () => { calls++; return Response.json(response()); }) as typeof fetch;
    const { client, patches } = db({ ...base, estado_pool: 'restrita', pausa_automatica_motivo: 'Payment (#131042)' });
    const alerts: any[] = [];
    const result = await revalidarPagamentoAntesDoAviso(client, credentials, { notificar: async p => { alerts.push(p); } });
    expect(calls).toBe(1);
    expect(result.restringida).toBe(false);
    expect(alerts.length).toBe(0);
    expect(patches[0].estado_pool).toBe('ativo');
  });
  it('timeout protege o envio e não emite alerta de pagamento irregular', async () => {
    globalThis.fetch = (async () => { throw new Error('timeout'); }) as typeof fetch;
    const { client, patches } = db(base);
    const alerts: any[] = [];
    const result = await revalidarPagamentoAntesDoAviso(client, credentials, { notificar: async p => { alerts.push(p); } });
    expect(result.estado).toBe('nao_confirmado');
    expect(result.restringida).toBe(true);
    expect(patches[0].estado_pool).toBe('restrita');
    expect(alerts.length).toBe(0);
  });
  it('falta de permissão não confirma pendência de pagamento', async () => {
    globalThis.fetch = (async () => Response.json({ error: { message: 'permission denied' } }, { status: 403 })) as typeof fetch;
    const { client } = db(base);
    const alerts: any[] = [];
    const result = await revalidarPagamentoAntesDoAviso(client, credentials, { notificar: async p => { alerts.push(p); } });
    expect(result.estado).toBe('nao_confirmado');
    expect(result.restringida).toBe(true);
    expect(alerts.length).toBe(0);
  });
  it('pagamento persistente exige consulta positiva e chave de deduplicação', async () => {
    let consulted = false;
    globalThis.fetch = (async () => { consulted = true; return Response.json(response(true, ['Business eligibility payment issue (#131042)'])); }) as typeof fetch;
    const { client } = db(base);
    const alerts: any[] = [];
    await revalidarPagamentoAntesDoAviso(client, credentials, { notificar: async p => { expect(consulted).toBe(true); alerts.push(p); } });
    expect(alerts.length).toBe(1);
    expect(alerts[0].umaVezPorChave).toBe(true);
    expect(alerts[0].chaveIdempotencia).toBe(`meta_pagamento_confirmado_inst_${new Date().toISOString().slice(0, 10)}`);
  });
  it('reutiliza consulta recente sem novo acesso à Meta', async () => {
    let calls = 0;
    globalThis.fetch = (async () => { calls++; throw new Error('unexpected'); }) as typeof fetch;
    const { client } = db({ ...base, saude_raw: { pagamento_verificacao: { estado: 'confirmado', em: new Date().toISOString(), phone: response(), detalhe: 'available' } } });
    const result = await revalidarPagamentoAntesDoAviso(client, credentials);
    expect(calls).toBe(0);
    expect(result.restringida).toBe(false);
  });
});
import { describe, expect, it } from 'bun:test';
import { podeOferecerReativacao, motivoRecusaReativacao } from '../src/lib/metaInboxReactivation';
const inst = { id: 'a', ativo: true, provider: 'meta', estado_pool: 'restrita', saude_quality: 'RED' };
const health = { instancia_id: 'a', status: 'CONNECTED', phone_health: { can_send_message: 'AVAILABLE', entities: ['BUSINESS', 'WABA', 'PHONE_NUMBER'].map(entity_type => ({ entity_type, can_send_message: 'AVAILABLE' })) } };
describe('Reativação no Inbox', () => {
  it('oferece para RED e YELLOW fora do pool', () => {
    expect(podeOferecerReativacao(inst)).toBe(true);
    expect(podeOferecerReativacao({ ...inst, saude_quality: 'YELLOW' })).toBe(true);
  });
  it('não oferece para GREEN ou pool ativo', () => {
    expect(podeOferecerReativacao({ ...inst, saude_quality: 'GREEN' })).toBe(false);
    expect(podeOferecerReativacao({ ...inst, estado_pool: 'ativo' })).toBe(false);
  });
  it('preserva retirada manual e exclui UAZAPI', () => {
    expect(podeOferecerReativacao({ ...inst, pool_fora_manual: true })).toBe(false);
    expect(podeOferecerReativacao({ ...inst, provider: 'uazapi' })).toBe(false);
  });
  it('consulta incompleta nunca libera', () => {
    expect(motivoRecusaReativacao(null, 'a')).not.toBeNull();
    expect(motivoRecusaReativacao({ instancia_id: 'a', status: 'CONNECTED' }, 'a')).not.toBeNull();
  });
  it('limitação confirmada recusa', () => {
    expect(motivoRecusaReativacao({ ...health, phone_health: { ...health.phone_health, can_send_message: 'LIMITED' } }, 'a')).not.toBeNull();
  });
  it('somente saúde confirmada do número correto libera', () => {
    expect(motivoRecusaReativacao(health, 'a')).toBeNull();
    expect(motivoRecusaReativacao(health, 'b')).not.toBeNull();
  });
});

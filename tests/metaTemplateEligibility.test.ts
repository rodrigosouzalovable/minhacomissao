import { describe, expect, it } from 'bun:test';
import { metaMessagingRestriction, motivoBloqueioTemplate } from '../supabase/functions/_shared/meta-template-eligibility';

const instance = {
  ativo: true, provider: 'meta', waba_id: 'waba', access_token: 'test',
  saude_status: 'CONNECTED', saude_quality: 'UNKNOWN', qualidade_leitura_ok: true,
};
const paymentHealth = {
  can_send_message: 'BLOCKED',
  entities: [
    { entity_type: 'PHONE_NUMBER', can_send_message: 'LIMITED', additional_info: ['Your display name has not been approved yet.'] },
    { entity_type: 'WABA', can_send_message: 'BLOCKED', errors: [{ error_code: 141006, error_description: 'There is an error with the payment method.' }] },
  ],
};

describe('template health restrictions', () => {
  it('retains nested Meta payment code instead of masking it with WABA status', () => {
    expect(motivoBloqueioTemplate({ ...instance, saude_restricoes: { phone_health: paymentHealth } })).toContain('141006');
  });
  it('keeps pending display names informational when messaging remains available', () => {
    expect(motivoBloqueioTemplate({ ...instance, saude_restricoes: { phone_health: { entities: [paymentHealth.entities[0]] } } })).toBeNull();
  });
  it('detects payment errors inside WABA health response', () => {
    expect(metaMessagingRestriction({ saude_restricoes: { waba_health: paymentHealth } })).toContain('141006');
  });
  it('preserves unknown confirmed restrictions without inventing payment failure', () => {
    const result = metaMessagingRestriction({ saude_restricoes: { waba_health: { entities: [{ entity_type: 'WABA', can_send_message: 'BLOCKED', errors: [{ error_code: 999 }] }] } } });
    expect(result).toContain('999');
    expect(result).not.toContain('141006');
  });
  it('does not use SIP call errors to block templates', () => {
    expect(motivoBloqueioTemplate({ ...instance, saude_restricoes: { phone_health: { entities: [{ entity_type: 'APP', can_send_message: 'AVAILABLE', errors: [{ error_code: 138025 }] }] } } })).toBeNull();
  });
  it('does not infer current payment block from errors on available entity', () => {
    expect(metaMessagingRestriction({ saude_restricoes: { waba_health: { entities: [{ ...paymentHealth.entities[1], can_send_message: 'AVAILABLE' }] } } })).toBeNull();
  });
});
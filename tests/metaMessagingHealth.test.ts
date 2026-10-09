import { describe, expect, it } from 'bun:test';
import { classifyMessagingHealth, hasBan, isQualityOnlyHold } from '../supabase/functions/_shared/meta-messaging-health';

const commercial = [{ entity_type: 'WABA', can_send_message: 'AVAILABLE' }, { entity_type: 'BUSINESS', can_send_message: 'AVAILABLE' }];
const phone = { can_send_message: 'LIMITED', entities: [
  { entity_type: 'PHONE_NUMBER', can_send_message: 'LIMITED', additional_info: ["Your messaging limit will decrease if your quality rating doesn't improve"], errors: [{ error_code: 138024 }] },
  ...commercial, { entity_type: 'APP', can_send_message: 'AVAILABLE', errors: [{ error_code: 138025 }] },
] };
const waba = { can_send_message: 'AVAILABLE', entities: commercial };
describe('manual campaign messaging health', () => {
  it('recognizes Hospital Med quality/cota advisory without treating SIP as a messaging block', () => {
    expect(classifyMessagingHealth(phone, waba)).toEqual({ restriction: null, qualityLimited: true, confirmed: true });
  });
  it('allows available messaging independently of RED/YELLOW color', () => {
    expect(classifyMessagingHealth({ entities: [{ entity_type: 'PHONE_NUMBER', can_send_message: 'AVAILABLE' }, ...commercial] }, waba).confirmed).toBe(true);
  });
  for (const state of ['BLOCKED', 'RESTRICTED', 'UNAVAILABLE']) {
    for (const type of ['PHONE_NUMBER', 'WABA', 'BUSINESS']) {
      it(`preserves ${state} at ${type} even with a quality advisory`, () => {
        const result = classifyMessagingHealth(phone, { entities: [...commercial, { entity_type: type, can_send_message: state }] });
        expect(result.confirmed).toBe(false);
        expect(result.restriction).toContain(state);
      });
    }
  }
  it('keeps payment error 141006 actionable', () => {
    expect(classifyMessagingHealth(phone, { entities: [{ entity_type: 'WABA', can_send_message: 'BLOCKED', errors: [{ error_code: 141006 }] }] }).restriction).toContain('141006');
  });
  it('does not release unknown LIMITED', () => {
    expect(classifyMessagingHealth({ entities: [{ entity_type: 'PHONE_NUMBER', can_send_message: 'LIMITED' }, ...commercial] }, waba).confirmed).toBe(false);
  });
  it('does not release after an incomplete query', () => {
    expect(classifyMessagingHealth(phone, null).confirmed).toBe(false);
  });
  it('never classifies a simultaneous security hold as quality only', () => {
    expect(isQualityOnlyHold('quality=RED ACCOUNT_VIOLATION:SPAM')).toBe(false);
    expect(isQualityOnlyHold('ACCOUNT_VIOLATION:SPAM')).toBe(false);
    expect(isQualityOnlyHold('Restrição de qualidade/reputação confirmada pela Meta')).toBe(true);
    expect(hasBan({ ban_state: 'BANNED' })).toBe(true);
    expect(hasBan({})).toBe(false);
  });
  it('rejects mixed quality and spam details', () => {
    expect(classifyMessagingHealth({ ...phone, entities: [{ ...phone.entities[0], additional_info: ["Your messaging limit will decrease if your quality rating doesn't improve", 'SPAM restriction'] }, ...commercial] }, waba).confirmed).toBe(false);
  });
  it('preserves informational pending name but not mixed name/payment restriction', () => {
    const name = { ...phone.entities[0], additional_info: ['Your display name has not been approved yet.'] };
    expect(classifyMessagingHealth({ ...phone, entities: [name, ...commercial] }, waba).confirmed).toBe(true);
    expect(classifyMessagingHealth({ ...phone, entities: [{ ...name, additional_info: [...name.additional_info, 'Payment blocked'] }, ...commercial] }, waba).confirmed).toBe(false);
  });
});
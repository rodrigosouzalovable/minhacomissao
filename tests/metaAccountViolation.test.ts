import { describe, expect, it } from 'bun:test';
import { accountViolationHealthConfirmed, accountViolationReleasable } from '../supabase/functions/_shared/meta-account-violation';
const entity = (entity_type: string, id: string, can_send_message = 'AVAILABLE', additional_info: string[] = []) => ({ entity_type, id, can_send_message, additional_info });
const detail = 'Your display name has not been approved yet. Your message limit will increase after the display name is approved.';
const phone = { can_send_message: 'LIMITED', entities: [entity('PHONE_NUMBER', 'p', 'LIMITED', [detail]), entity('WABA', 'w'), entity('BUSINESS', 'b'), entity('APP', 'a')] };
const waba = { can_send_message: 'AVAILABLE', entities: [entity('WABA', 'w'), entity('BUSINESS', 'b')] };
const eligible = { status: 'CONNECTED', quality: 'UNKNOWN', banInfo: null, graphOk: true, quarantineActive: false, recoveryActive: false, healthConfirmed: true };
describe('Account violation revalidation', () => {
  it('allows only informative name approval limits with explicit GREEN/UNKNOWN', () => {
    expect(accountViolationHealthConfirmed(phone, waba, 'p', 'w')).toBe(true);
    expect(accountViolationReleasable(eligible)).toBe(true);
    expect(accountViolationReleasable({ ...eligible, quality: 'GREEN' })).toBe(true);
    for (const quality of ['RED', 'YELLOW', '', null]) expect(accountViolationReleasable({ ...eligible, quality })).toBe(false);
  });
  it('rejects incomplete health and mismatched number or WABA', () => {
    expect(accountViolationHealthConfirmed(phone, null, 'p', 'w')).toBe(false);
    expect(accountViolationHealthConfirmed(phone, waba, 'other', 'w')).toBe(false);
    expect(accountViolationHealthConfirmed(phone, waba, 'p', 'other')).toBe(false);
    expect(accountViolationHealthConfirmed({ ...phone, entities: phone.entities.filter(e => e.entity_type !== 'BUSINESS') }, { can_send_message: 'AVAILABLE', entities: [entity('WABA', 'w')] }, 'p', 'w')).toBe(false);
  });
  it('never waives real restrictions or mixed spam/name details', () => {
    for (const type of ['PHONE_NUMBER', 'WABA', 'BUSINESS', 'APP']) expect(accountViolationHealthConfirmed({ ...phone, entities: phone.entities.map(e => e.entity_type === type ? { ...e, can_send_message: 'BLOCKED' } : e) }, waba, 'p', 'w')).toBe(false);
    expect(accountViolationHealthConfirmed({ ...phone, entities: [entity('PHONE_NUMBER', 'p', 'LIMITED', [detail, 'SPAM restriction']), ...phone.entities.slice(1)] }, waba, 'p', 'w')).toBe(false);
    expect(accountViolationHealthConfirmed(phone, { ...waba, can_send_message: 'LIMITED' }, 'p', 'w')).toBe(false);
  });
  it('preserves bans, failed checks, quarantines and recovery', () => {
    for (const patch of [{ banInfo: { reason: 'SPAM' } }, { graphOk: false }, { quarantineActive: true }, { recoveryActive: true }, { healthConfirmed: false }, { status: 'BANNED' }]) expect(accountViolationReleasable({ ...eligible, ...patch })).toBe(false);
  });
});

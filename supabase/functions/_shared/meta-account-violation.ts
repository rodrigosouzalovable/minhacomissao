type Entity = { entity_type?: string; id?: string; can_send_message?: string; additional_info?: unknown[] };
type Health = { can_send_message?: string; entities?: Entity[] };
const state = (value: unknown) => String(value || '').toUpperCase();
function nameOnly(e: Entity): boolean {
  return state(e.can_send_message) === 'LIMITED' && Array.isArray(e.additional_info) && e.additional_info.length > 0 && e.additional_info.every(detail => {
    const text = String(detail || '');
    return /display name.*not.*approved|nome de exibição.*não.*aprovado/i.test(text) && !/spam|violation|reputation|quality|payment|billing|locked|suspended/i.test(text);
  });
}
export function accountViolationHealthConfirmed(phone: Health | null | undefined, waba: Health | null | undefined, phoneId: string, wabaId: string): boolean {
  if (!phone || !waba || !phoneId || !wabaId) return false;
  const phoneEntities = Array.isArray(phone.entities) ? phone.entities : [];
  const entities = [...phoneEntities, ...(Array.isArray(waba.entities) ? waba.entities : [])];
  const target = phoneEntities.filter(e => state(e.entity_type) === 'PHONE_NUMBER' && String(e.id) === phoneId);
  const wabas = entities.filter(e => state(e.entity_type) === 'WABA');
  const businesses = entities.filter(e => state(e.entity_type) === 'BUSINESS');
  return target.length > 0 && target.every(e => state(e.can_send_message) === 'AVAILABLE' || nameOnly(e)) &&
    (state(phone.can_send_message) === 'AVAILABLE' || (state(phone.can_send_message) === 'LIMITED' && target.some(nameOnly))) &&
    state(waba.can_send_message) === 'AVAILABLE' && wabas.some(e => String(e.id) === wabaId) &&
    wabas.every(e => state(e.can_send_message) === 'AVAILABLE') && businesses.length > 0 && businesses.every(e => state(e.can_send_message) === 'AVAILABLE') &&
    entities.every(e => state(e.can_send_message) === 'AVAILABLE' || (state(e.entity_type) === 'PHONE_NUMBER' && String(e.id) === phoneId && nameOnly(e)));
}
export function accountViolationReleasable(input: { status: unknown; quality: unknown; banInfo: unknown; graphOk: boolean; quarantineActive: boolean; recoveryActive: boolean; healthConfirmed: boolean }): boolean {
  const noBan = input.banInfo == null || (typeof input.banInfo === 'object' && !Array.isArray(input.banInfo) && Object.keys(input.banInfo).length === 0);
  return input.graphOk && state(input.status) === 'CONNECTED' && ['GREEN', 'UNKNOWN'].includes(state(input.quality)) && noBan && !input.quarantineActive && !input.recoveryActive && input.healthConfirmed;
}

type HealthEntity = { entity_type?: string; can_send_message?: string; additional_info?: unknown[]; errors?: { error_code?: number }[] };
type Health = { can_send_message?: string; entities?: HealthEntity[] } | null | undefined;
const blocked = new Set(['BLOCKED', 'RESTRICTED', 'UNAVAILABLE']);
const relevant = new Set(['PHONE_NUMBER', 'WABA', 'BUSINESS', 'APP']);

// Consume only known complete advisories, including Meta's concatenated name/quality text.
// Unknown trailing text, non-SIP errors and empty details remain restrictions.
function informationalAdvisory(entity: HealthEntity): { quality: boolean; name: boolean } | null {
  if (entity.entity_type !== 'PHONE_NUMBER' || entity.can_send_message !== 'LIMITED' ||
      !Array.isArray(entity.additional_info) || entity.additional_info.length === 0 ||
      !(entity.errors || []).every(error => [138024, 138025].includes(Number(error.error_code)))) return null;
  const patterns = [
    { kind: 'quality', expression: /^Your messaging limit will decrease if your quality rating doesn['’]t improve(?:[.!](?=\s|$)|(?=$))/i },
    { kind: 'quality', expression: /^Your customers were blocking your phone number\. If your quality rating doesn['’]t improve, you will not be able to increase your messaging limit(?:[.!](?=\s|$)|(?=$))/i },
    { kind: 'name', expression: /^Your display name has not been approved yet\.(?: Your message limit will increase after the display name is approved\.)?/i },
  ];
  let quality = false;
  let name = false;
  for (const info of entity.additional_info) {
    if (typeof info !== 'string' || !info.trim()) return null;
    let remaining = info.trim();
    while (remaining) {
      const matched = patterns.map(pattern => ({ ...pattern, match: remaining.match(pattern.expression) }))
        .find(pattern => pattern.match);
      if (!matched?.match) return null;
      quality ||= matched.kind === 'quality';
      name ||= matched.kind === 'name';
      remaining = remaining.slice(matched.match[0].length).trim();
    }
  }
  return { quality, name };
}

function qualityAdvisory(entity: HealthEntity): boolean {
  return informationalAdvisory(entity)?.quality === true;
}

function nameAdvisory(entity: HealthEntity): boolean {
  return informationalAdvisory(entity)?.name === true;
}

export function classifyMessagingHealth(phone: Health, waba: Health) {
  let restriction: string | null = null;
  let qualityLimited = false;
  const entities = [phone, waba].flatMap(h => Array.isArray(h?.entities) ? h.entities : []);
  const commercialAvailable = ['WABA', 'BUSINESS'].every(type => entities.some(e => e.entity_type === type && e.can_send_message === 'AVAILABLE'));
  for (const h of [phone, waba]) {
    for (const e of h?.entities || []) {
      if (!relevant.has(String(e.entity_type))) continue;
      const state = String(e.can_send_message || '').toUpperCase();
      if (state === 'LIMITED' && qualityAdvisory(e) && commercialAvailable) { qualityLimited = true; continue; }
      if (state === 'LIMITED' && nameAdvisory(e) && commercialAvailable) continue;
      if (blocked.has(state) || state === 'LIMITED') {
        const codes = (e.errors || []).filter(error => ![138024, 138025].includes(Number(error.error_code))).map(error => error.error_code).join(', ');
        restriction = `Restrição de mensagens na ${e.entity_type} confirmada pela Meta (${state}${codes ? `; código ${codes}` : ''})`;
      }
    }
    const root = String(h?.can_send_message || '').toUpperCase();
    if (blocked.has(root) || (root === 'LIMITED' && !(h?.entities?.some(e => qualityAdvisory(e) || nameAdvisory(e)) && commercialAvailable))) {
      restriction ||= `Restrição de mensagens confirmada pela Meta (${root})`;
    }
  }
  // Missing either response is never positive confirmation for clearing a hold.
  const complete = [phone, waba].every(h => !!h && Array.isArray(h.entities) && h.entities.length > 0) &&
    entities.some(e => e.entity_type === 'PHONE_NUMBER' && ['AVAILABLE', 'LIMITED'].includes(String(e.can_send_message))) && commercialAvailable;
  return { restriction, qualityLimited: qualityLimited && !restriction && complete, confirmed: complete && !restriction };
}

export function isQualityOnlyHold(reason: unknown): boolean {
  return /^quality=(YELLOW|RED)( em irmão)?$|^Restrição de qualidade\/reputação confirmada pela Meta$|^Aviso de qualidade\/cota da Meta — o limite poderá diminuir se a qualidade não melhorar; não é bloqueio total$/i.test(String(reason || ''));
}

export function hasBan(info: unknown): boolean {
  return !!info && (typeof info !== 'object' || Object.keys(info).length > 0);
}
type HealthEntity = { entity_type?: string; can_send_message?: string; additional_info?: unknown[]; errors?: { error_code?: number }[] };
type Health = { can_send_message?: string; entities?: HealthEntity[] } | null | undefined;
const blocked = new Set(['BLOCKED', 'RESTRICTED', 'UNAVAILABLE']);
const relevant = new Set(['PHONE_NUMBER', 'WABA', 'BUSINESS', 'APP']);

// Only this explicit advisory is informational; quality color alone is not evidence.
function qualityAdvisory(entity: HealthEntity): boolean {
  return entity.entity_type === 'PHONE_NUMBER' && entity.can_send_message === 'LIMITED' &&
    Array.isArray(entity.additional_info) && entity.additional_info.length > 0 &&
    entity.additional_info.every(info => /^Your messaging limit will decrease if your quality rating doesn.t improve[.!]?$/i.test(String(info).trim())) &&
    (entity.errors || []).every(error => [138024, 138025].includes(Number(error.error_code)));
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
      if (blocked.has(state) || state === 'LIMITED') {
        const codes = (e.errors || []).filter(error => ![138024, 138025].includes(Number(error.error_code))).map(error => error.error_code).join(', ');
        restriction = `Restrição de mensagens na ${e.entity_type} confirmada pela Meta (${state}${codes ? `; código ${codes}` : ''})`;
      }
    }
    const root = String(h?.can_send_message || '').toUpperCase();
    if (blocked.has(root) || (root === 'LIMITED' && !(h?.entities?.some(qualityAdvisory) && commercialAvailable))) {
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
export const NOVO_MUNDO_3144_INSTANCE_ID = 'b103ac3e-5781-47c4-8e11-24a323f5f0ee';

export function isNovoMundo3144(instanciaId: unknown): boolean {
  return String(instanciaId || '') === NOVO_MUNDO_3144_INSTANCE_ID;
}

export function isNovoMundo3144Connected(instancia: { id?: unknown; saude_status?: unknown; status?: unknown }): boolean {
  const status = String(instancia.saude_status || instancia.status || '').toUpperCase();
  return isNovoMundo3144(instancia.id) && status === 'CONNECTED';
}

export function isDisplayNameOrQualityRestriction(reason: unknown): boolean {
  return /nome de exibição|display name|quality=|qualidade|reputation/i.test(String(reason || ''));
}
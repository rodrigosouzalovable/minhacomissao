// Respostas a lembretes de pagamento ficam sempre com o admin (RODRIGO RIBEIRO DE SOUZA).
export const ETIQUETA_RODRIGO_ID = '03a9298c-f201-4b4a-ab05-f6e6cafa4116';

export function ehTemplateLembrete(template: string | null | undefined): boolean {
  const t = String(template || '').toLowerCase();
  if (!t) return false;
  return t.includes('lembrete') || t.startsWith('nova_parcela_vencida') || t === 'colchao_vencido';
}

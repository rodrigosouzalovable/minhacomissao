// Distribution is not permission to send messages with the resulting category.
export function podeDistribuirModelo(mestre: { categoria?: string; criado_por?: string | null; reclassificado_marketing?: boolean }, owner: string | null, automatic = false): boolean {
  return !!owner && mestre.criado_por === owner &&
    (automatic ? String(mestre.categoria).toUpperCase() === 'UTILITY' : ['UTILITY', 'MARKETING'].includes(String(mestre.categoria).toUpperCase()));
}

export function preservarSubmissao(status: unknown): boolean {
  return ['APPROVED', 'PENDING', 'IN_APPEAL', 'PENDING_DELETION'].includes(String(status || '').toUpperCase());
}

export function registroReclassificacao() {
  // Keep the user's distribution selection; never enable lead messaging.
  return { reclassificado_marketing: true, categoria_meta: 'MARKETING', usar_em_leads: false };
}
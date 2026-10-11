import { isInternalSlotFailure } from './meta-template-completion.ts';
export function queueRecoveryDecision(row?: { status: string; motivo?: string | null }) {
  if (!row) return 'new';
  if (['PENDENTE', 'ENVIADO', 'APPROVED'].includes(row.status.toUpperCase())) return 'active';
  return isInternalSlotFailure(row.motivo) ? 'recover' : 'terminal';
}
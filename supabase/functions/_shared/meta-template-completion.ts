export const templateKey = (name: string, language?: string | null) => `${name}|${language || 'pt_BR'}`;

export async function readAllTemplateRows<T = any>(query: () => any): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await query().order('id').range(offset, offset + 999);
    if (error) throw error;
    rows.push(...(data || []));
    if ((data || []).length < 1000) return rows;
  }
}

export function approvedOwnerModels<T extends { nome: string; idioma?: string | null; categoria: string; criado_por: string | null }>(
  masters: T[], copies: Array<{ instancia_id: string; nome_template: string; idioma?: string | null; status: string; categoria: string }>, owners: Map<string, string>,
): T[] {
  const approved = new Set(copies.filter(c => c.status.toUpperCase() === 'APPROVED' && c.categoria.toUpperCase() === 'UTILITY')
    .map(c => `${owners.get(c.instancia_id)}|${templateKey(c.nome_template, c.idioma)}`));
  return masters.filter(m => m.criado_por && m.categoria.toUpperCase() === 'UTILITY' && approved.has(`${m.criado_por}|${templateKey(m.nome, m.idioma)}`));
}

export const isInternalSlotFailure = (reason: unknown) => String(reason || '').includes('meta_template_daily_reservations_slot_check');

export function nextTemplateDay(now = new Date()): Date {
  const brt = new Date(now.getTime() - 3 * 3600_000);
  brt.setUTCDate(brt.getUTCDate() + 1);
  brt.setUTCHours(0, 0, 0, 0);
  return new Date(brt.getTime() + 3 * 3600_000);
}
/** ENVIADO/PENDING without a Meta id that is older than 12h and absent from a fresh Meta read never reached Meta. */
export function isGhostSubmission(row: { status?: string | null; meta_template_id?: string | null; atualizado_em?: string | null } | null | undefined, realExists: boolean, now = Date.now()): boolean {
  if (!row || realExists || row.meta_template_id) return false;
  if (!["ENVIADO", "PENDING"].includes(String(row.status || "").toUpperCase())) return false;
  const t = row.atualizado_em ? new Date(row.atualizado_em).getTime() : NaN;
  return Number.isFinite(t) && now - t > 12 * 3600_000;
}

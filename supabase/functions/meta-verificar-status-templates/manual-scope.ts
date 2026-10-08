export const MANUAL_BATCH_SIZE = 5;

export function manualInstanceIds(rows: Array<{ id: string; user_id: string; ativo: boolean; provider: string; saude_status: string }>, owner: string): string[] {
  return rows.filter(row => row.user_id === owner && row.ativo && row.provider === 'meta' && row.saude_status === 'CONNECTED').map(row => row.id);
}

export function validManualBatch(ids: unknown): ids is string[] {
  return Array.isArray(ids) && ids.length > 0 && ids.length <= MANUAL_BATCH_SIZE &&
    new Set(ids).size === ids.length && ids.every(id => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id));
}
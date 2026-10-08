// Scheduler credentials authorize normal runs, never administrator overrides.
export async function schedulerAutorizado(
  db: { rpc: (name: string, args: { p_token: string }) => PromiseLike<{ data: unknown; error: unknown }> },
  token: string,
  body: { forcar?: boolean; simulacao?: boolean; instancia_id?: string },
): Promise<boolean> {
  if (!token || body.forcar || body.simulacao || body.instancia_id) return false;
  const { data, error } = await db.rpc('meta_recuperacao_scheduler_autorizado', { p_token: token });
  return !error && data === true;
}
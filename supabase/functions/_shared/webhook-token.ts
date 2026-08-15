// Resolve o Verify Token do webhook por instância.
// - Instância vinculada a um parceiro (meta_instance_parceiros) → token pessoal dele.
// - Demais instâncias → token global (meta_whatsapp_config.webhook_verify_token).

export type TokenResolver = {
  global: string | null;
  /** Token a usar para a instância informada. */
  paraInstancia: (instanciaId: string) => string | null;
  /** true quando a instância usa token de parceiro. */
  ehParceiro: (instanciaId: string) => boolean;
};

export async function criarTokenResolver(supabase: any): Promise<TokenResolver> {
  const [{ data: cfg }, { data: vinculos }, { data: tokens }] = await Promise.all([
    supabase.from('meta_whatsapp_config').select('valor').eq('chave', 'webhook_verify_token').maybeSingle(),
    supabase.from('meta_instance_parceiros').select('instancia_id, user_id'),
    supabase.from('meta_webhook_tokens').select('user_id, token'),
  ]);

  const global: string | null = cfg?.valor ?? null;
  const porUser = new Map<string, string>();
  for (const t of tokens || []) porUser.set(t.user_id, t.token);

  const porInstancia = new Map<string, string>();
  for (const v of vinculos || []) {
    const tk = porUser.get(v.user_id);
    if (tk) porInstancia.set(v.instancia_id, tk);
  }

  return {
    global,
    paraInstancia: (id: string) => porInstancia.get(id) ?? global,
    ehParceiro: (id: string) => porInstancia.has(id),
  };
}

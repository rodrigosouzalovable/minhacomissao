export const THIAGO_NOGUEIRA_USER_ID = 'a3e72fe9-5522-42ce-a0ce-fc1113a45f20';

export async function instanciasLiberadasThiago(
  supabase: any,
  userId: string | null | undefined,
  instanciaIds: string[],
): Promise<Set<string>> {
  if (userId !== THIAGO_NOGUEIRA_USER_ID || instanciaIds.length === 0) return new Set();

  const [{ data: permissao }, { data: vinculos }] = await Promise.all([
    supabase
      .from('user_permissions')
      .select('parceiro_meta')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('meta_instance_parceiros')
      .select('instancia_id')
      .eq('user_id', userId)
      .in('instancia_id', instanciaIds),
  ]);

  if (permissao?.parceiro_meta !== true) return new Set();
  return new Set((vinculos || []).map((row: any) => String(row.instancia_id)));
}
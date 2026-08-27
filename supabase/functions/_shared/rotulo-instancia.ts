// Rótulo legível de uma instância Meta para uso em notificações.
// Evita expor o UUID interno quando existe nome/telefone cadastrado.
export function rotuloInstancia(inst: any): string {
  if (!inst) return 'desconhecida';
  const nome = (inst.nome || '').toString().trim();
  const verificado = (inst.meta_verified_name || '').toString().trim();
  const telefone = (inst.display_phone || '').toString().trim();
  const phoneId = (inst.phone_number_id || '').toString().trim();

  const principal = nome || telefone || verificado || (phoneId ? `Phone ID ${phoneId}` : '') || inst.id || 'desconhecida';
  const sufixo = verificado && verificado !== principal ? ` (${verificado})` : '';
  return `${principal}${sufixo}`;
}

/**
 * Linha "BM: <nome>" da Business Manager vinculada à instância.
 * Resolve por meta_bm_id e, como fallback, pelo business_id.
 */
export async function linhaBmInstancia(supabase: any, inst: any): Promise<string> {
  try {
    const bmId = (inst?.meta_bm_id || '').toString().trim();
    const businessId = (inst?.business_id || '').toString().trim();
    let nome = '';

    if (bmId) {
      const { data } = await supabase
        .from('meta_business_managers')
        .select('nome, business_id')
        .eq('id', bmId)
        .maybeSingle();
      nome = (data?.nome || '').toString().trim();
    }
    if (!nome && businessId) {
      const { data } = await supabase
        .from('meta_business_managers')
        .select('nome')
        .eq('business_id', businessId)
        .maybeSingle();
      nome = (data?.nome || '').toString().trim();
    }
    if (!nome && businessId) nome = `Business ID ${businessId}`;
    return `BM: *${nome || 'não vinculada'}*`;
  } catch (_) {
    return 'BM: *não vinculada*';
  }
}


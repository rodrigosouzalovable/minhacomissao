import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.88.0";

export type BloqueioBmResultado = {
  instanciaIds: string[];
  bmId: string | null;
  bmNome: string | null;
};

/**
 * Restringe somente o número que efetivamente recebeu #131031.
 * Outros números da mesma BM continuam elegíveis e são validados pela própria
 * tentativa de envio, evitando bloqueio coletivo baseado em um único erro.
 */
export async function restringirBmBloqueada(
  supabase: SupabaseClient,
  instancia: any,
  motivo: string,
): Promise<BloqueioBmResultado> {
  const bmId = instancia?.meta_bm_id ? String(instancia.meta_bm_id) : null;
  const ids = instancia?.id ? [String(instancia.id)] : [];
  let bmNome: string | null = null;

  if (bmId) {
    const { data: bm } = await supabase
      .from("meta_business_managers")
      .select("nome")
      .eq("id", bmId)
      .maybeSingle();
    bmNome = bm?.nome || null;
  }

  if (ids.length > 0) {
    await supabase.from("meta_whatsapp_instances").update({
      estado_pool: "restrita",
      pausa_automatica_ate: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      pausa_automatica_motivo: motivo,
    }).in("id", ids);
  }

  return { instanciaIds: ids, bmId, bmNome };
}
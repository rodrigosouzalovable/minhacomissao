import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.88.0";

export type BloqueioBmResultado = {
  instanciaIds: string[];
  bmId: string | null;
  bmNome: string | null;
};

/**
 * Restringe todos os números ligados à mesma BM da instância que recebeu #131031.
 * Se a instância antiga não tiver vínculo de BM, restringe somente ela.
 */
export async function restringirBmBloqueada(
  supabase: SupabaseClient,
  instancia: any,
  motivo: string,
): Promise<BloqueioBmResultado> {
  const bmId = instancia?.meta_bm_id ? String(instancia.meta_bm_id) : null;
  const businessId = instancia?.business_id ? String(instancia.business_id) : null;
  let ids = instancia?.id ? [String(instancia.id)] : [];
  let bmNome: string | null = null;

  if (bmId) {
    const [{ data: irmas }, { data: bm }] = await Promise.all([
      supabase.from("meta_whatsapp_instances").select("id").eq("meta_bm_id", bmId),
      supabase.from("meta_business_managers").select("nome").eq("id", bmId).maybeSingle(),
    ]);
    ids = (irmas || []).map((row: any) => String(row.id)).filter(Boolean);
    bmNome = bm?.nome || null;
  } else if (businessId) {
    const { data: irmas } = await supabase
      .from("meta_whatsapp_instances")
      .select("id")
      .eq("business_id", businessId);
    ids = (irmas || []).map((row: any) => String(row.id)).filter(Boolean);
  }

  if (ids.length === 0 && instancia?.id) ids = [String(instancia.id)];
  if (ids.length > 0) {
    await supabase.from("meta_whatsapp_instances").update({
      estado_pool: "restrita",
      pausa_automatica_ate: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      pausa_automatica_motivo: motivo,
    }).in("id", ids);
  }

  return { instanciaIds: ids, bmId, bmNome };
}
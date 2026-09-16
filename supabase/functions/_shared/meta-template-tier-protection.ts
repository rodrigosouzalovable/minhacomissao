export const TIER_250_TEMPLATE_LIMIT = 2;

export async function reservarEnvioTemplateTier250(
  supabase: any,
  instanciaId: string,
  templateMestreId: string,
  origem: string,
): Promise<"not_limited" | "reserved" | "already_reserved" | "limit_reached"> {
  const { data, error } = await supabase.rpc("reserve_tier_250_template_slot", {
    p_instancia_id: instanciaId,
    p_template_mestre_id: templateMestreId,
    p_origem: origem,
  });
  if (error) throw new Error(`Falha ao reservar cota segura de templates: ${error.message}`);
  return String(data || "limit_reached") as
    | "not_limited"
    | "reserved"
    | "already_reserved"
    | "limit_reached";
}

export async function finalizarEnvioTemplateTier250(
  supabase: any,
  instanciaId: string,
  templateMestreId: string,
  status: "ENVIADO" | "FALHA",
  detalhe?: string | null,
): Promise<void> {
  const { error } = await supabase.rpc("finish_tier_250_template_slot", {
    p_instancia_id: instanciaId,
    p_template_mestre_id: templateMestreId,
    p_status: status,
    p_detalhe: detalhe || null,
  });
  if (error) console.error("[template-tier-250] falha ao finalizar reserva", error.message);
}
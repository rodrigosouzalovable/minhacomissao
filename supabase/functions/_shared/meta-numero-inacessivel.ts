// Detecta o erro #100 da Graph API ("Object with ID ... does not exist, cannot be
// loaded due to missing permissions") — o número deixou de ser acessível pelo token
// atual (removido/desabilitado do WABA, migrou de Business Manager ou o app perdeu
// permissão). Nesse caso a instância é restringida no pool e o admin é avisado 1x/dia.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.88.0";
import { rotuloInstancia, linhaBmInstancia } from "./rotulo-instancia.ts";

export const MSG_NUMERO_INACESSIVEL =
  "Esse número não está mais acessível pela API da Meta (#100). Normalmente significa que ele foi removido/desabilitado do WhatsApp Business Account, migrou de Business Manager, ou o token do app perdeu permissão sobre ele. Reconecte a instância (token e Phone Number ID) no Business Manager ou use outra instância.";

export function ehNumeroInacessivel(erro: unknown, code?: unknown): boolean {
  const s = String(erro || "").toLowerCase();
  const isCode100 = String(code || "") === "100" || s.includes("#100");
  const semObjeto = s.includes("does not exist") ||
    s.includes("cannot be loaded due to missing permissions") ||
    s.includes("unsupported post request");
  // A Meta às vezes devolve só a frase, sem o "#100" no texto.
  const fraseTipica = s.includes("unsupported post request") ||
    (s.includes("object with id") && s.includes("does not exist"));
  return (isCode100 && semObjeto) || fraseTipica;
}


/** Restringe a instância no pool e avisa o admin (idempotente por dia). */
export async function tratarNumeroInacessivel(
  supabase: SupabaseClient,
  inst: any,
  msgOriginal: string,
): Promise<void> {
  try {
    const ate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await supabase.from("meta_whatsapp_instances").update({
      estado_pool: "restrita",
      pausa_automatica_ate: ate,
      pausa_automatica_motivo: "status=NUMERO_INACESSIVEL",
    }).eq("id", inst.id);
  } catch (e) {
    console.log("[numero-inacessivel] update falhou:", String(e).slice(0, 200));
  }

  try {
    const { notificarAdmin } = await import("./notificar-admin.ts");
    const hoje = new Date().toISOString().slice(0, 10);
    await notificarAdmin(supabase, {
      tipo: "meta_numero_inacessivel",
      mensagem:
        `🚫 *Número Meta inacessível*\n\n` +
        `Instância: *${rotuloInstancia(inst)}*\n` +
        `${await linhaBmInstancia(supabase, inst)}\n` +
        `Phone Number ID: ${inst.phone_number_id}\n\n` +
        `A Meta respondeu erro #100 (objeto não existe / sem permissão). O número saiu do pool de envios automaticamente.\n\n` +
        `Verifique no Business Manager se o número ainda está no WABA e se o token do app tem permissão, depois atualize token/Phone Number ID no card da instância.\n\n` +
        `Detalhe técnico: ${String(msgOriginal).slice(0, 180)}`,
      chaveIdempotencia: `meta_numero_inacessivel_${inst.id}_${hoje}`,
      umaVezPorChave: true,
    });
  } catch (e) {
    console.log("[numero-inacessivel] notificarAdmin falhou:", String(e).slice(0, 200));
  }
}

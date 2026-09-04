// Detecta o erro #131031 da Graph API ("Business Account locked") — a conta do
// Business Manager está bloqueada/em revisão pela Meta e TODOS os envios daquele
// número são recusados, mesmo respondendo cliente dentro da janela de 24h.
// Nesse caso a instância é restringida no pool e o admin é avisado 1x/dia.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.88.0";
import { rotuloInstancia, linhaBmInstancia } from "./rotulo-instancia.ts";

export const MOTIVO_CONTA_BLOQUEADA = "Business Account locked";

export const MSG_CONTA_BLOQUEADA =
  "A conta do Business Manager desta instância está bloqueada pela Meta (#131031). Enquanto o bloqueio existir, a Meta recusa todos os envios deste número — inclusive respostas dentro da janela de 24h. Resolva a restrição no Business Manager (Central de Contas/Qualidade, apelação e método de pagamento) ou responda por outra instância. Não é problema de qualidade nem do contato.";

export function ehContaBloqueada(erro: unknown, code?: unknown): boolean {
  const s = String(erro || "").toLowerCase();
  if (String(code || "") === "131031") return true;
  if (s.includes("#131031")) return true;
  return s.includes("business account") && s.includes("locked");
}

/** Motivo de pausa ligado a pendência de pagamento/elegibilidade da BM (#131042). */
export function ehMotivoPagamento(motivo?: string | null): boolean {
  const s = String(motivo || "").toLowerCase();
  if (!s) return false;
  return (
    s.includes("#131042") ||
    s.includes("payment") ||
    s.includes("billing") ||
    s.includes("eligibility") ||
    s.includes("pagamento")
  );
}

/** Texto amigável de um motivo de pausa gravado na instância, se for bloqueio real da Meta. */
export function ehMotivoBloqueioMeta(motivo?: string | null): boolean {
  const s = String(motivo || "").toLowerCase();
  if (!s) return false;
  return (
    s.includes("locked") ||
    s.includes("business account") ||
    s.includes("numero_inacessivel") ||
    s.includes("status=banned") ||
    s.includes("status=restricted") ||
    s.includes("status=flagged") ||
    ehMotivoPagamento(s)
  );
}


/** Restringe a instância no pool e avisa o admin (idempotente por dia).
 *  Antes de restringir, confirma na Graph API se a conta realmente está travada:
 *  se a Meta responder que está tudo liberado, a instância continua no pool
 *  (foi falha pontual daquele envio). Retorna true se restringiu. */
export async function tratarContaBloqueada(
  supabase: SupabaseClient,
  inst: any,
  msgOriginal: string,
): Promise<boolean> {
  const confirmado = await metaConfirmaBloqueio(inst);
  if (confirmado === false) {
    console.log("[conta-bloqueada] Meta diz que está liberado — instância mantida no pool:", inst?.id);
    return false;
  }

  let jaRestrita = false;
  try {
    const { data: antes } = await supabase
      .from("meta_whatsapp_instances")
      .select("estado_pool, pausa_automatica_ate")
      .eq("id", inst.id)
      .maybeSingle();
    jaRestrita = (antes as any)?.estado_pool === "restrita" ||
      (!!(antes as any)?.pausa_automatica_ate &&
        new Date((antes as any).pausa_automatica_ate).getTime() > Date.now());

    // Pausa curta: a liberação real depende da revalidação na Meta
    // (check-meta-instance-health), que roda de hora em hora.
    const ate = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await supabase.from("meta_whatsapp_instances").update({
      estado_pool: "restrita",
      pausa_automatica_ate: ate,
      pausa_automatica_motivo: MOTIVO_CONTA_BLOQUEADA,
    }).eq("id", inst.id);
  } catch (e) {
    console.log("[conta-bloqueada] update falhou:", String(e).slice(0, 200));
  }

  if (jaRestrita) return true;


  try {
    const { notificarAdmin } = await import("./notificar-admin.ts");
    const hoje = new Date().toISOString().slice(0, 10);
    await notificarAdmin(supabase, {
      tipo: "meta_conta_bloqueada",
      mensagem:
        `⛔ *Business Account bloqueada pela Meta (#131031)*\n\n` +
        `Instância: *${rotuloInstancia(inst)}*\n` +
        `${await linhaBmInstancia(supabase, inst)}\n\n` +
        `A Meta está recusando todos os envios desse número — inclusive respostas na janela de 24h. Não é qualidade nem contato.\n\n` +
        `Resolva no Business Manager (restrição da conta / apelação / método de pagamento). O número saiu do pool automaticamente e volta sozinho quando a Meta liberar.\n\n` +
        `Detalhe técnico: ${String(msgOriginal).slice(0, 180)}`,
      chaveIdempotencia: `meta_conta_bloqueada_${inst.id}_${hoje}`,
      umaVezPorChave: true,
    });
  } catch (e) {
    console.log("[conta-bloqueada] notificarAdmin falhou:", String(e).slice(0, 200));
  }
}

/**
 * Confirma na hora, na Graph API, se a conta/número está REALMENTE sem poder enviar.
 * Retorna:
 *  - true  → a Meta confirma bloqueio/limitação (pode restringir a instância)
 *  - false → a Meta diz que está tudo liberado (foi falha pontual do envio)
 *  - null  → não foi possível confirmar (trata como bloqueio, comportamento antigo)
 */
export async function metaConfirmaBloqueio(inst: any): Promise<boolean | null> {
  try {
    if (!inst?.phone_number_id || !inst?.access_token) return null;
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${inst.phone_number_id}?fields=health_status,status`,
      { headers: { Authorization: `Bearer ${inst.access_token}` }, signal: AbortSignal.timeout(10_000) },
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.error) return null;
    const hs = data?.health_status;
    if (!hs) return null;
    const ruim = (v: unknown) =>
      ["BLOCKED", "LIMITED", "RESTRICTED"].includes(String(v || "").toUpperCase());
    if (ruim(hs.can_send_message)) return true;
    const ents = Array.isArray(hs.entities) ? hs.entities : [];
    if (ents.some((e: any) => ruim(e?.can_send_message))) return true;
    if (String(data?.status || "").toUpperCase() === "BANNED") return true;
    return false;
  } catch {
    return null;
  }
}

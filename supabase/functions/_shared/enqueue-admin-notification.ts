import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.88.0";

export interface EnqueueAdminNotificationParams {
  tipo: string;
  mensagem: string;
  destinatario: string;
  chaveIdempotencia?: string;
}

const normalizePhone = (value: string) => {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.startsWith("55") ? digits : `55${digits}`;
};

export async function enqueueAdminNotification(
  supabase: SupabaseClient,
  params: EnqueueAdminNotificationParams,
): Promise<{ queued: boolean; id?: string; scheduledAt?: string; skipped?: string; error?: string }> {
  const destinatario = normalizePhone(params.destinatario);
  if (destinatario.length < 12) return { queued: false, error: "destinatario_invalido" };

  const { data, error } = await supabase.rpc("enfileirar_notificacao_admin", {
    p_tipo: params.tipo,
    p_chave_idempotencia: params.chaveIdempotencia ?? null,
    p_destinatario: destinatario,
    p_mensagem: params.mensagem,
  });
  if (error) return { queued: false, error: error.message };

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.criada) return { queued: false, id: row?.id, scheduledAt: row?.agendada_para, skipped: "ja_enfileirada" };

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (url && serviceKey) {
    EdgeRuntime.waitUntil(fetch(`${url}/functions/v1/process-admin-notification-queue`, {
      method: "POST",
      headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
      body: "{}",
    }).catch((err) => console.error("[admin-notification-queue] falha ao despertar processador", err)));
  }

  return { queued: true, id: row?.id, scheduledAt: row?.agendada_para };
}

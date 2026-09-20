// Helper compartilhado para enviar notificações ao admin via WhatsApp
// Round-robin entre instâncias ativas, com idempotência
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.88.0";
import { enqueueAdminNotification } from "./enqueue-admin-notification.ts";

export interface NotificarAdminParams {
  tipo: string;
  mensagem: string;
  chaveIdempotencia?: string;
  /** Envia no máximo 1 vez por chave, mesmo que a tentativa anterior tenha falhado */
  umaVezPorChave?: boolean;
  forcarFlag?: keyof FlagsToggle;
  /** Se informado, envia para estes números em vez do admin_phone padrão */
  destinatarios?: string[];
}

export interface FlagsToggle {
  notificar_chip_pausado: boolean;
  notificar_chip_desconectado: boolean;
  notificar_resumo_diario: boolean;
  notificar_proxies_faltando: boolean;
}

const isRetryableInstanceError = (text: string, status: number) => {
  const normalized = text.toLowerCase();
  return (
    status >= 500 ||
    normalized.includes("disconnected") ||
    normalized.includes("not reconnectable") ||
    normalized.includes("not connected") ||
    normalized.includes("session") ||
    normalized.includes("offline") ||
    normalized.includes("timeout") ||
    normalized.includes("timed out") ||
    normalized.includes("abort") ||
    normalized.includes("unauthorized") ||
    normalized.includes("invalid token") ||
    normalized.includes("forbidden") ||
    normalized.includes("connection")
  );
};

/**
 * Avalia a resposta do provedor de forma estruturada.
 * Antes bastava a palavra "error" no corpo para marcar falha — o que dava
 * falso positivo em respostas de sucesso que trazem blocos de metadados
 * (ex.: new_chat_message_capping / reachout_timelock).
 */
const hasProviderError = (text: string) => {
  const bruto = String(text || "").trim();
  if (!bruto) return false;

  let data: any = null;
  try {
    data = JSON.parse(bruto);
  } catch (_) {
    // Não é JSON: só considera erro se for uma mensagem de erro explícita
    const n = bruto.toLowerCase();
    return n.includes("error") || n.includes("falha") || n.includes("not allowed");
  }

  if (!data || typeof data !== "object") return false;

  // Indicadores explícitos de sucesso (id da mensagem devolvido pelo provedor)
  const idMsg =
    data.id ?? data.messageid ?? data.messageId ?? data.key?.id ?? data.message?.id ?? data.data?.id;
  const explicitOk = data.success === true || data.status === "success" || data.sent === true;
  const explicitErr =
    data.error === true ||
    data.success === false ||
    (typeof data.error === "string" && data.error.trim() !== "") ||
    (data.error && typeof data.error === "object") ||
    (typeof data.code === "number" && data.code >= 400) ||
    (typeof data.message === "string" && /not allowed|unauthorized|forbidden|invalid|fail/i.test(data.message));

  if (explicitErr) return true;
  if (explicitOk || idMsg) return false;
  return false;
};


const uazUrl = (base: string, path: string, query?: Record<string, string>) => {
  const url = new URL(`${base.replace(/\/+$/, "")}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value) url.searchParams.set(key, value);
    }
  }
  return url.toString();
};

const parseConnected = (data: any) => {
  const candidates = [
    data?.status,
    data?.state,
    data?.connectionStatus,
    data?.instance?.status,
    data?.instance?.state,
    data?.result?.status,
    data?.result?.state,
    data?.data?.status,
    data?.data?.state,
    data?.status?.status,
    data?.status?.state,
    data?.status?.connectionStatus,
    data?.status?.instance?.status,
  ];
  const rawStatus = String(candidates.find((value) => typeof value === "string" && value.trim()) || "").toLowerCase();
  const flags = [
    data?.connected,
    data?.isConnected,
    data?.instance?.connected,
    data?.status?.connected,
    data?.status?.isConnected,
    data?.result?.connected,
    data?.data?.connected,
  ];

  return flags.includes(true) || ["connected", "open", "online", "ready"].includes(rawStatus);
};

const checkInstanceConnected = async (inst: any) => {
  const base = String(inst.server_url || "").replace(/\/+$/, "");
  const token = String(inst.instance_token || "");
  if (!base || !token) return false;

  const attempts = [
    { url: uazUrl(base, "/instance/status", { token }), headers: {} },
    { url: `${base}/instance/status`, headers: { token } },
  ];

  for (const attempt of attempts) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const ctrl = new AbortController();
      timer = setTimeout(() => ctrl.abort(), 2500);
      const res = await fetch(attempt.url, { headers: attempt.headers, signal: ctrl.signal });
      if (timer) clearTimeout(timer);
      if (!res.ok) continue;
      const text = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(text);
      } catch (_) {
        continue;
      }
      if (parseConnected(data)) return true;
    } catch (_) {
      if (timer) clearTimeout(timer);
    }
  }

  return false;
};

/**
 * Fallback: envia o aviso pela API Oficial da Meta (send-whatsapp-meta-text).
 * Só entrega se existir janela de 24h aberta com o número do admin — usado
 * apenas quando nenhuma instância comum conseguiu entregar.
 */
const tentarViaMetaOficial = async (
  supabase: SupabaseClient,
  numeroFinal: string,
  texto: string,
): Promise<{ ok: boolean; erro?: string }> => {
  try {
    const sufixo = numeroFinal.slice(-8);
    const { data: contatos } = await supabase
      .from("meta_whatsapp_contatos")
      .select("instancia_id, telefone, ultima_msg_entrada_em")
      .ilike("telefone", `%${sufixo}`)
      .not("ultima_msg_entrada_em", "is", null)
      .order("ultima_msg_entrada_em", { ascending: false })
      .limit(5);

    const limite = Date.now() - 24 * 60 * 60 * 1000;
    const alvo = (contatos || []).find(
      (c: any) => new Date(c.ultima_msg_entrada_em).getTime() > limite,
    );
    if (!alvo) return { ok: false, erro: "sem_janela_24h" };

    const { data, error } = await supabase.functions.invoke("send-whatsapp-meta-text", {
      body: { instancia_id: (alvo as any).instancia_id, telefone: (alvo as any).telefone, texto, origem: "sistema" },
    });
    if (error) return { ok: false, erro: String(error.message).slice(0, 300) };
    if (!(data as any)?.success) return { ok: false, erro: String((data as any)?.error || "falha").slice(0, 300) };
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: String(e).slice(0, 300) };
  }
};



export async function notificarAdmin(
  supabase: SupabaseClient,
  params: NotificarAdminParams,
): Promise<{ success: boolean; skipped?: string; error?: string; fallback?: boolean }> {
  try {
    const { data: cfg } = await supabase
      .from("admin_notificacoes_config")
      .select("*")
      .eq("id", 1)
      .maybeSingle();

    if (!cfg) return { success: false, error: "config_ausente", fallback: true };

    if (params.forcarFlag && cfg[params.forcarFlag] === false) {
      return { success: false, skipped: "flag_desativada" };
    }

    const brutos = params.destinatarios?.length
      ? params.destinatarios
      : [String(cfg.admin_phone)];
    const destinos = Array.from(
      new Set(
        brutos
          .map((n) => String(n ?? "").replace(/\D/g, ""))
          .filter((n) => n.length >= 10)
          .map((n) => (n.startsWith("55") ? n : `55${n}`)),
      ),
    );
    if (!destinos.length) return { success: false, error: "sem_destinatario", fallback: true };

    const mensagemFinal = `🤖 *Aviso Sistema*\n\n${params.mensagem}`;
    const resultados = await Promise.all(destinos.map((destino) => enqueueAdminNotification(supabase, {
      tipo: params.tipo,
      mensagem: mensagemFinal,
      destinatario: destino,
      chaveIdempotencia: params.chaveIdempotencia ? `${params.chaveIdempotencia}:${destino}` : undefined,
    })));
    if (resultados.some((resultado) => resultado.queued)) return { success: true };
    if (resultados.every((resultado) => resultado.skipped === "ja_enfileirada")) {
      return { success: false, skipped: "ja_enviado" };
    }
    return { success: false, error: resultados.map((resultado) => resultado.error).filter(Boolean).join(" || ").slice(0, 1000), fallback: true };
  } catch (e) {
    return { success: false, error: String(e).substring(0, 200), fallback: true };
  }
}

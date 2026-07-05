// Helper compartilhado para enviar notificações ao admin via WhatsApp
// Round-robin entre instâncias ativas, com idempotência
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.88.0";

export interface NotificarAdminParams {
  tipo: string;
  mensagem: string;
  chaveIdempotencia?: string;
  forcarFlag?: keyof FlagsToggle;
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

const hasProviderError = (text: string) => {
  const normalized = text.toLowerCase();
  return (
    normalized.includes('"error":true') ||
    normalized.includes('"success":false') ||
    normalized.includes("falha") ||
    normalized.includes("error")
  );
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

    if (params.chaveIdempotencia) {
      const { data: ja } = await supabase
        .from("admin_notificacoes_log")
        .select("id")
        .eq("tipo", params.tipo)
        .eq("chave_idempotencia", params.chaveIdempotencia)
        .maybeSingle();
      if (ja) return { success: false, skipped: "ja_enviado" };
    }

    // Round-robin: pega próxima instância ativa após a última usada
    const { data: insts } = await supabase
      .from("user_whatsapp_instances")
      .select("id, server_url, instance_token, nome")
      .eq("ativo", true)
      .not("server_url", "is", null)
      .not("instance_token", "is", null)
      .order("id", { ascending: true });

    if (!insts?.length) return { success: false, error: "sem_instancia_ativa", fallback: true };

    let idx = 0;
    if (cfg.ultima_instancia_id) {
      const ultIdx = insts.findIndex((i: any) => i.id === cfg.ultima_instancia_id);
      idx = ultIdx >= 0 ? (ultIdx + 1) % insts.length : 0;
    }

    const numero = String(cfg.admin_phone).replace(/\D/g, "");
    const numeroFinal = numero.startsWith("55") ? numero : `55${numero}`;
    const mensagemFinal = `🤖 *Aviso Sistema*\n\n${params.mensagem}`;

    const statusChecks = await Promise.allSettled(
      insts.map(async (inst: any) => ({ inst, connected: await checkInstanceConnected(inst) })),
    );
    const connectedIds = new Set(
      statusChecks
        .filter((result): result is PromiseFulfilledResult<{ inst: any; connected: boolean }> => result.status === "fulfilled")
        .filter((result) => result.value.connected)
        .map((result) => result.value.inst.id),
    );
    const orderedInsts = insts.filter((inst: any) => connectedIds.has(inst.id));

    if (!orderedInsts.length) {
      const erroFinal = `nenhuma_instancia_conectada; ativas_verificadas=${insts.length}`;
      await supabase.from("admin_notificacoes_log").insert({
        tipo: params.tipo,
        chave_idempotencia: params.chaveIdempotencia ?? null,
        mensagem: params.mensagem,
        status: "erro",
        erro_detalhe: erroFinal,
      });
      return { success: false, error: erroFinal, fallback: true };
    }

    // Tenta todas as instâncias conectadas em round-robin até uma enviar de verdade
    let ultimoErro = "sem_tentativas";
    const errosTentativas: string[] = [];
    const connectedStartIdx = cfg.ultima_instancia_id
      ? Math.max(0, (orderedInsts.findIndex((i: any) => i.id === cfg.ultima_instancia_id) + 1) % orderedInsts.length)
      : 0;
    for (let t = 0; t < orderedInsts.length; t++) {
      const inst: any = orderedInsts[(connectedStartIdx + t) % orderedInsts.length];
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const ctrl = new AbortController();
        timer = setTimeout(() => ctrl.abort(), 7000);
        const cleanUrl = String(inst.server_url).replace(/\/+$/, "");
        const endpoints = [`${cleanUrl}/send/text`, `${cleanUrl}/message/sendText`, `${cleanUrl}/sendText`];

        for (const endpoint of endpoints) {
          const res = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json", token: inst.instance_token },
            body: JSON.stringify({ number: numeroFinal, text: mensagemFinal }),
            signal: ctrl.signal,
          });
          const respText = await res.text();
          const providerError = hasProviderError(respText);
          if (res.ok && !providerError) {
            if (timer) clearTimeout(timer);
            await supabase.from("admin_notificacoes_log").insert({
              tipo: params.tipo,
              chave_idempotencia: params.chaveIdempotencia ?? null,
              mensagem: params.mensagem,
              instancia_envio_id: inst.id,
              status: "enviado",
            });
            await supabase
              .from("admin_notificacoes_config")
              .update({ ultima_instancia_id: inst.id, updated_at: new Date().toISOString() })
              .eq("id", 1);
            return { success: true };
          }

          ultimoErro = `${inst.nome ?? inst.id}: ${respText || `HTTP ${res.status}`}`.substring(0, 200);
          errosTentativas.push(ultimoErro);
          if (res.status === 405) continue;
          if (!isRetryableInstanceError(respText, res.status)) break;
        }
        if (timer) clearTimeout(timer);
      } catch (e) {
        if (timer) clearTimeout(timer);
        ultimoErro = `${inst.nome ?? inst.id}: ${String(e)}`.substring(0, 200);
        errosTentativas.push(ultimoErro);
      }
    }

    const erroFinal = errosTentativas.slice(-10).join(" | ") || ultimoErro;
    await supabase.from("admin_notificacoes_log").insert({
      tipo: params.tipo,
      chave_idempotencia: params.chaveIdempotencia ?? null,
      mensagem: params.mensagem,
      status: "erro",
      erro_detalhe: erroFinal,
    });
    return { success: false, error: erroFinal, fallback: true };
  } catch (e) {
    return { success: false, error: String(e).substring(0, 200), fallback: true };
  }
}

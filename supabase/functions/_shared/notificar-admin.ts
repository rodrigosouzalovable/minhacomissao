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

    // Tenta todas as instâncias ativas em round-robin até uma enviar de verdade
    let ultimoErro = "sem_tentativas";
    const errosTentativas: string[] = [];
    for (let t = 0; t < insts.length; t++) {
      const inst: any = insts[(idx + t) % insts.length];
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const ctrl = new AbortController();
        timer = setTimeout(() => ctrl.abort(), 12000);
        const res = await fetch(`${inst.server_url}/send/text`, {
          method: "POST",
          headers: { "Content-Type": "application/json", token: inst.instance_token },
          body: JSON.stringify({ number: numeroFinal, text: mensagemFinal }),
          signal: ctrl.signal,
        });
        if (timer) clearTimeout(timer);

        const respText = await res.text();
        const providerError = hasProviderError(respText);
        if (res.ok && !providerError) {
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

        if (!isRetryableInstanceError(respText, res.status)) {
          continue;
        }
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

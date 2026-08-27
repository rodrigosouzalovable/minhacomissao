// Helper compartilhado para enviar notificações ao admin via WhatsApp
// Round-robin entre instâncias ativas, com idempotência
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.88.0";

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

    if (params.chaveIdempotencia) {
      let q = supabase
        .from("admin_notificacoes_log")
        .select("id")
        .eq("tipo", params.tipo)
        .like("chave_idempotencia", `${params.chaveIdempotencia}%`);
      // Por padrão só bloqueia se já foi entregue; com umaVezPorChave qualquer
      // tentativa registrada (inclusive com erro) impede o reenvio.
      if (!params.umaVezPorChave) q = q.eq("status", "enviado");
      const { data: ja } = await q.limit(1);
      if (ja?.length) return { success: false, skipped: "ja_enviado" };
    }


    // Remetente ÚNICO: todas as notificações saem sempre pelo mesmo número.
    // Só troca (e persiste o novo) se o remetente fixo estiver fora do ar.
    const { data: insts } = await supabase
      .from("user_whatsapp_instances")
      .select("id, server_url, instance_token, nome")
      .eq("ativo", true)
      .not("server_url", "is", null)
      .not("instance_token", "is", null)
      .order("id", { ascending: true });

    if (!insts?.length) return { success: false, error: "sem_instancia_ativa", fallback: true };

    const fixaId: string | null = (cfg as any).instancia_notificacao_id ?? null;
    const fixa = fixaId ? insts.find((i: any) => i.id === fixaId) : null;

    let orderedInsts: any[] = [];
    if (fixa && (await checkInstanceConnected(fixa))) {
      // Caminho normal: nem verifica as outras (mais rápido e mais barato).
      orderedInsts = [fixa];
    } else {
      const statusChecks = await Promise.allSettled(
        insts.map(async (inst: any) => ({ inst, connected: await checkInstanceConnected(inst) })),
      );
      const connectedIds = new Set(
        statusChecks
          .filter((r): r is PromiseFulfilledResult<{ inst: any; connected: boolean }> => r.status === "fulfilled")
          .filter((r) => r.value.connected)
          .map((r) => r.value.inst.id),
      );
      orderedInsts = insts.filter((inst: any) => connectedIds.has(inst.id));
    }


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

    const enviarPara = async (numeroFinal: string): Promise<{ ok: boolean; erro?: string; skipped?: string }> => {
      const chaveDest = params.chaveIdempotencia ? `${params.chaveIdempotencia}:${numeroFinal}` : null;

      // === TRAVA ATÔMICA ===
      // Reserva a chave ANTES de enviar. Se outra execução simultânea já
      // reservou (índice único em tipo + chave_idempotencia), aborta sem enviar.
      let reservaId: string | null = null;
      if (chaveDest) {
        const { data: reserva, error: erroReserva } = await supabase
          .from("admin_notificacoes_log")
          .insert({
            tipo: params.tipo,
            chave_idempotencia: chaveDest,
            mensagem: `[${numeroFinal}] ${params.mensagem}`,
            status: "reservado",
          })
          .select("id")
          .maybeSingle();
        if (erroReserva || !reserva?.id) {
          return { ok: false, skipped: "ja_enviado", erro: "ja_reservado" };
        }
        reservaId = (reserva as any).id;
      }

      const registrar = async (campos: Record<string, unknown>) => {
        if (reservaId) {
          await supabase.from("admin_notificacoes_log").update(campos).eq("id", reservaId);
          return;
        }
        await supabase.from("admin_notificacoes_log").insert({
          tipo: params.tipo,
          chave_idempotencia: chaveDest,
          mensagem: `[${numeroFinal}] ${params.mensagem}`,
          ...campos,
        });
      };

      let ultimoErro = "sem_tentativas";
      const errosTentativas: string[] = [];
      // Ordem fixa: remetente único primeiro; as demais são só plano B.
      for (let t = 0; t < orderedInsts.length; t++) {
        const inst: any = orderedInsts[t];

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
              await registrar({ instancia_envio_id: inst.id, status: "enviado", enviado_em: new Date().toISOString() });
              await supabase
                .from("admin_notificacoes_config")
                .update({ ultima_instancia_id: inst.id, updated_at: new Date().toISOString() })
                .eq("id", 1);
              return { ok: true };
            }

            ultimoErro = `${inst.nome ?? inst.id}: ${respText || `HTTP ${res.status}`}`.substring(0, 1000);
            errosTentativas.push(ultimoErro);
            if (res.status === 405) continue;
            if (!isRetryableInstanceError(respText, res.status)) break;
          }
          if (timer) clearTimeout(timer);
        } catch (e) {
          if (timer) clearTimeout(timer);
          ultimoErro = `${inst.nome ?? inst.id}: ${String(e)}`.substring(0, 1000);
          errosTentativas.push(ultimoErro);
        }
      }

      // Último recurso: tenta pela API Oficial da Meta (só entrega se houver janela de 24h aberta)
      const viaMeta = await tentarViaMetaOficial(supabase, numeroFinal, mensagemFinal);
      if (viaMeta.ok) {
        await registrar({
          status: "enviado",
          enviado_em: new Date().toISOString(),
          erro_detalhe: `fallback_meta_oficial; uazapi: ${errosTentativas.slice(-3).join(" | ")}`.slice(0, 4000),
        });
        return { ok: true };
      }
      if (viaMeta.erro) errosTentativas.push(`meta_oficial: ${viaMeta.erro}`);

      const erroFinal = errosTentativas.slice(-10).join(" | ") || ultimoErro;
      if (reservaId && !params.umaVezPorChave) {
        // Falhou a entrega: libera a chave para que uma tentativa futura possa
        // reenviar, mas mantém o registro de erro (sem chave) para auditoria.
        await supabase.from("admin_notificacoes_log")
          .update({ chave_idempotencia: null, status: "erro", erro_detalhe: erroFinal })
          .eq("id", reservaId);
      } else {
        await registrar({ status: "erro", erro_detalhe: erroFinal });
      }
      return { ok: false, erro: erroFinal };
    };


    const resultados: { ok: boolean; erro?: string }[] = [];
    for (const dest of destinos) {
      resultados.push(await enviarPara(dest));
    }

    if (resultados.some((r) => r.ok)) return { success: true };
    return {
      success: false,
      error: resultados.map((r) => r.erro).filter(Boolean).join(" || ").substring(0, 1000),
      fallback: true,
    };
  } catch (e) {
    return { success: false, error: String(e).substring(0, 200), fallback: true };
  }
}

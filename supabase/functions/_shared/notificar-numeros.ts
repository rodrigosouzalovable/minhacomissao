// Envia notificação WhatsApp para lista de destinatários via UAZAPI
// Reusa lógica de round-robin de instâncias conectadas do notificar-admin.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.88.0";

export interface NotificarNumerosParams {
  tipo: string;
  mensagem: string;
  destinatarios: string[]; // números com ou sem DDI 55, ou JIDs de grupo (…@g.us)
  chaveIdempotencia?: string;
  // Instância obrigatória/preferida por destino (ex.: grupo só recebe da instância que participa dele)
  instanciaPorDestino?: Record<string, string>;
}


const isRetryableInstanceError = (text: string, status: number) => {
  const n = text.toLowerCase();
  return (
    status >= 500 ||
    n.includes("disconnected") || n.includes("not reconnectable") ||
    n.includes("not connected") || n.includes("session") ||
    n.includes("offline") || n.includes("timeout") || n.includes("timed out") ||
    n.includes("abort") || n.includes("unauthorized") ||
    n.includes("invalid token") || n.includes("forbidden") || n.includes("connection")
  );
};

const hasProviderError = (text: string) => {
  const n = text.toLowerCase();
  return n.includes('"error":true') || n.includes('"success":false') || n.includes("falha");
};

const uazUrl = (base: string, path: string, query?: Record<string, string>) => {
  const url = new URL(`${base.replace(/\/+$/, "")}${path}`);
  if (query) for (const [k, v] of Object.entries(query)) if (v) url.searchParams.set(k, v);
  return url.toString();
};

const parseConnected = (data: any) => {
  const candidates = [
    data?.status, data?.state, data?.connectionStatus,
    data?.instance?.status, data?.instance?.state,
    data?.result?.status, data?.result?.state,
    data?.data?.status, data?.data?.state,
    data?.status?.status, data?.status?.state, data?.status?.connectionStatus,
  ];
  const raw = String(candidates.find((v) => typeof v === "string" && v.trim()) || "").toLowerCase();
  const flags = [data?.connected, data?.isConnected, data?.instance?.connected, data?.status?.connected, data?.result?.connected, data?.data?.connected];
  return flags.includes(true) || ["connected", "open", "online", "ready"].includes(raw);
};

const checkConnected = async (inst: any) => {
  const base = String(inst.server_url || "").replace(/\/+$/, "");
  const token = String(inst.instance_token || "");
  if (!base || !token) return false;
  const attempts = [
    { url: uazUrl(base, "/instance/status", { token }), headers: {} as Record<string, string> },
    { url: `${base}/instance/status`, headers: { token } },
  ];
  for (const a of attempts) {
    let timer: any;
    try {
      const ctrl = new AbortController();
      timer = setTimeout(() => ctrl.abort(), 2500);
      const res = await fetch(a.url, { headers: a.headers, signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) continue;
      const text = await res.text();
      const data = JSON.parse(text);
      if (parseConnected(data)) return true;
    } catch (_) { if (timer) clearTimeout(timer); }
  }
  return false;
};

const normalizarNumero = (num: string) => {
  const bruto = String(num).trim();
  // Grupos de WhatsApp já vêm no formato JID (…@g.us) e não recebem prefixo 55
  if (bruto.includes("@")) return bruto;
  if (/^\d{15,}$/.test(bruto.replace(/\D/g, ""))) return `${bruto.replace(/\D/g, "")}@g.us`;
  const n = bruto.replace(/\D/g, "");
  return n.startsWith("55") ? n : `55${n}`;
};

export async function notificarNumeros(
  supabase: SupabaseClient,
  params: NotificarNumerosParams,
): Promise<{ success: boolean; enviados: number; erros: string[]; skipped?: string }> {
  const erros: string[] = [];

  // Idempotência global (mesmo tipo+chave = pula tudo)
  if (params.chaveIdempotencia) {
    const { data: ja } = await supabase
      .from("admin_notificacoes_log")
      .select("id")
      .eq("tipo", params.tipo)
      .eq("chave_idempotencia", params.chaveIdempotencia)
      .maybeSingle();
    if (ja) return { success: false, enviados: 0, erros: [], skipped: "ja_enviado" };
  }

  const { data: insts } = await supabase
    .from("user_whatsapp_instances")
    .select("id, server_url, instance_token, nome")
    .eq("ativo", true)
    .not("server_url", "is", null)
    .not("instance_token", "is", null)
    .order("id", { ascending: true });

  if (!insts?.length) {
    return { success: false, enviados: 0, erros: ["sem_instancia_ativa"] };
  }

  const checks = await Promise.allSettled(insts.map(async (i: any) => ({ i, ok: await checkConnected(i) })));
  const conectadas = checks
    .filter((r: any) => r.status === "fulfilled" && r.value.ok)
    .map((r: any) => r.value.i);

  if (!conectadas.length) {
    await supabase.from("admin_notificacoes_log").insert({
      tipo: params.tipo,
      chave_idempotencia: params.chaveIdempotencia ?? null,
      mensagem: params.mensagem,
      status: "erro",
      erro_detalhe: "nenhuma_instancia_conectada",
    });
    return { success: false, enviados: 0, erros: ["nenhuma_instancia_conectada"] };
  }

  const mensagemFinal = params.mensagem;
  let enviados = 0;
  let cursor = 0;

  for (const rawDest of params.destinatarios) {
    const numero = normalizarNumero(rawDest);
    let sucesso = false;
    let ultimoErro = "sem_tentativas";

    // Ordem de tentativa: instância fixada para este destino primeiro, depois round-robin
    const fixada = params.instanciaPorDestino?.[rawDest] || params.instanciaPorDestino?.[numero];
    const ordem = fixada
      ? [
          ...conectadas.filter((i: any) => i.id === fixada),
          ...conectadas.filter((i: any) => i.id !== fixada),
        ]
      : conectadas;

    for (let t = 0; t < ordem.length && !sucesso; t++) {
      const inst = fixada ? ordem[t] : ordem[(cursor + t) % ordem.length];
      const cleanUrl = String(inst.server_url).replace(/\/+$/, "");
      const endpoints = [`${cleanUrl}/send/text`, `${cleanUrl}/message/sendText`, `${cleanUrl}/sendText`];


      for (const endpoint of endpoints) {
        let timer: any;
        try {
          const ctrl = new AbortController();
          timer = setTimeout(() => ctrl.abort(), 7000);
          const res = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json", token: inst.instance_token },
            body: JSON.stringify({ number: numero, text: mensagemFinal }),
            signal: ctrl.signal,
          });
          clearTimeout(timer);
          const respText = await res.text();
          const provErr = hasProviderError(respText);
          if (res.ok && !provErr) {
            sucesso = true;
            enviados++;
            await supabase.from("admin_notificacoes_log").insert({
              tipo: params.tipo,
              chave_idempotencia: params.chaveIdempotencia ? `${params.chaveIdempotencia}:${numero}` : null,
              mensagem: `[${numero}] ${mensagemFinal}`.slice(0, 4000),
              instancia_envio_id: inst.id,
              status: "enviado",
            });
            cursor = (cursor + t + 1) % conectadas.length;
            break;
          }
          ultimoErro = `${inst.nome ?? inst.id}: ${respText || `HTTP ${res.status}`}`.slice(0, 200);
          if (res.status === 405) continue;
          if (!isRetryableInstanceError(respText, res.status)) break;
        } catch (e) {
          if (timer) clearTimeout(timer);
          ultimoErro = `${inst.nome ?? inst.id}: ${String(e)}`.slice(0, 200);
        }
      }
    }

    if (!sucesso) {
      erros.push(`${numero}: ${ultimoErro}`);
      await supabase.from("admin_notificacoes_log").insert({
        tipo: params.tipo,
        chave_idempotencia: params.chaveIdempotencia ? `${params.chaveIdempotencia}:${numero}` : null,
        mensagem: `[${numero}] ${mensagemFinal}`.slice(0, 4000),
        status: "erro",
        erro_detalhe: ultimoErro,
      });
    }

    // Delay pequeno entre destinatários
    await new Promise((r) => setTimeout(r, 1500));
  }

  return { success: enviados > 0, enviados, erros };
}

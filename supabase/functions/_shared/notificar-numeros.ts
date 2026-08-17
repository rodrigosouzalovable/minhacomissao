// Envia notificação WhatsApp para lista de destinatários via UAZAPI
// Reusa lógica de round-robin de instâncias conectadas do notificar-admin.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.88.0";

export interface NotificarNumerosParams {
  tipo: string;
  mensagem: string;
  destinatarios: string[]; // números com ou sem DDI 55, ou JIDs de grupo (…@g.us)
  chaveIdempotencia?: string;
  // Instância preferida por destino (ex.: grupo tende a receber da instância que participa dele).
  // É apenas preferência: se a instância não existir mais ou estiver desconectada, o sistema
  // percorre as demais instâncias ativas.
  instanciaPorDestino?: Record<string, string>;
}

// Erros que indicam problema da INSTÂNCIA (sessão/token/queda) — descartamos a instância
const isInstanceDeadError = (text: string, status: number) => {
  const n = text.toLowerCase();
  return (
    n.includes("disconnected") || n.includes("not reconnectable") ||
    n.includes("not connected") || n.includes("session") ||
    n.includes("offline") || n.includes("logged out") || n.includes("logout") ||
    n.includes("banned") || n.includes("unauthorized") ||
    n.includes("invalid token") || n.includes("forbidden") ||
    status === 401 || status === 403
  );
};

// Erros que valem tentar em OUTRA instância (mas não condenam a instância atual)
const isRetryableError = (text: string, status: number) => {
  const n = text.toLowerCase();
  return (
    status >= 500 || status === 408 || status === 429 ||
    n.includes("timeout") || n.includes("timed out") || n.includes("abort") ||
    n.includes("connection") || n.includes("not in group") ||
    n.includes("not a participant") || n.includes("not participating") ||
    n.includes("group members") || n.includes("not authorized to send")
  );
};


const hasProviderError = (text: string) => {
  const n = text.toLowerCase().replace(/\s+/g, "");
  // "error":true  ou  "error":"alguma mensagem"  (ignora "error":false / "error":null / "error":"")
  return n.includes('"error":true') || n.includes('"success":false') || /"error":"[^"]+"/.test(n);
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

const fetchStatusOnce = async (inst: any, timeoutMs: number) => {
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
      timer = setTimeout(() => ctrl.abort(), timeoutMs);
      const res = await fetch(a.url, { headers: a.headers, signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) continue;
      const data = JSON.parse(await res.text());
      if (parseConnected(data)) return true;
    } catch (_) { if (timer) clearTimeout(timer); }
  }
  return false;
};

// Timeout generoso + segunda tentativa: a UAZAPI às vezes demora a responder o status
// e antes disso o sistema concluía erradamente que nenhuma instância estava conectada.
const checkConnected = async (inst: any) => {
  if (await fetchStatusOnce(inst, 8000)) return true;
  await new Promise((r) => setTimeout(r, 500));
  return await fetchStatusOnce(inst, 8000);
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
): Promise<{
  success: boolean;
  enviados: number;
  erros: string[];
  skipped?: string;
  instanciaUsadaPorDestino?: Record<string, string>;
}> {
  const erros: string[] = [];
  const instanciaUsadaPorDestino: Record<string, string> = {};

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
  let candidatas = checks
    .filter((r: any) => r.status === "fulfilled" && r.value.ok)
    .map((r: any) => r.value.i);

  // Fallback: se a checagem de status falhar para todas (API lenta/instável), tentamos
  // enviar pelas ativas de qualquer forma. Só desistimos se o envio real também falhar.
  if (!candidatas.length) {
    console.warn("[notificar-numeros] nenhuma instância passou na checagem — tentando todas as ativas");
    candidatas = insts as any[];
  }

  const mensagemFinal = params.mensagem;
  let enviados = 0;
  let cursor = 0;
  const mortas = new Set<string>(); // instâncias descartadas nesta execução (banida/desconectada/token)

  for (const rawDest of params.destinatarios) {
    const numero = normalizarNumero(rawDest);
    let sucesso = false;
    let ultimoErro = "sem_tentativas";
    const errosTentativas: string[] = []; // erro de cada instância tentada (diagnóstico real)

    const vivas = candidatas.filter((i: any) => !mortas.has(i.id));
    if (!vivas.length) {
      ultimoErro = "nenhuma_instancia_disponivel";
    }



    // Ordem: instância preferida para este destino primeiro (se ainda estiver viva), depois round-robin
    const preferida = params.instanciaPorDestino?.[rawDest] || params.instanciaPorDestino?.[numero];
    const temPreferida = preferida && vivas.some((i: any) => i.id === preferida);
    const ordem = temPreferida
      ? [
          ...vivas.filter((i: any) => i.id === preferida),
          ...vivas.filter((i: any) => i.id !== preferida),
        ]
      : vivas;

    for (let t = 0; t < ordem.length && !sucesso; t++) {
      const inst = temPreferida ? ordem[t] : ordem[(cursor + t) % ordem.length];
      if (mortas.has(inst.id)) continue;
      const cleanUrl = String(inst.server_url).replace(/\/+$/, "");
      const endpoint = `${cleanUrl}/send/text`;

      let timer: any;
      try {
        const ctrl = new AbortController();
        timer = setTimeout(() => ctrl.abort(), 15000);
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
          instanciaUsadaPorDestino[rawDest] = inst.id;
          await supabase.from("admin_notificacoes_log").insert({
            tipo: params.tipo,
            chave_idempotencia: params.chaveIdempotencia ? `${params.chaveIdempotencia}:${numero}` : null,
            mensagem: `[${numero}] ${mensagemFinal}`.slice(0, 4000),
            instancia_envio_id: inst.id,
            status: "enviado",
          });
          cursor = (cursor + t + 1) % Math.max(candidatas.length, 1);
          break;
        }
        // Guarda o erro REAL da instância (sem mascarar com 405 de endpoints legados)
        ultimoErro = `${inst.nome ?? inst.id}: ${respText || `HTTP ${res.status}`}`.slice(0, 300);
        if (isInstanceDeadError(respText, res.status)) {
          mortas.add(inst.id);
          console.warn(`[notificar-numeros] instância descartada (${inst.nome ?? inst.id}): ${ultimoErro}`);
          continue;
        }
        if (isRetryableError(respText, res.status)) continue; // tenta outra instância
        // Erro do destino (ex.: número não está no WhatsApp) — não adianta trocar instância
        break;
      } catch (e) {
        if (timer) clearTimeout(timer);
        ultimoErro = `${inst.nome ?? inst.id}: ${String(e)}`.slice(0, 300);
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

  return { success: enviados > 0, enviados, erros, instanciaUsadaPorDestino };
}

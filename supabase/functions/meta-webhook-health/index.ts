// Verifica saúde do webhook em cada instância Meta ativa.
// - Confirma que a WABA está inscrita no callback correto.
// - Se não estiver, reinscreve automaticamente.
// - Compara conversas user_initiated do dia (Meta analytics) vs. mensagens de entrada
//   registradas no banco. Se detectar perda relevante, marca suspeita e notifica admin.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { notificarAdmin } from "../_shared/notificar-admin.ts";
import { criarTokenResolver } from "../_shared/webhook-token.ts";
import { idsInstanciasPermitidas, filtrarInstancias } from '../_shared/escopo-instancias.ts';


const GRAPH_VERSION = "v21.0";
const GRAPH_TIMEOUT_MS = 8_000;
const BATCH_SIZE = 10;
const EXECUTION_BUDGET_MS = 50_000;

function graphFetch(url: string, init: RequestInit = {}) {
  return fetch(url, { ...init, signal: AbortSignal.timeout(GRAPH_TIMEOUT_MS) });
}

function callbackFrom(data: any, expected: string): { url: string | null; valid: boolean; subscribed: boolean } {
  const apps = Array.isArray(data?.data) ? data.data : [];
  const urls = apps.map((app: any) => app?.whatsapp_business_api_data?.override_callback_uri || app?.whatsapp_business_api_data?.link || null);
  return { url: urls.find((url: string | null) => url === expected) || urls[0] || null, valid: urls.includes(expected), subscribed: apps.length > 0 };
}

async function subscriptionStatus(wabaId: string, auth: Record<string, string>, expected: string) {
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(wabaId)}/subscribed_apps?fields=whatsapp_business_api_data`;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await graphFetch(url, { headers: auth });
      const data = await res.json();
      if (!res.ok) {
        const message = String(data?.error?.message || `HTTP ${res.status}`).slice(0, 200);
        if (res.status >= 500 || res.status === 429 || res.status === 408) {
          if (attempt === 0) continue;
          return { kind: 'inconclusiva' as const, error: message };
        }
        return { kind: 'erro' as const, error: `Meta recusou a consulta: ${message}` };
      }
      if (!Array.isArray(data?.data)) return { kind: 'inconclusiva' as const, error: 'Resposta de inscrições inválida' };
      return { kind: 'confirmed' as const, ...callbackFrom(data, expected) };
    } catch (e) {
      if (attempt === 1) return { kind: 'inconclusiva' as const, error: String(e).slice(0, 200) };
    }
  }
  return { kind: 'inconclusiva' as const, error: 'Consulta indisponível' };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const startedAt = Date.now();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const webhookUrl = `${supabaseUrl}/functions/v1/meta-whatsapp-webhook`;
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const body = await req.json().catch(() => ({}));
    const targetId: string | undefined = typeof body?.instancia_id === 'string' && /^[0-9a-f-]{36}$/i.test(body.instancia_id) ? body.instancia_id : undefined;
    if (body?.instancia_id !== undefined && !targetId) return new Response(JSON.stringify({ success: false, error: 'Instância inválida' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const forceNotify: boolean = body?.notify === true;

    const tokenResolver = await criarTokenResolver(supabase);


    const q = supabase
      .from("meta_whatsapp_instances")
      .select("id, nome, waba_id, phone_number_id, display_phone, access_token, ativo, provider, webhook_saude_status, webhook_reinscrito_em, webhook_ultimo_erro");
    const { data: instanciasRaw, error } = targetId
      ? await q.eq("id", targetId)
      : await q.eq("ativo", true);
    if (error) throw error;

    const permitidas = await idsInstanciasPermitidas(req, supabase);
    // Instâncias conectadas na UAZAPI (provider != 'meta') não possuem webhook Meta — não verificar.
    const instancias = filtrarInstancias(
      (instanciasRaw as any[] || []).filter((i) => (i.provider ?? "meta") === "meta" && !!i.waba_id),
      permitidas,
    );


    const inicioDia = new Date();
    inicioDia.setUTCHours(0, 0, 0, 0);
    const startTs = Math.floor(inicioDia.getTime() / 1000);
    const nowTs = Math.floor(Date.now() / 1000);

    const verificarInstancia = async (inst: any) => {
      const out: any = { id: inst.id, nome: inst.nome };
      let status: "ok" | "reinscrito" | "erro" | "perda_suspeita" | "inconclusiva" = "ok";
      let erro: string | null = null;
      let perda: any = null;

      try {
        const auth = { Authorization: `Bearer ${inst.access_token}` };

        // 1) Verifica subscribed_apps e o callback registrado.
        const current = await subscriptionStatus(inst.waba_id, auth, webhookUrl);
        if (current.kind !== 'confirmed') {
          status = current.kind;
          erro = current.error;
        } else {
          out.callback_url = current.url;
          out.subscribed = current.subscribed;

          // 2) Reinscreve se ausente ou apontando para outro serviço.
          if (!current.valid) {
          const verifyToken = tokenResolver.paraInstancia(inst.id);
          if (!verifyToken) {
            status = 'erro';
            erro = 'Verify Token não configurado para esta instância';
          } else {
            const params = new URLSearchParams();
            params.set("override_callback_uri", webhookUrl);
            params.set("verify_token", verifyToken);
            try {
              const subRes = await graphFetch(
                `https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(inst.waba_id)}/subscribed_apps`,
                {
                  method: "POST",
                  headers: { ...auth, "Content-Type": "application/x-www-form-urlencoded" },
                  body: params,
                },
              );
              const subData = await subRes.json();
              const okSub = subRes.ok && (subData?.success === true || !!subData?.id);
              if (!okSub && subRes.status < 500 && subRes.status !== 429 && subRes.status !== 408) {
                status = "erro";
                erro = `Falha ao reinscrever: ${JSON.stringify(subData).slice(0, 200)}`;
              }
            } catch (_) {
              // A solicitação pode ter sido aplicada mesmo se a resposta expirou.
            }
            if (status !== 'erro') {
              const confirmed = await subscriptionStatus(inst.waba_id, auth, webhookUrl);
              if (confirmed.kind === 'confirmed') {
                out.callback_url = confirmed.url;
                status = confirmed.valid ? 'reinscrito' : 'erro';
                if (!confirmed.valid) erro = 'Inscrição ainda ausente ou incorreta após tentativa de reinscrição';
              } else {
                status = confirmed.kind;
                erro = confirmed.error;
              }
            }
          }
          }
        }

        // 3) Compara conversas user_initiated de hoje vs. inbound em DB.
        if (status === 'ok') {
          try {
            const anRes = await graphFetch(
              `https://graph.facebook.com/${GRAPH_VERSION}/${inst.waba_id}?fields=conversation_analytics.start(${startTs}).end(${nowTs}).granularity(DAILY).phone_numbers(["${inst.display_phone ?? ""}"]).conversation_types(["USER_INITIATED"]).dimensions(["CONVERSATION_TYPE"])`,
              { headers: auth },
            );
            const anData = await anRes.json();
            const points = anData?.conversation_analytics?.data?.[0]?.data_points || [];
            const metaConversas = points.reduce(
              (acc: number, p: any) => acc + (Number(p?.conversation) || 0), 0,
            );

            const { count: inbounds } = await supabase
              .from("meta_whatsapp_mensagens")
              .select("id", { count: "exact", head: true })
              .eq("instancia_id", inst.id)
              .eq("direcao", "entrada")
              .gte("criado_em", inicioDia.toISOString());

            const inboundDb = Number(inbounds || 0);
            out.meta_conversas_iniciadas = metaConversas;
            out.inbound_db_hoje = inboundDb;

            // Suspeita: Meta contou pelo menos 3 conversas a mais que temos no DB.
             const reinscritoHoje = inst.webhook_reinscrito_em &&
               new Date(inst.webhook_reinscrito_em).getTime() >= inicioDia.getTime();
             if (metaConversas > 0 && metaConversas - inboundDb >= 3 && !reinscritoHoje) {
               status = "perda_suspeita";
              perda = { meta_conversas: metaConversas, inbound_db: inboundDb, diferenca: metaConversas - inboundDb };
            }
          } catch (_) {
            // analytics é opcional; não invalida o health check.
          }
        }
       } catch (e: any) {
         status = "inconclusiva";
        erro = e?.message?.slice(0, 200) || String(e).slice(0, 200);
      }

      out.status = status;
      out.erro = erro;
      out.perda = perda;

      await supabase
        .from("meta_whatsapp_instances")
        .update({
          webhook_saude_status: status,
          webhook_saude_verificado_em: new Date().toISOString(),
          webhook_ultimo_erro: erro,
          ...(status === 'reinscrito' ? { webhook_reinscrito_em: new Date().toISOString() } : {}),
          ...(out.callback_url !== undefined ? { webhook_callback_url: out.callback_url } : {}),
          webhook_perda_suspeita: perda,
        })
        .eq("id", inst.id);

      // Notifica só UMA vez por mudança de estado (evita aviso de hora em hora).
      const statusAnterior = (inst as any).webhook_saude_status ?? null;
      const mudouEstado = statusAnterior !== status;
      const problema = status === "erro" || status === "perda_suspeita";
       if (problema && (mudouEstado || forceNotify)) {

        let corpo: string;
        let emoji: string;

         if (status === "perda_suspeita") {
          emoji = "⚠️";
          corpo = [
            `A Meta registrou ${perda?.meta_conversas} conversa(s) iniciada(s) por clientes hoje,`,
            `mas o Inbox só recebeu ${perda?.inbound_db}. Podem ter faltado ${perda?.diferenca} mensagem(ns).`,
            "",
            "O que fazer:",
            "• Abra Configurar Meta e confira se esta instância está com o webhook verde.",
            "• Se estiver vermelho, clique em Diagnóstico → Reinscrever webhook.",
            "• Peça ao cliente para reenviar a última mensagem se algo importante sumiu.",
          ].join("\n");
        } else {
          emoji = "🚨";
          const motivoCurto = (erro || "desconhecido").replace(/\s+/g, " ").slice(0, 160);
          corpo = [
             "A Meta confirmou um problema na inscrição do webhook ou recusou a verificação/recuperação.",
             "Mensagens novas de clientes podem não aparecer no Inbox.",
            "",
            "O que fazer:",
            "• Abra Configurar Meta, localize esta instância e clique em Diagnóstico.",
            "• Clique em \"Reinscrever webhook\".",
            "• Se persistir, verifique se o Access Token da instância ainda é válido.",
            "",
            `Detalhe técnico: ${motivoCurto}`,
          ].join("\n");
        }

        const mensagem = `${emoji} Saúde do Webhook — ${inst.nome}\n\n${corpo}`;
        const chave = `${inst.id}:${status}:${new Date().toISOString().slice(0, 10)}`;
        await notificarAdmin(supabase, {
          tipo: "meta_webhook_saude",
          mensagem,
          chaveIdempotencia: chave,
        });
      }


      return out;
    };

    const resultados: any[] = [];
    let parcial = false;
    for (let i = 0; i < instancias.length; i += BATCH_SIZE) {
      if (Date.now() - startedAt >= EXECUTION_BUDGET_MS) {
        parcial = true;
        break;
      }
      const lote = instancias.slice(i, i + BATCH_SIZE);
      resultados.push(...await Promise.all(lote.map(verificarInstancia)));
    }

    return new Response(JSON.stringify({
      success: true,
      parcial,
      processadas: resultados.length,
      total: instancias.length,
      resultados,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err?.message || "Erro" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

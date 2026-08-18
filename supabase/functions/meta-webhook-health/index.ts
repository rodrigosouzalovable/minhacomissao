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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const webhookUrl = `${supabaseUrl}/functions/v1/meta-whatsapp-webhook`;
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const body = await req.json().catch(() => ({}));
    const targetId: string | undefined = body?.instancia_id;
    const forceNotify: boolean = !!body?.notify;

    const tokenResolver = await criarTokenResolver(supabase);


    const q = supabase
      .from("meta_whatsapp_instances")
      .select("id, nome, waba_id, phone_number_id, display_phone, access_token, ativo, provider, webhook_saude_status, webhook_ultimo_erro");
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

    const resultados: any[] = [];
    for (const inst of instancias || []) {
      const out: any = { id: inst.id, nome: inst.nome };
      let status: "ok" | "reinscrito" | "erro" | "perda_suspeita" = "ok";
      let erro: string | null = null;
      let perda: any = null;

      try {
        const auth = { Authorization: `Bearer ${inst.access_token}` };

        // 1) Verifica subscribed_apps e o callback registrado.
        const listRes = await fetch(
          `https://graph.facebook.com/${GRAPH_VERSION}/${inst.waba_id}/subscribed_apps?fields=whatsapp_business_api_data`,
          { headers: auth },
        );
        const listData = await listRes.json();
        const apps = Array.isArray(listData?.data) ? listData.data : [];
        const cbUrl: string | null =
          apps[0]?.whatsapp_business_api_data?.link ||
          apps[0]?.whatsapp_business_api_data?.override_callback_uri ||
          null;
        const callbackOk = !!cbUrl && cbUrl.includes("/meta-whatsapp-webhook");
        out.callback_url = cbUrl;
        out.subscribed = apps.length > 0;

        // 2) Reinscreve se ausente ou apontando para outro serviço.
        if (!apps.length || !callbackOk) {
          const verifyToken = tokenResolver.paraInstancia(inst.id);
          if (!verifyToken) throw new Error("Verify Token não configurado para esta instância");
          const params = new URLSearchParams();
          params.set("override_callback_uri", webhookUrl);
          params.set("verify_token", verifyToken);

          const subRes = await fetch(
            `https://graph.facebook.com/${GRAPH_VERSION}/${inst.waba_id}/subscribed_apps`,
            {
              method: "POST",
              headers: { ...auth, "Content-Type": "application/x-www-form-urlencoded" },
              body: params,
            },
          );
          const subData = await subRes.json();
          const okSub = subRes.ok && (subData?.success === true || !!subData?.id);
          if (okSub) {
            status = "reinscrito";
            out.callback_url = webhookUrl;
          } else {
            status = "erro";
            erro = `Falha ao reinscrever: ${JSON.stringify(subData).slice(0, 200)}`;
          }
        }

        // 3) Compara conversas user_initiated de hoje vs. inbound em DB.
        if (status !== "erro") {
          try {
            const anRes = await fetch(
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
            if (metaConversas > 0 && metaConversas - inboundDb >= 3) {
              status = status === "reinscrito" ? "reinscrito" : "perda_suspeita";
              perda = { meta_conversas: metaConversas, inbound_db: inboundDb, diferenca: metaConversas - inboundDb };
            }
          } catch (_) {
            // analytics é opcional; não invalida o health check.
          }
        }
      } catch (e: any) {
        status = "erro";
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
          webhook_callback_url: out.callback_url ?? null,
          webhook_perda_suspeita: perda,
        })
        .eq("id", inst.id);

      // Notifica só UMA vez por mudança de estado (evita aviso de hora em hora).
      const statusAnterior = (inst as any).webhook_saude_status ?? null;
      const mudouEstado = statusAnterior !== status;
      const problema = status === "erro" || status === "perda_suspeita";
      if ((problema && (mudouEstado || forceNotify)) || (forceNotify && status === "reinscrito")) {

        const errLower = (erro || "").toLowerCase();
        const isTimeout =
          errLower.includes("timed out") ||
          errLower.includes("timeout") ||
          errLower.includes("curl_errno = 28") ||
          errLower.includes("#2200");

        let corpo: string;
        let emoji: string;

        if (status === "reinscrito") {
          emoji = "🔄";
          corpo = [
            "O recebimento de mensagens desta instância caiu e o sistema já religou sozinho.",
            "",
            "Nenhuma ação necessária — as mensagens dos clientes já estão chegando no Inbox de novo.",
          ].join("\n");
        } else if (status === "perda_suspeita") {
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
        } else if (isTimeout) {
          emoji = "⚠️";
          corpo = [
            "A Meta demorou demais para responder ao nosso servidor na hora de reconectar",
            "o recebimento de mensagens desta instância (timeout de 6 segundos).",
            "",
            "Isso costuma ser uma instabilidade momentânea entre a Meta e o nosso servidor.",
            "O sistema tentará novamente sozinho na próxima verificação automática.",
            "",
            "O que fazer:",
            "• Nenhuma ação imediata é necessária.",
            "• Se receber 3+ avisos seguidos da MESMA instância em menos de 1 hora,",
            "  abra Configurar Meta → Diagnóstico dela e clique em \"Reinscrever webhook\".",
            "• Só se preocupe se pararem de chegar mensagens de clientes por mais de 30 minutos.",
            "",
            `Detalhe técnico: ${(erro || "").slice(0, 140)}`,
          ].join("\n");
        } else {
          emoji = "🚨";
          const motivoCurto = (erro || "desconhecido").replace(/\s+/g, " ").slice(0, 160);
          corpo = [
            "Não foi possível reconectar o recebimento de mensagens desta instância.",
            "Enquanto isso, mensagens novas de clientes podem não aparecer no Inbox.",
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
        const chave = `${inst.id}:${status}:${new Date().toISOString().slice(0, 13)}`;
        await notificarAdmin(supabase, {
          tipo: "meta_webhook_saude",
          mensagem,
          chaveIdempotencia: chave,
        });
      }


      resultados.push(out);
    }

    return new Response(JSON.stringify({ success: true, resultados }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err?.message || "Erro" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

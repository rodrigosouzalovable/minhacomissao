// Envia alerta WhatsApp via UAZAPI quando o orçamento de IA atinge limites.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function buildMessage(alertType: string, fnName: string | null, payload: any): string {
  switch (alertType) {
    case "threshold_warning":
      return `⚠️ *Lovable AI — Aviso de consumo*\n\nVocê já usou *${payload.pct}%* do limite diário (${payload.calls}/${payload.limit} chamadas).\n\nSe continuar nesse ritmo, a IA será bloqueada automaticamente para evitar gastos.\n\nAjuste em /admin/ia-uso`;
    case "daily_blocked":
      return `🚨 *Lovable AI BLOQUEADA*\n\nLimite diário de chamadas atingido (${payload.calls}/${payload.limit}).\n\n*Nenhuma chamada paga será feita até o próximo dia.* Para liberar agora, acesse /admin/ia-uso e aumente o limite.`;
    case "daily_blocked_chars":
      return `🚨 *Lovable AI BLOQUEADA (caracteres)*\n\nLimite diário de tokens/caracteres atingido (${(payload.chars/1000).toFixed(0)}k/${(payload.limit/1000).toFixed(0)}k).\n\nIA pausada até amanhã. Ajuste em /admin/ia-uso`;
    case "hourly_blocked":
      return `🚨 *Lovable AI — Pico anormal*\n\n${payload.calls} chamadas na última hora (limite: ${payload.limit}).\n\nIA pausada por 1h para investigação. Veja /admin/ia-uso`;
    case "function_limit":
      return `🛑 *Função IA bloqueada*\n\n\`${payload.function}\` atingiu ${payload.calls}/${payload.limit} chamadas hoje.\n\nOutras funções continuam ativas. Ajuste em /admin/ia-uso`;
    default:
      return `ℹ️ Lovable AI — alerta: ${alertType}\n${JSON.stringify(payload)}`;
  }
}

async function sendViaUazapi(serverUrl: string, instanceToken: string, telefone: string, mensagem: string) {
  const cleanUrl = serverUrl.replace(/\/+$/, "");
  const endpoints = [`${cleanUrl}/send/text`, `${cleanUrl}/message/sendText`, `${cleanUrl}/sendText`];
  let lastErr: any = null;
  for (const url of endpoints) {
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", token: instanceToken },
        body: JSON.stringify({ number: telefone, text: mensagem }),
      });
      const data = await r.json().catch(() => ({}));
      if (r.ok) return data;
      lastErr = data;
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(typeof lastErr === "string" ? lastErr : JSON.stringify(lastErr));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { alert_type, function_name, payload, phone } = await req.json();
    if (!alert_type || !phone) {
      return new Response(JSON.stringify({ error: "alert_type e phone obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Pega primeira instância ativa pra disparar
    const { data: inst } = await sb
      .from("user_whatsapp_instances")
      .select("instance_token, server_url")
      .eq("ativo", true)
      .not("instance_token", "is", null)
      .limit(1)
      .maybeSingle();

    const serverUrl = inst?.server_url || Deno.env.get("UAZAPI_SERVER_URL");
    const instToken = inst?.instance_token || Deno.env.get("UAZAPI_INSTANCE_TOKEN");

    if (!serverUrl || !instToken) {
      console.error("[ai-budget-alert] sem instância UAZAPI disponível");
      return new Response(JSON.stringify({ ok: false, error: "no_instance" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const phoneNorm = phone.replace(/\D/g, "");
    const phoneFull = phoneNorm.startsWith("55") ? phoneNorm : `55${phoneNorm}`;
    const msg = buildMessage(alert_type, function_name, payload ?? {});

    await sendViaUazapi(serverUrl, instToken, phoneFull, msg);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[ai-budget-alert]", e);
    return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "erro" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// Cron a cada 30min: calcula consumo, atualiza snapshot, dispara alertas preventivos.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const dayStart = new Date();
    dayStart.setUTCHours(3, 0, 0, 0);
    if (dayStart > new Date()) dayStart.setUTCDate(dayStart.getUTCDate() - 1);

    const { data: logs } = await sb
      .from("ai_usage_log")
      .select("function_name, prompt_chars, status")
      .gte("created_at", dayStart.toISOString());

    const okLogs = (logs ?? []).filter((l: any) => l.status === "ok");
    const blocked = (logs ?? []).filter((l: any) => l.status?.startsWith("blocked")).length;

    const byFn: Record<string, number> = {};
    let totalChars = 0;
    for (const l of okLogs) {
      byFn[l.function_name] = (byFn[l.function_name] ?? 0) + 1;
      totalChars += l.prompt_chars ?? 0;
    }
    const top = Object.entries(byFn).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    const today = new Date().toISOString().slice(0, 10);
    await sb.from("ai_daily_snapshot").upsert({
      data: today,
      total_calls: okLogs.length,
      total_chars: totalChars,
      blocked_calls: blocked,
      top_function: top,
      by_function: byFn,
      updated_at: new Date().toISOString(),
    });

    const { data: cfg } = await sb.from("ai_budget_config").select("*").eq("id", 1).maybeSingle();
    if (cfg) {
      const pct = (okLogs.length / Math.max(cfg.daily_limit_calls, 1)) * 100;
      if (pct >= cfg.alert_threshold_pct) {
        // Dispara alerta (anti-spam: 1x/dia via tabela ai_alerts_sent)
        const alertType = pct >= 100 ? "daily_blocked" : "threshold_warning";
        const { data: existing } = await sb
          .from("ai_alerts_sent")
          .select("id")
          .eq("data", today)
          .eq("alert_type", alertType)
          .eq("function_name", "")
          .maybeSingle();

        if (!existing) {
          await sb.from("ai_alerts_sent").insert({
            data: today, alert_type: alertType, function_name: "", phone: cfg.alert_phone,
            payload: { calls: okLogs.length, limit: cfg.daily_limit_calls, pct: Math.floor(pct) },
          });
          fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/ai-budget-alert`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            },
            body: JSON.stringify({
              alert_type: alertType, phone: cfg.alert_phone,
              payload: { calls: okLogs.length, limit: cfg.daily_limit_calls, pct: Math.floor(pct) },
            }),
          }).catch(() => {});
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, total_calls: okLogs.length, total_chars: totalChars, top }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[ai-budget-monitor]", e);
    return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "erro" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

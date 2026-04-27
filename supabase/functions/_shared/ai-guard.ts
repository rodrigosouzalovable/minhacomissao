// Helper compartilhado para controle de gasto de IA.
// - Verifica kill switch global (system_config.ai_enabled)
// - Verifica orçamento diário/horário (ai_budget_config + ai_usage_log)
// - Verifica limite por função (ai_function_limits)
// - Registra cada chamada em ai_usage_log
// - Dispara alertas WhatsApp quando próximo/atinge limite
// Modelo padrão barato: google/gemini-2.5-flash-lite

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const CHEAP_MODEL = "google/gemini-2.5-flash-lite";

function admin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

export async function isAiEnabled(): Promise<boolean> {
  try {
    const { data } = await admin()
      .from("system_config")
      .select("value")
      .eq("key", "ai_enabled")
      .maybeSingle();
    if (!data) return true;
    const v = (data as any).value;
    if (typeof v === "boolean") return v;
    if (typeof v === "string") return v !== "false";
    return v !== false;
  } catch {
    return true;
  }
}

export type BudgetCheck = {
  allowed: boolean;
  reason?: string;
  daily_calls?: number;
  daily_chars?: number;
  hourly_calls?: number;
  function_calls?: number;
  config?: any;
};

export async function checkBudget(functionName: string): Promise<BudgetCheck> {
  try {
    const sb = admin();

    // 0. Kill switch global
    if (!(await isAiEnabled())) {
      return { allowed: false, reason: "kill_switch_global" };
    }

    // 1. Carrega config
    const { data: cfg } = await sb
      .from("ai_budget_config")
      .select("*")
      .eq("id", 1)
      .maybeSingle();

    if (!cfg) return { allowed: true };

    const dayStart = new Date();
    dayStart.setUTCHours(3, 0, 0, 0); // 00:00 BRT = 03:00 UTC
    if (dayStart > new Date()) dayStart.setUTCDate(dayStart.getUTCDate() - 1);
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);

    // 2. Conta uso do dia (apenas chamadas que efetivamente foram pra IA)
    const { data: dayLogs } = await sb
      .from("ai_usage_log")
      .select("function_name, prompt_chars, status")
      .gte("created_at", dayStart.toISOString())
      .eq("status", "ok");

    const dailyCalls = dayLogs?.length ?? 0;
    const dailyChars = (dayLogs ?? []).reduce((s: number, r: any) => s + (r.prompt_chars ?? 0), 0);
    const functionCalls = (dayLogs ?? []).filter((r: any) => r.function_name === functionName).length;

    // 3. Conta uso da última hora
    const { count: hourlyCalls } = await sb
      .from("ai_usage_log")
      .select("*", { count: "exact", head: true })
      .gte("created_at", hourAgo.toISOString())
      .eq("status", "ok");

    const result: BudgetCheck = {
      allowed: true,
      daily_calls: dailyCalls,
      daily_chars: dailyChars,
      hourly_calls: hourlyCalls ?? 0,
      function_calls: functionCalls,
      config: cfg,
    };

    // 4. Limite por função
    const { data: fnLimit } = await sb
      .from("ai_function_limits")
      .select("daily_limit, enabled")
      .eq("function_name", functionName)
      .maybeSingle();

    if (fnLimit) {
      if (!fnLimit.enabled) {
        return { ...result, allowed: false, reason: "function_disabled" };
      }
      if (functionCalls >= fnLimit.daily_limit) {
        await fireAlertOnce(sb, "function_limit", functionName, cfg, {
          function: functionName,
          calls: functionCalls,
          limit: fnLimit.daily_limit,
        });
        return { ...result, allowed: false, reason: "function_daily_limit" };
      }
    }

    // 5. Limites globais
    if (cfg.auto_block_on_limit) {
      if (dailyCalls >= cfg.daily_limit_calls) {
        await fireAlertOnce(sb, "daily_blocked", null, cfg, { calls: dailyCalls, limit: cfg.daily_limit_calls });
        return { ...result, allowed: false, reason: "daily_calls_limit" };
      }
      if (dailyChars >= cfg.daily_limit_chars) {
        await fireAlertOnce(sb, "daily_blocked_chars", null, cfg, { chars: dailyChars, limit: cfg.daily_limit_chars });
        return { ...result, allowed: false, reason: "daily_chars_limit" };
      }
      if ((hourlyCalls ?? 0) >= cfg.hourly_limit_calls) {
        await fireAlertOnce(sb, "hourly_blocked", null, cfg, { calls: hourlyCalls, limit: cfg.hourly_limit_calls });
        return { ...result, allowed: false, reason: "hourly_calls_limit" };
      }
    }

    // 6. Alerta preventivo (threshold %)
    const pct = (dailyCalls / Math.max(cfg.daily_limit_calls, 1)) * 100;
    if (pct >= cfg.alert_threshold_pct && pct < 100) {
      await fireAlertOnce(sb, "threshold_warning", null, cfg, {
        calls: dailyCalls,
        limit: cfg.daily_limit_calls,
        pct: Math.floor(pct),
      });
    }

    return result;
  } catch (e) {
    console.error("[ai-guard] checkBudget failed", e);
    return { allowed: true }; // não derruba sistema se falhar
  }
}

async function fireAlertOnce(sb: any, alertType: string, fnName: string | null, cfg: any, payload: any) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const { data: exists } = await sb
      .from("ai_alerts_sent")
      .select("id")
      .eq("data", today)
      .eq("alert_type", alertType)
      .eq("function_name", fnName ?? "")
      .maybeSingle();

    if (exists) return;

    await sb.from("ai_alerts_sent").insert({
      data: today,
      alert_type: alertType,
      function_name: fnName ?? "",
      phone: cfg.alert_phone,
      payload,
    });

    // Dispara WhatsApp em background
    const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/ai-budget-alert`;
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({ alert_type: alertType, function_name: fnName, payload, phone: cfg.alert_phone }),
    }).catch((e) => console.error("[ai-guard] alert dispatch failed", e));
  } catch (e) {
    console.error("[ai-guard] fireAlertOnce failed", e);
  }
}

export async function logAiUsage(params: {
  function_name: string;
  model?: string;
  user_id?: string | null;
  prompt_chars?: number;
  status?: string;
  error?: string;
}) {
  try {
    await admin().from("ai_usage_log").insert({
      function_name: params.function_name,
      model: params.model ?? null,
      user_id: params.user_id ?? null,
      prompt_chars: params.prompt_chars ?? null,
      status: params.status ?? null,
      error: params.error ?? null,
    });
  } catch (e) {
    console.error("[ai-guard] log failed", e);
  }
}

export function aiDisabledResponse(corsHeaders: Record<string, string>, extra?: Record<string, unknown>) {
  return new Response(
    JSON.stringify({
      error: "IA temporariamente desativada (kill switch ou limite de orçamento atingido).",
      ai_disabled: true,
      ...(extra ?? {}),
    }),
    { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

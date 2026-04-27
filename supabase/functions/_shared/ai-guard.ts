// Helper compartilhado para controle de gasto de IA.
// - Verifica kill switch global (system_config.ai_enabled)
// - Registra cada chamada em ai_usage_log
// - Modelo padrão barato: google/gemini-2.5-flash-lite

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
      error: "IA temporariamente desativada pelo administrador.",
      ai_disabled: true,
      ...(extra ?? {}),
    }),
    { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

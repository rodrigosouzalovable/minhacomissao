import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sincronizarTemplatesMeta } from "../_shared/sincronizar-templates-meta.ts";
import { runBoundedSync } from "../_shared/meta-sync-bounded.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
// Parallel bounded reads, without new schedules or retries.
const MAX_INSTANCES_PER_RUN = 500;
const LOCK_MINUTES = 30;

const json = (payload: unknown, status = 200) => new Response(JSON.stringify(payload), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  // Bound ALL network operations, including auth, lock RPCs and finalization.
  const requestDeadline = AbortSignal.timeout(115_000);
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    global: { fetch: (input, init) => fetch(input, {
      ...init,
      signal: AbortSignal.any([
        requestDeadline,
        AbortSignal.timeout(15_000),
        ...(init?.signal ? [init.signal] : []),
      ]),
    }) },
  });
  let ownsLock = false;

  try {
    const body = await req.json().catch(() => ({}));
    const auto = body?.auto === true;
    const force = body?.force === true;
    const completeUtility = body?.complete_utility === true && !auto;

    if (!auto) {
      const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
      if (!token) return json({ success: false, error: "nao_autenticado" }, 401);
      const { data: userData } = await supabase.auth.getUser(token);
      const userId = userData?.user?.id;
      if (!userId) return json({ success: false, error: "nao_autenticado" }, 401);
      const { data: admin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
      if (admin !== true) return json({ success: false, error: "somente_admin" }, 403);
    }

    if (body?.status_only === true) {
      const { data: state, error: stateError } = await supabase
        .from("meta_templates_sync_state")
        .select("status,last_started_at,last_completed_at,last_success,processed_instances,synced_templates,failures")
        .eq("id", true)
        .maybeSingle();
      if (stateError) return json({ success: false, error: stateError.message }, 500);
      return json({ success: true, state });
    }

    const { data: lockAcquired, error: lockError } = await supabase.rpc("claim_meta_templates_sync_diario", {
      p_force: force,
      p_lock_minutes: LOCK_MINUTES,
    });
    if (lockError) return json({ success: false, error: lockError.message }, 500);
    if (lockAcquired !== true) return json({ success: true, skipped: "execucao_em_andamento_ou_ja_concluida_hoje" });
    ownsLock = true;

    const { data: partnerRows, error: partnerError } = await supabase.from("meta_instance_parceiros").select("instancia_id");
    if (partnerError) throw partnerError;
    const partnerIds = new Set<string>((partnerRows || []).map((row: any) => row.instancia_id));
    const { data: instances, error: instancesError } = await supabase
      .from("meta_whatsapp_instances")
      .select("id,nome,waba_id,access_token")
      .eq("ativo", true)
      .eq("provider", "meta")
      .not("waba_id", "is", null)
      .not("access_token", "is", null)
      .order("id", { ascending: true })
      .limit(MAX_INSTANCES_PER_RUN);
    if (instancesError) throw instancesError;

    const eligible = (instances || []).filter((instance: any) => !partnerIds.has(instance.id));
    let syncedTemplates = 0;
    const failures: Array<{ id: string; nome: string; error: string }> = [];

    const results = await runBoundedSync(eligible,
      (instance, signal) => sincronizarTemplatesMeta(supabase, instance, signal),
      () => ({ success: false, synced: 0, pages: 0, error: "Prazo atingido; tente novamente para completar as instâncias pendentes." }),
    );
    for (let index = 0; index < eligible.length; index++) {
      const instance = eligible[index];
      const result = results[index];
      if (result.success) syncedTemplates += result.synced;
      else failures.push({ id: instance.id, nome: instance.nome || instance.id, error: result.error || "Falha desconhecida" });
    }

    const { error: finishError } = await supabase.rpc("finish_meta_templates_sync_diario", {
      p_success: failures.length === 0,
      p_processed: eligible.length,
      p_synced: syncedTemplates,
      p_failures: failures,
    });
    if (finishError) throw finishError;
    ownsLock = false;

    const audit = await supabase.functions.invoke("meta-templates-auditar-instancias", {
      signal: AbortSignal.timeout(15_000),
      body: {
        auto: true,
        dry_run: false,
        utility_approved_only: completeUtility,
      },
    }).catch(() => ({ error: { message: "A conferência de cobertura não respondeu no prazo; tente novamente." }, data: null }));

    return json({
      success: failures.length === 0,
      instances: eligible.length,
      synced: syncedTemplates,
      failures,
      audit: audit.error ? { success: false, error: audit.error.message } : audit.data,
    });
  } catch (error) {
    if (ownsLock) await supabase.rpc("finish_meta_templates_sync_diario", {
      p_success: false,
      p_processed: 0,
      p_synced: 0,
      p_failures: [{ error: error instanceof Error ? error.message : String(error) }],
    });
    return json({ success: false, error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
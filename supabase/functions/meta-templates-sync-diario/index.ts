import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sincronizarTemplatesMeta } from "../_shared/sincronizar-templates-meta.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const MAX_INSTANCES_PER_RUN = 80;
const LOCK_MINUTES = 30;

const json = (payload: unknown, status = 200) => new Response(JSON.stringify(payload), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const body = await req.json().catch(() => ({}));
    const force = body?.force === true;
    const { data: lockAcquired, error: lockError } = await supabase.rpc("claim_meta_templates_sync_diario", {
      p_force: force,
      p_lock_minutes: LOCK_MINUTES,
    });
    if (lockError) return json({ success: false, error: lockError.message }, 500);
    if (lockAcquired !== true) return json({ success: true, skipped: "execucao_em_andamento_ou_ja_concluida_hoje" });

    const { data: partnerRows } = await supabase.from("meta_instance_parceiros").select("instancia_id");
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

    for (const instance of eligible) {
      const result = await sincronizarTemplatesMeta(supabase, instance);
      if (result.success) syncedTemplates += result.synced;
      else failures.push({ id: instance.id, nome: instance.nome || instance.id, error: result.error || "Falha desconhecida" });
    }

    await supabase.rpc("finish_meta_templates_sync_diario", {
      p_success: failures.length === 0,
      p_processed: eligible.length,
      p_synced: syncedTemplates,
      p_failures: failures,
    });

    const audit = await supabase.functions.invoke("meta-templates-auditar-instancias", {
      body: { auto: true, dry_run: false },
    });

    return json({
      success: failures.length === 0,
      instances: eligible.length,
      synced: syncedTemplates,
      failures,
      audit: audit.error ? { success: false, error: audit.error.message } : audit.data,
    });
  } catch (error) {
    await supabase.rpc("finish_meta_templates_sync_diario", {
      p_success: false,
      p_processed: 0,
      p_synced: 0,
      p_failures: [{ error: error instanceof Error ? error.message : String(error) }],
    });
    return json({ success: false, error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
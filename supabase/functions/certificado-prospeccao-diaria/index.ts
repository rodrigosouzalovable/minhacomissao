import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const service = createClient(url, key);
    const { data: cfg, error } = await service.from("certificado_config").select("prospeccao_ativa").limit(1).maybeSingle();
    if (error) throw error;
    if (cfg?.prospeccao_ativa !== true) return json({ success: true, skipped: true, motivo: "Piloto desativado" });
    const response = await fetch(`${url}/functions/v1/certificado-prospeccao-processar`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ iniciar_completo: true, automatico: true }),
    });
    const result = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    return json(result, response.ok ? 200 : response.status);
  } catch (error) {
    console.error("certificado-prospeccao-diaria", error);
    return json({ error: error instanceof Error ? error.message : "Falha no início diário" }, 500);
  }
});
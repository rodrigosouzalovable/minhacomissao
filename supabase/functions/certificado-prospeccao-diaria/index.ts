import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const brt = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    if (brt.getDay() === 0 || brt.getDay() === 6 || brt.getHours() !== 9) return json({ success: true, skipped: true, motivo: "Fora do horário diário das 09h BRT" });
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const service = createClient(url, key);
    const { data: cfg, error } = await service.from("certificado_config").select("prospeccao_ativa").limit(1).maybeSingle();
    if (error) throw error;
    if (cfg?.prospeccao_ativa !== true) return json({ success: true, skipped: true, motivo: "Piloto desativado" });
    const processamento = fetch(`${url}/functions/v1/certificado-prospeccao-processar`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ iniciar_completo: true, automatico: true }),
    }).then(async (response) => {
      const result = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
      if (!response.ok || result?.error) {
        console.error("certificado-prospeccao-diaria processamento", { status: response.status, result });
      } else {
        console.log("certificado-prospeccao-diaria processamento concluído", result);
      }
    }).catch((error) => {
      console.error("certificado-prospeccao-diaria processamento", error);
    });
    EdgeRuntime.waitUntil(processamento);
    return json({ success: true, iniciado: true, motivo: "Processamento diário iniciado" }, 202);
  } catch (error) {
    console.error("certificado-prospeccao-diaria", error);
    return json({ error: error instanceof Error ? error.message : "Falha no início diário" }, 500);
  }
});
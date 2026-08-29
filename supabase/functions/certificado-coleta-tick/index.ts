import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { coletarJanela } from "../_shared/certificado-ingest.ts";

function resposta(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: cfg, error: cfgError } = await service
      .from("certificado_config")
      .select("id, motor_ativo, ufs, cnaes, janelas_dias, somente_mei, somente_celular")
      .limit(1)
      .maybeSingle();
    if (cfgError) throw cfgError;

    // A coleta automática nunca consome a API enquanto o motor estiver desligado.
    if (!cfg?.motor_ativo) {
      return resposta({ success: true, skipped: true, message: "Motor desligado" });
    }

    const janelas = [...new Set((cfg.janelas_dias ?? []).map(Number))]
      .filter((n) => Number.isInteger(n) && n >= 0 && n <= 30)
      .sort((a, b) => a - b);
    const resultados = [];
    for (const janela of janelas) {
      resultados.push(await coletarJanela(service, cfg, janela, false));
    }

    const falhas = resultados.filter((r) => r.erro).length;
    await service.from("certificado_config").update({
      ultima_execucao: new Date().toISOString(),
      ultimo_status: falhas ? `Concluído com ${falhas} erro(s)` : "Concluído",
      total_coletado: resultados.reduce((sum, r) => sum + r.novos, 0),
    }).eq("id", cfg.id);

    return resposta({ success: falhas === 0, resultados });
  } catch (error) {
    console.error("certificado-coleta-tick", error);
    return resposta({ error: error instanceof Error ? error.message : "Falha na coleta automática" }, 500);
  }
});

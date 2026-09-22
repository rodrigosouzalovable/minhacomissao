import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { coletarJanela } from "../_shared/certificado-ingest.ts";
import { verificarLeadsCertificado } from "../_shared/certificado-whatsapp.ts";

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
      .select("id, motor_ativo, ufs, cnaes, janelas_dias, somente_mei, somente_celular, limite_diario")
      .limit(1)
      .maybeSingle();
    if (cfgError) throw cfgError;

    // A coleta automática nunca consome a API enquanto o motor estiver desligado.
    if (!cfg?.motor_ativo) {
      return resposta({ success: true, skipped: true, message: "Motor desligado" });
    }

    const limiteDiario = Math.max(1, Number(cfg.limite_diario ?? 50));
    const { count: confirmados, error: confirmadosError } = await service.from("certificado_leads")
      .select("id", { count: "exact", head: true })
      .eq("situacao", "novo").eq("whatsapp_status", "com_whatsapp").not("telefone_principal", "is", null);
    if (confirmadosError) throw confirmadosError;
    if (Number(confirmados ?? 0) >= limiteDiario) {
      await service.from("certificado_config").update({
        ultima_execucao: new Date().toISOString(),
        ultimo_status: `Coleta economizada: ${confirmados} contatos locais confirmados`,
      }).eq("id", cfg.id);
      return resposta({ success: true, skipped: true, motivo: "Estoque local confirmado suficiente", confirmados, limite_diario: limiteDiario });
    }

    const { count: pendentes, error: pendentesError } = await service.from("certificado_leads")
      .select("id", { count: "exact", head: true })
      .eq("situacao", "novo").in("whatsapp_status", ["pendente", "nao_verificado", "erro_temporario"]).not("telefone_principal", "is", null);
    if (pendentesError) throw pendentesError;
    if (Number(pendentes ?? 0) > 0) {
      const faltam = Math.max(1, limiteDiario - Number(confirmados ?? 0));
      const verificacao = await verificarLeadsCertificado(service, Math.min(faltam, Number(pendentes)));
      await service.from("certificado_config").update({
        ultima_execucao: new Date().toISOString(),
        ultimo_status: `Coleta economizada: estoque local verificado para ${limiteDiario} envios`,
      }).eq("id", cfg.id);
      return resposta({ success: true, skipped: true, motivo: "Estoque local pendente priorizado", verificacao, limite_diario: limiteDiario });
    }

    const janelas = [...new Set((cfg.janelas_dias ?? []).map(Number))]
      .filter((n) => Number.isInteger(n) && n >= 0 && n <= 30)
      .sort((a, b) => a - b);
    const resultados = [];
    for (const janela of janelas) {
      resultados.push(await coletarJanela(service, cfg, janela, false));
    }

    const falhas = resultados.filter((r) => r.erro).length;
    const verificacao = await verificarLeadsCertificado(service, limiteDiario);
    await service.from("certificado_config").update({
      ultima_execucao: new Date().toISOString(),
      ultimo_status: falhas ? `Concluído com ${falhas} erro(s)` : "Concluído",
      total_coletado: resultados.reduce((sum, r) => sum + r.novos, 0),
    }).eq("id", cfg.id);

    return resposta({ success: falhas === 0, resultados, verificacao });
  } catch (error) {
    console.error("certificado-coleta-tick", error);
    return resposta({ error: error instanceof Error ? error.message : "Falha na coleta automática" }, 500);
  }
});

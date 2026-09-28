import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { coletarJanela } from "../_shared/certificado-ingest.ts";
import { verificarLeadsCertificado } from "../_shared/certificado-whatsapp.ts";
import { CNAES_PILOTO, datasRenovacaoPorPrioridade, etapaCertificado } from "../_shared/certificado-experimento.ts";

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

    const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    if ([0, 6].includes(new Date(`${hoje}T12:00:00Z`).getUTCDay())) {
      return resposta({ success: true, skipped: true, motivo: "Coleta limitada a dias úteis" });
    }
    const etapa = etapaCertificado(hoje);
    if (!etapa) return resposta({ success: true, skipped: true, motivo: "Fora do calendário do piloto" });
    const datasAlvo = etapa.tipo === "renovacao_anual" ? datasRenovacaoPorPrioridade(hoje) : [etapa.dataAlvo];
    const filtro = (query: any) => query.in("cnae", CNAES_PILOTO).in("data_abertura", datasAlvo);

    const { data: marcadas, error: instanciasError } = await service.from("meta_whatsapp_instances")
      .select("id, certificado_limite_diario, saude_quality, saude_ban_info, pausa_automatica_ate").eq("provider", "meta").eq("ativo", true)
      .eq("instancia_teste_aquecimento", false).eq("aquecimento_meta_ativo", true)
      .eq("saude_status", "CONNECTED")
      .eq("estado_pool", "ativo").eq("pool_fora_manual", false);
    if (instanciasError) throw instanciasError;
    const saudaveis = (marcadas ?? []).filter((i: any) => ["GREEN", "UNKNOWN", ""].includes(String(i.saude_quality ?? "").toUpperCase()) && !i.saude_ban_info && (!i.pausa_automatica_ate || new Date(i.pausa_automatica_ate) <= new Date()));
    const { data: modelos, error: modelosError } = await service.from("meta_whatsapp_templates")
      .select("instancia_id").in("instancia_id", saudaveis.length ? saudaveis.map((i: any) => i.id) : ["00000000-0000-0000-0000-000000000000"])
      .eq("nome_template", "cnpj_atualizado_2").eq("idioma", "pt_BR").eq("status", "approved");
    if (modelosError) throw modelosError;
    const aprovadas = new Set((modelos ?? []).map((m: any) => m.instancia_id));
    const limiteDiario = Math.min(2500, saudaveis.filter((i: any) => aprovadas.has(i.id)).reduce((total: number, i: any) => total + Math.min(50, Math.max(0, Number(i.certificado_limite_diario ?? 50))), 0));
    if (!limiteDiario) return resposta({ success: true, skipped: true, motivo: "Nenhuma instância marcada está apta e com modelo aprovado" });
    const { count: confirmados, error: confirmadosError } = await filtro(service.from("certificado_leads")
      .select("id", { count: "exact", head: true })
      .eq("situacao", "novo").eq("whatsapp_status", "com_whatsapp").not("telefone_principal", "is", null));
    if (confirmadosError) throw confirmadosError;
    if (Number(confirmados ?? 0) >= limiteDiario) {
      await service.from("certificado_config").update({
        ultima_execucao: new Date().toISOString(),
        ultimo_status: `Coleta economizada: ${confirmados} contatos locais confirmados`,
      }).eq("id", cfg.id);
      return resposta({ success: true, skipped: true, motivo: "Estoque local confirmado suficiente", confirmados, limite_diario: limiteDiario });
    }

    const { count: pendentes, error: pendentesError } = await filtro(service.from("certificado_leads")
      .select("id", { count: "exact", head: true })
      .eq("situacao", "novo").in("whatsapp_status", ["pendente", "nao_verificado", "erro_temporario"]).not("telefone_principal", "is", null));
    if (pendentesError) throw pendentesError;
    if (Number(pendentes ?? 0) > 0) {
      const faltam = Math.max(1, limiteDiario - Number(confirmados ?? 0));
       const verificacao = await verificarLeadsCertificado(service, Math.min(faltam, Number(pendentes)), undefined, undefined, undefined, CNAES_PILOTO, undefined, datasAlvo);
      await service.from("certificado_config").update({
        ultima_execucao: new Date().toISOString(),
        ultimo_status: `Coleta economizada: estoque local verificado para ${limiteDiario} envios`,
      }).eq("id", cfg.id);
      return resposta({ success: true, skipped: true, motivo: "Estoque local pendente priorizado", verificacao, limite_diario: limiteDiario });
    }

    const resultados = [await coletarJanela(service, { ...cfg, cnaes: CNAES_PILOTO, somente_mei: false }, etapa.janela, false, {
      maxPaginas: 10,
      dataReferencia: datasAlvo[datasAlvo.length - 2] ?? etapa.dataAlvo,
      dataFim: datasAlvo[datasAlvo.length - 1] ?? etapa.dataAlvo,
    })];

    const falhas = resultados.filter((r) => r.erro).length;
    const verificacao = await verificarLeadsCertificado(service, limiteDiario, undefined, undefined, undefined, CNAES_PILOTO, undefined, datasAlvo);
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

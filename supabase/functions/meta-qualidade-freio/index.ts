// Freio de qualidade por engajamento (cron a cada 30min).
// Para cada instância Meta oficial ativa, calcula resposta%/não lidas% nas últimas 24h
// e grava o teto efetivo do dia em meta_instance_freio_diario.
// Números com engajamento ruim têm o teto cortado pela metade; se resposta E leitura
// estiverem ruins ao mesmo tempo, o número é pausado no dia (teto = 0).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  aplicarFreio,
  enviadosHojeBrt,
  faseFromDias,
  metricas24h,
  tetoBase,
} from "../_shared/meta-freio.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: cfg } = await supabase
      .from("meta_envio_pool_config").select("*").eq("id", 1).maybeSingle();

    if (cfg?.freio_ativo === false) {
      return new Response(JSON.stringify({ ok: true, skipped: "freio_desativado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: insts } = await supabase
      .from("meta_whatsapp_instances")
      .select("id, nome, display_phone, tier_diario, teto_escada, data_ativacao_api, saude_quality, ativo, provider")
      .eq("ativo", true)
      .eq("provider", "meta");

    const hoje = new Date(
      new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }),
    ).toISOString().slice(0, 10);

    const resultados: any[] = [];

    for (const inst of (insts || []) as any[]) {
      const dias = inst.data_ativacao_api
        ? Math.floor((Date.now() - new Date(inst.data_ativacao_api).getTime()) / 86400000) + 1
        : 999;
      const fase = inst.data_ativacao_api ? faseFromDias(dias) : "livre";

      const base = tetoBase(inst, cfg, fase);
      const m = await metricas24h(supabase, inst.id);
      const { teto, motivo } = aplicarFreio(base, m, cfg);
      const enviados = await enviadosHojeBrt(supabase, inst.id);

      await supabase.from("meta_instance_freio_diario").upsert({
        instancia_id: inst.id,
        dia: hoje,
        teto_efetivo: teto,
        enviados,
        resposta_pct: Number(m.respostaPct.toFixed(2)),
        nao_lidas_pct: Number(m.naoLidasPct.toFixed(2)),
        motivo_reducao: motivo,
        atualizado_em: new Date().toISOString(),
      }, { onConflict: "instancia_id,dia" });

      resultados.push({
        instancia: inst.nome || inst.display_phone,
        fase,
        teto_base: base,
        teto_efetivo: teto,
        enviados,
        resposta_pct: Number(m.respostaPct.toFixed(1)),
        nao_lidas_pct: Number(m.naoLidasPct.toFixed(1)),
        motivo,
      });
    }

    // Avisa o admin sobre números freados (1x por dia por número)
    const freados = resultados.filter((r) => r.motivo);
    if (freados.length > 0) {
      try {
        const { notificarAdmin } = await import("../_shared/notificar-admin.ts");
        const linhas = freados
          .map((r) => `• *${r.instancia}* → teto ${r.teto_efetivo}/dia — ${r.motivo}`)
          .join("\n");
        await notificarAdmin(supabase, {
          tipo: "meta_freio_qualidade",
          mensagem:
            `🧯 *Freio de qualidade aplicado*\n\n${linhas}\n\n` +
            `Motivo: engajamento baixo nas últimas 24h. O teto volta ao normal automaticamente quando as respostas/leituras melhorarem.`,
          chaveIdempotencia: `meta_freio_${hoje}_${freados.length}`,
          umaVezPorChave: true,
        });
      } catch (e) {
        console.log("[freio] notificarAdmin falhou:", String(e).slice(0, 200));
      }
    }

    return new Response(JSON.stringify({ ok: true, total: resultados.length, resultados }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "erro" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

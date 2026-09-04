// Guardião de engajamento (cron a cada 10 min, 09h-19h BRT, sem domingo).
// Mede, por número da API oficial, quantas mensagens saíram e quantas voltaram
// na janela curta (padrão 4h). Quando a taxa de resposta cai, o sistema:
//   1) reduz o ritmo do número na campanha (fator 0,6 / 0,3 / 0);
//   2) liga o aquecimento com os números da UAZAPI que respondem sozinhos;
//   3) avisa no WhatsApp do admin (1x por número/faixa/dia).
// A faixa fica gravada em meta_instance_freio_diario (guardiao_faixa/fator) e é
// lida por pick-meta-instance no rodízio da campanha.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DESTINOS = ["5562991672674", "5562994300880"];

type Faixa = "ok" | "atencao" | "forte" | "corte";

const FATOR: Record<Faixa, number> = { ok: 1, atencao: 0.6, forte: 0.3, corte: 0 };
const ALVO_AQUEC: Record<Faixa, number> = { ok: 0, atencao: 3, forte: 6, corte: 10 };

function nowBrt(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
}
function hojeBrt(): string {
  return nowBrt().toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const body = await req.json().catch(() => ({}));
    const forcar = body?.forcar === true;

    const { data: cfg } = await supabase
      .from("meta_envio_pool_config").select("*").eq("id", 1).maybeSingle();

    if (cfg?.guardiao_ativo === false && !forcar) {
      return json({ ok: true, skipped: "guardiao_desativado" });
    }

    const agora = nowBrt();
    if (!forcar) {
      if (agora.getDay() === 0) return json({ ok: true, skipped: "domingo" });
      const h = agora.getHours();
      if (h < 9 || h >= 19) return json({ ok: true, skipped: "fora_da_janela" });
    }

    const janelaH = Math.max(1, Number(cfg?.guardiao_janela_horas ?? 4));
    const minSaidas = Math.max(10, Number(cfg?.guardiao_min_saidas ?? 60));
    const pctAtencao = Number(cfg?.resp_pct_atencao ?? 18);
    const pctForte = Number(cfg?.resp_pct_forte ?? 12);
    const pctCorte = Number(cfg?.resp_pct_corte ?? 8);

    // Só números próprios da API oficial (fora parceiros e espelhos UAZAPI)
    const [{ data: insts }, { data: parceiros }] = await Promise.all([
      supabase
        .from("meta_whatsapp_instances")
        .select("id, nome, display_phone, saude_quality, aquecimento_meta_ativo, recuperacao_ativa, tier_diario, provider, ativo")
        .eq("provider", "meta")
        .eq("ativo", true),
      supabase.from("meta_instance_parceiros").select("instancia_id"),
    ]);
    const idsParceiros = new Set((parceiros || []).map((p: any) => p.instancia_id));
    const alvos = (insts || []).filter((i: any) => !idsParceiros.has(i.id));

    const dia = hojeBrt();
    const desde = new Date(Date.now() - janelaH * 3600 * 1000).toISOString();
    const resultados: any[] = [];
    const avisos: string[] = [];

    for (const inst of alvos as any[]) {
      const nome = inst.nome || inst.display_phone || inst.id.slice(0, 8);

      const [{ count: saidas }, { count: entradas }] = await Promise.all([
        supabase.from("meta_whatsapp_mensagens")
          .select("id", { count: "exact", head: true })
          .eq("instancia_id", inst.id).eq("direcao", "saida").gte("criado_em", desde),
        supabase.from("meta_whatsapp_mensagens")
          .select("id", { count: "exact", head: true })
          .eq("instancia_id", inst.id).eq("direcao", "entrada").gte("criado_em", desde),
      ]);

      const s = saidas || 0;
      const e = entradas || 0;
      if (s < minSaidas) {
        resultados.push({ instancia: nome, saidas: s, entradas: e, faixa: "sem_volume" });
        continue;
      }

      const respostaPct = (e / s) * 100;
      let faixa: Faixa = "ok";
      if (respostaPct < pctCorte) faixa = "corte";
      else if (respostaPct < pctForte) faixa = "forte";
      else if (respostaPct < pctAtencao) faixa = "atencao";

      const fator = FATOR[faixa];
      const motivo = faixa === "ok"
        ? null
        : `guardiao_resposta: ${respostaPct.toFixed(1)}% de resposta em ${janelaH}h (${e}/${s})`;

      await supabase.from("meta_instance_freio_diario").upsert({
        instancia_id: inst.id,
        dia,
        guardiao_faixa: faixa,
        guardiao_fator: fator,
        guardiao_resposta_pct: Number(respostaPct.toFixed(2)),
        guardiao_atualizado_em: new Date().toISOString(),
        motivo_reducao: motivo,
        atualizado_em: new Date().toISOString(),
      }, { onConflict: "instancia_id,dia" });

      // Liga o aquecimento com os números da UAZAPI para gerar conversa real
      if (faixa !== "ok") {
        const alvoDia = ALVO_AQUEC[faixa];
        if (inst.aquecimento_meta_ativo !== true) {
          await supabase.from("meta_whatsapp_instances").update({
            aquecimento_meta_ativo: true,
          }).eq("id", inst.id);
        }
        await supabase.from("meta_whatsapp_instances").update({
          recuperacao_proximo_envio_em: new Date().toISOString(),
        }).eq("id", inst.id);

        const { data: trilha } = await supabase
          .from("meta_aquecimento_trilha")
          .select("id, alvo_unicos_dia")
          .eq("instancia_id", inst.id).eq("dia", dia).maybeSingle();

        if (trilha) {
          if (Number(trilha.alvo_unicos_dia || 0) < alvoDia) {
            await supabase.from("meta_aquecimento_trilha")
              .update({ alvo_unicos_dia: alvoDia, mix_uazapi_pct: 100, mix_leads_pct: 0, status: "ativa" })
              .eq("id", trilha.id);
          }
        } else {
          await supabase.from("meta_aquecimento_trilha").insert({
            instancia_id: inst.id,
            dia,
            tier_atual: Number(inst.tier_diario || 0),
            tier_alvo: Number(inst.tier_diario || 0),
            alvo_unicos_dia: alvoDia,
            unicos_7d: 0,
            mix_uazapi_pct: 100,
            mix_leads_pct: 0,
            status: "ativa",
            decisao_ia: { origem: "guardiao_engajamento", resposta_pct: Number(respostaPct.toFixed(2)) },
          });
        }

        const rotuloFaixa = faixa === "atencao"
          ? "ritmo reduzido a 60% + aquecimento"
          : faixa === "forte"
          ? "ritmo reduzido a 30% + aquecimento forte"
          : "fora da campanha hoje, só aquecimento";
        avisos.push(
          `• *${nome}* — resposta ${respostaPct.toFixed(1)}% (${e} de ${s} em ${janelaH}h)\n   ➜ ${rotuloFaixa}`,
        );
      }

      resultados.push({
        instancia: nome,
        saidas: s,
        entradas: e,
        resposta_pct: Number(respostaPct.toFixed(1)),
        faixa,
        fator,
      });
    }

    // Dispara uma rodada de aquecimento imediata quando houve alguém freado
    if (avisos.length > 0) {
      try {
        await supabase.functions.invoke("meta-aquecimento-tick", { body: { forcar: true } });
      } catch (err) {
        console.log("[guardiao] tick falhou:", String(err).slice(0, 200));
      }

      try {
        const { notificarAdmin } = await import("../_shared/notificar-admin.ts");
        await notificarAdmin(supabase, {
          tipo: "meta_guardiao_engajamento",
          mensagem:
            `🛡️ *Guardião de engajamento*\n\n${avisos.join("\n")}\n\n` +
            `Motivo: poucas respostas nas últimas ${janelaH}h. O aquecimento com os números da UAZAPI já foi acionado e o ritmo volta ao normal sozinho quando a taxa de resposta subir.`,
          chaveIdempotencia: `meta_guardiao_${dia}_${avisos.length}`,
          umaVezPorChave: true,
          destinatarios: DESTINOS,
        });
      } catch (err) {
        console.log("[guardiao] notificarAdmin falhou:", String(err).slice(0, 200));
      }
    }

    return new Response(JSON.stringify({ ok: true, dia, janela_horas: janelaH, total: resultados.length, freados: avisos.length, resultados }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "erro" }, 500);
  }
});

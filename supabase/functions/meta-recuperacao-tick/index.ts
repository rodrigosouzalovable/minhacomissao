// Recuperação automática de qualidade dos números Meta (cron a cada 10 min).
// Números marcados com recuperacao_ativa (queda para YELLOW/RED) enviam, sozinhos,
// um volume baixo de mensagens para os números UAZAPI da pasta AQUECIMENTO, que o
// IAGO responde automaticamente — gerando entrada real e leitura.
//
// Limites obrigatórios (anti-ban e anti-storm):
//  - 09h–19h BRT, nunca domingo
//  - 10 a 20 mensagens/dia por número (5 se a qualidade piorou de novo)
//  - intervalo aleatório de 20 a 40 min entre mensagens do mesmo número
//  - no máximo 2 conversas por destino por dia e nunca o mesmo destino em sequência
//  - no máximo 8 números processados por execução (1 mensagem cada)
//  - erro fatal da Meta (conta travada/pagamento) desliga a recuperação do número
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  dentroJanelaAquecimento,
  destinosAquecimento,
  enviarTemplateAquecimento,
  erroFatalMeta,
  escolherTemplateAprovado,
  hojeBrt,
  sorteio,
} from "../_shared/meta-aquecimento-alvo.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_INSTANCIAS_POR_RUN = 8;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json().catch(() => ({}));
    const forcar = body?.forcar === true; // teste manual ignora janela
    const instanciaId: string | undefined = body?.instancia_id;

    const { data: cfg } = await supabase
      .from("meta_envio_pool_config").select("*").eq("id", 1).maybeSingle();

    if (cfg?.recuperacao_auto === false && !forcar) {
      return json({ ok: true, skipped: "recuperacao_desativada" });
    }

    const hIni = Number(String(cfg?.horario_inicio || "09:00").split(":")[0]) || 9;
    const hFim = Number(String(cfg?.horario_fim || "19:00").split(":")[0]) || 19;
    const janela = dentroJanelaAquecimento(Math.max(9, hIni), Math.min(19, hFim));
    if (!janela.ok && !forcar) return json({ ok: true, skipped: janela.motivo });

    let q = supabase
      .from("meta_whatsapp_instances")
      .select("id, nome, display_phone, phone_number_id, access_token, waba_id, saude_quality, recuperacao_ativa, recuperacao_desde, recuperacao_msgs_meta_dia, recuperacao_proximo_envio_em, dias_green_consecutivos, quarentena_ate, ativo, provider")
      .eq("ativo", true)
      .eq("provider", "meta")
      // Só os números próprios: parceiros Meta não usam o aquecimento de qualidade.
      .eq("aquecimento_qualidade_permitido", true)
      .eq("recuperacao_ativa", true);
    if (instanciaId) q = q.eq("id", instanciaId);
    const { data: insts } = await q;

    if (!insts?.length) return json({ ok: true, skipped: "nenhuma_em_recuperacao" });

    const destinos = await destinosAquecimento(supabase);
    if (destinos.length === 0) {
      return json({ ok: false, error: "nenhum número UAZAPI na pasta AQUECIMENTO" });
    }

    const dia = hojeBrt();
    const maxPorDestino = Math.max(1, Number(cfg?.recuperacao_max_por_destino_dia ?? 2));
    const intMin = Math.max(60, Number(cfg?.recuperacao_intervalo_min_seg ?? 1200));
    const intMax = Math.max(intMin, Number(cfg?.recuperacao_intervalo_max_seg ?? 2400));
    const msgsMin = Math.max(1, Number(cfg?.recuperacao_msgs_min_dia ?? 10));
    const msgsMax = Math.max(msgsMin, Number(cfg?.recuperacao_msgs_max_dia ?? 20));

    // Uso dos destinos hoje (limite por destino é global, não por emissor)
    const { data: logsHoje } = await supabase
      .from("meta_recuperacao_log")
      .select("instancia_id, destino_instancia_id, enviado_em, status")
      .eq("dia", dia)
      .limit(5000);
    const usoDestino = new Map<string, number>();
    (logsHoje || []).forEach((l: any) => {
      if (l.status !== "enviado" || !l.destino_instancia_id) return;
      usoDestino.set(l.destino_instancia_id, (usoDestino.get(l.destino_instancia_id) || 0) + 1);
    });

    const resultados: any[] = [];
    let processadas = 0;

    for (const inst of insts as any[]) {
      if (processadas >= MAX_INSTANCIAS_POR_RUN) break;

      // Intervalo entre mensagens do mesmo número
      if (!forcar && inst.recuperacao_proximo_envio_em &&
          new Date(inst.recuperacao_proximo_envio_em) > new Date()) {
        resultados.push({ instancia: inst.nome, skip: "aguardando_intervalo" });
        continue;
      }

      // Meta do dia (sorteada 1x por dia)
      let metaDia = Number(inst.recuperacao_msgs_meta_dia || 0);
      if (!metaDia) {
        metaDia = sorteio(msgsMin, msgsMax);
        await supabase.from("meta_whatsapp_instances")
          .update({ recuperacao_msgs_meta_dia: metaDia }).eq("id", inst.id);
      }

      const meus = (logsHoje || []).filter(
        (l: any) => l.instancia_id === inst.id && l.status === "enviado",
      );
      if (meus.length >= metaDia) {
        resultados.push({ instancia: inst.nome, skip: "meta_do_dia_atingida", enviados: meus.length, metaDia });
        continue;
      }

      // Destino: rodízio, respeita limite por destino e evita repetir o último
      const ultimo = meus
        .sort((a: any, b: any) => new Date(b.enviado_em).getTime() - new Date(a.enviado_em).getTime())[0];
      const elegiveis = destinos.filter((d) =>
        (usoDestino.get(d.id) || 0) < maxPorDestino && d.id !== ultimo?.destino_instancia_id
      );
      if (elegiveis.length === 0) {
        resultados.push({ instancia: inst.nome, skip: "sem_destino_disponivel" });
        continue;
      }
      const destino = elegiveis[Math.floor(Math.random() * elegiveis.length)];

      const tpl = await escolherTemplateAprovado(inst, cfg?.aquecimento_template_utility);
      if (!tpl) {
        await registrar(supabase, inst, destino, dia, "falha", "nenhum template aprovado disponível");
        resultados.push({ instancia: inst.nome, erro: "sem_template_aprovado" });
        continue;
      }

      const envio = await enviarTemplateAquecimento(inst, destino.telefone, tpl, destino.nome);
      await registrar(
        supabase, inst, destino, dia,
        envio.ok ? "enviado" : "falha",
        envio.ok ? null : envio.erro,
        envio.wamid,
        tpl.name,
      );

      const proximo = new Date(Date.now() + sorteio(intMin, intMax) * 1000).toISOString();
      const patch: any = {
        recuperacao_ultimo_envio_em: new Date().toISOString(),
        recuperacao_proximo_envio_em: proximo,
      };

      if (!envio.ok && erroFatalMeta(envio.codigo, envio.erro)) {
        patch.recuperacao_ativa = false;
        try {
          const { notificarAdmin } = await import("../_shared/notificar-admin.ts");
          await notificarAdmin(supabase, {
            tipo: "meta_recuperacao_parada",
            mensagem:
              `⛔ *Recuperação pausada*\n\nNúmero: *${inst.nome || inst.display_phone}*\n` +
              `A Meta recusou o envio: ${envio.erro}\n\nResolva o bloqueio/pendência e a recuperação volta sozinha na próxima checagem de saúde.`,
            chaveIdempotencia: `meta_recup_parada_${inst.id}_${dia}`,
            umaVezPorChave: true,
          });
        } catch (_) { /* aviso é best-effort */ }
      }

      await supabase.from("meta_whatsapp_instances").update(patch).eq("id", inst.id);

      if (envio.ok) usoDestino.set(destino.id, (usoDestino.get(destino.id) || 0) + 1);

      // ===== Avisos no WhatsApp: início do aquecimento do dia e meta concluída =====
      const enviadosAgora = meus.length + (envio.ok ? 1 : 0);
      const diasGreenAlta = Math.max(1, Number(cfg?.recuperacao_dias_green_alta ?? 3));
      const rotulo = inst.nome || inst.display_phone;
      try {
        const { notificarAdmin } = await import("../_shared/notificar-admin.ts");
        const { linhaBmInstancia } = await import("../_shared/rotulo-instancia.ts");
        const { linhaPrevisao } = await import("../_shared/meta-recuperacao-aviso.ts");
        const previsao = linhaPrevisao(inst.saude_quality, inst.dias_green_consecutivos, diasGreenAlta);
        const diasEmRecup = inst.recuperacao_desde
          ? Math.max(1, Math.ceil((Date.now() - new Date(inst.recuperacao_desde).getTime()) / 86400000))
          : 1;

        if (envio.ok && meus.length === 0) {
          await notificarAdmin(supabase, {
            tipo: "meta_aquecimento_inicio",
            mensagem:
              `🔥 *Aquecimento iniciado hoje*\n\n` +
              `Número: *${rotulo}*\n` +
              `${await linhaBmInstancia(supabase, inst)}\n` +
              `Qualidade atual: ${String(inst.saude_quality || "UNKNOWN").toUpperCase()} · dia ${diasEmRecup} de recuperação\n` +
              `Meta de hoje: ${metaDia} mensagens (intervalos de 20–40 min, 09h–19h)\n` +
              `Destino: números UAZAPI da caixa AQUECIMENTO — o IAGO responde tudo, gerando entrada real\n` +
              (inst.quarentena_ate
                ? `Fora das campanhas até ${new Date(inst.quarentena_ate).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}\n`
                : "") +
              `${previsao}`,
            chaveIdempotencia: `meta_aquec_inicio_${inst.id}_${dia}`,
            umaVezPorChave: true,
          });
        }

        if (envio.ok && enviadosAgora >= metaDia) {
          const falhasHoje = (logsHoje || []).filter(
            (l: any) => l.instancia_id === inst.id && l.status === "falha",
          ).length;
          await notificarAdmin(supabase, {
            tipo: "meta_aquecimento_meta_dia",
            mensagem:
              `✅ *Aquecimento do dia concluído*\n\n` +
              `Número: *${rotulo}*\n` +
              `${enviadosAgora}/${metaDia} mensagens enviadas${falhasHoje ? ` · ${falhasHoje} falha(s)` : " · nenhuma falha"}\n` +
              `Qualidade atual: ${String(inst.saude_quality || "UNKNOWN").toUpperCase()}\n` +
              `${previsao}`,
            chaveIdempotencia: `meta_aquec_meta_${inst.id}_${dia}`,
            umaVezPorChave: true,
          });
        }

        if (!envio.ok) {
          const falhasSeguidas = (logsHoje || [])
            .filter((l: any) => l.instancia_id === inst.id)
            .sort((a: any, b: any) => new Date(b.enviado_em).getTime() - new Date(a.enviado_em).getTime())
            .slice(0, 2)
            .filter((l: any) => l.status === "falha").length + 1;
          if (falhasSeguidas >= 3) {
            await notificarAdmin(supabase, {
              tipo: "meta_aquecimento_falhas",
              mensagem:
                `⚠️ *Aquecimento com falhas*\n\n` +
                `Número: *${rotulo}*\n` +
                `3 tentativas seguidas falharam hoje.\nÚltimo erro: ${envio.erro}\n\n` +
                `Enquanto não enviar, a qualidade não sobe. ${previsao}`,
              chaveIdempotencia: `meta_aquec_falhas_${inst.id}_${dia}`,
              umaVezPorChave: true,
            });
          }
        }
      } catch (e) {
        console.log("[recuperacao] aviso falhou:", String(e).slice(0, 200));
      }

      processadas++;
      resultados.push({
        instancia: inst.nome || inst.display_phone,
        destino: destino.nome || destino.telefone,
        template: tpl.name,
        ok: envio.ok,
        erro: envio.erro || null,
        enviados_hoje: meus.length + (envio.ok ? 1 : 0),
        meta_dia: metaDia,
      });
    }

    return json({ ok: true, total: resultados.length, resultados });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "erro" }, 500);
  }
});

async function registrar(
  supabase: any, inst: any, destino: any, dia: string,
  status: string, erro?: string | null, wamid?: string | null, template?: string | null,
) {
  await supabase.from("meta_recuperacao_log").insert({
    instancia_id: inst.id,
    destino_instancia_id: destino?.id || null,
    destino_telefone: destino?.telefone || null,
    tipo: template ? `recuperacao:${template}` : "recuperacao",
    status,
    erro: erro || null,
    wamid: wamid || null,
    dia,
  });
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

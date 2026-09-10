// Confere na Meta o status dos templates que ainda estão aguardando resposta.
// Regras (plano aprovado):
//  - só olha itens em aberto (PENDING/ENVIADO) cuja próxima conferência já venceu;
//  - escada de conferência: até 3h do envio → 30 min; até 48h → 1h; depois → 6h;
//  - ao virar APPROVED/REJECTED, o item sai da conferência para sempre
//    (proxima_verificacao_em = null), evitando consultas desnecessárias;
//  - avisa no WhatsApp do admin quando todos os modelos de um número ficam aprovados
//    e quando um modelo passa de 48h preso em análise.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { notificarAdmin } from "../_shared/notificar-admin.ts";
import { rotuloInstancia, linhaBmInstancia } from "../_shared/rotulo-instancia.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DESTINO_AVISO = ["5562991672674"];
const MAX_INSTANCIAS_POR_EXECUCAO = 25;
const EM_ABERTO = ["PENDING", "ENVIADO"];

const MIN = 60 * 1000;
const H = 60 * MIN;

/** Escada de conferência conforme o tempo desde o envio. */
function proximaConferencia(criadoEm: string | null): string {
  const base = criadoEm ? new Date(criadoEm).getTime() : Date.now();
  const idade = Date.now() - base;
  const intervalo = idade < 3 * H ? 30 * MIN : idade < 48 * H ? 1 * H : 6 * H;
  return new Date(Date.now() + intervalo).toISOString();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({} as any));
    const forcar = body?.forcar === true;
    const agora = new Date().toISOString();

    // ===== 1) Itens em aberto que já venceram a conferência =====
    let qAbertos = supabase
      .from("meta_templates_instancia")
      .select("instancia_id")
      .in("status", EM_ABERTO);
    if (!forcar) qAbertos = qAbertos.or(`proxima_verificacao_em.is.null,proxima_verificacao_em.lte.${agora}`);
    const { data: abertos } = await qAbertos;

    // REJECTED sem motivo: enriquece o motivo uma vez (não entra na escada)
    const { data: rejSemMotivo } = await supabase
      .from("meta_templates_instancia")
      .select("instancia_id")
      .eq("status", "REJECTED")
      .is("motivo_rejeicao", null);

    const instIds = Array.from(
      new Set([
        ...(((abertos as any[]) || []).map((r) => r.instancia_id)),
        ...(((rejSemMotivo as any[]) || []).map((r) => r.instancia_id)),
      ]),
    ).slice(0, MAX_INSTANCIAS_POR_EXECUCAO);

    if (instIds.length === 0) {
      // Nada aguardando: encerra sem chamar a Meta (custo praticamente zero).
      return new Response(JSON.stringify({ success: true, atualizados: 0, nada_pendente: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: instancias } = await supabase
      .from("meta_whatsapp_instances")
      .select("id, nome, display_phone, meta_verified_name, phone_number_id, meta_bm_id, business_id, waba_id, access_token, saude_quality")
      .in("id", instIds);

    let atualizados = 0;
    let aprovadosTotal = 0;
    const resumo: Array<{
      id: string;
      nome: string;
      telefone: string;
      bm: string;
      qualidade: string;
    }> = [];

    for (const inst of instancias || []) {
      if (!inst.waba_id || !inst.access_token) continue;

      try {
        const res = await fetch(
          `https://graph.facebook.com/v21.0/${inst.waba_id}/message_templates?fields=name,language,status,id,rejected_reason,category&limit=200`,
          { headers: { Authorization: `Bearer ${inst.access_token}` } },
        );
        const data = await res.json();
        if (!res.ok) continue;

        const remotos: any[] = data.data || [];
        const remotoById = new Map(remotos.map((t) => [String(t.id), t]));
        const remotoByName = new Map(remotos.map((t) => [`${t.name}|${t.language}`, t]));

        // ===== Meta reclassificou o modelo para MARKETING? Para de subir. =====
        const virouMarketing = remotos.filter(
          (t) => String(t.category || "").toUpperCase() === "MARKETING",
        );
        for (const t of virouMarketing) {
          const { data: mestre } = await supabase
            .from("meta_templates_mestre")
            .select("id, nome, reclassificado_marketing")
            .eq("nome", t.name)
            .maybeSingle();
          if (!mestre || mestre.reclassificado_marketing === true) continue;

          await supabase
            .from("meta_templates_mestre")
            .update({
              reclassificado_marketing: true,
              categoria_meta: "MARKETING",
              injetar_em_novos: false,
              usar_em_leads: false,
            })
            .eq("id", mestre.id);

          // Cancela o que ainda não foi enviado para a Meta.
          const { data: cancelados } = await supabase
            .from("meta_templates_onboarding_fila")
            .update({
              status: "CANCELADO",
              motivo: "modelo reclassificado como MARKETING pela Meta",
              finalizado_em: new Date().toISOString(),
            })
            .eq("template_mestre_id", mestre.id)
            .in("status", ["PENDENTE", "AGENDADO"])
            .select("id");

          await notificarAdmin(supabase, {
            tipo: "template_reclassificado_marketing",
            destinatarios: DESTINO_AVISO,
            chaveIdempotencia: `marketing:${mestre.id}`,
            umaVezPorChave: true,
            mensagem:
              `🚫 *Modelo virou MARKETING na Meta*\n\n` +
              `Modelo: *${mestre.nome}*\n` +
              `${await linhaBmInstancia(supabase, inst)}\n` +
              `Ele saiu da injeção em números novos e do aquecimento de leads. ` +
              `Itens cancelados na fila: *${(cancelados || []).length}*.\n\n` +
              `Só subimos modelos de utilidade.`,
          });
        }

        let qLocPend = supabase
          .from("meta_templates_instancia")
          .select("id, meta_template_id, template_mestre_id, status, motivo_rejeicao, criado_em, verificacoes")
          .eq("instancia_id", inst.id)
          .in("status", EM_ABERTO);
        if (!forcar) {
          qLocPend = qLocPend.or(`proxima_verificacao_em.is.null,proxima_verificacao_em.lte.${agora}`);
        }
        const [locPend, locRej] = await Promise.all([
          qLocPend,
          supabase
            .from("meta_templates_instancia")
            .select("id, meta_template_id, template_mestre_id, status, motivo_rejeicao, criado_em, verificacoes")
            .eq("instancia_id", inst.id)
            .eq("status", "REJECTED")
            .is("motivo_rejeicao", null),
        ]);
        const locais = [...(locPend.data || []), ...(locRej.data || [])];

        for (const local of locais || []) {
          let remoto: any = null;
          if (local.meta_template_id) remoto = remotoById.get(String(local.meta_template_id));
          let mestreNome: string | null = null;
          if (!remoto) {
            const { data: mestre } = await supabase
              .from("meta_templates_mestre").select("nome, idioma")
              .eq("id", local.template_mestre_id).maybeSingle();
            if (mestre) {
              mestreNome = mestre.nome;
              remoto = remotoByName.get(`${mestre.nome}|${mestre.idioma}`);
            }
          }

          const emAberto = EM_ABERTO.includes(String(local.status || "").toUpperCase());
          const idadeH = local.criado_em
            ? (Date.now() - new Date(local.criado_em).getTime()) / H
            : 0;

          if (!remoto) {
            // Não encontrado na Meta ainda: reprograma a conferência.
            if (emAberto) {
              await supabase.from("meta_templates_instancia").update({
                ultima_verificacao_em: new Date().toISOString(),
                proxima_verificacao_em: proximaConferencia(local.criado_em),
                verificacoes: Number(local.verificacoes || 0) + 1,
              }).eq("id", local.id);
            }
            continue;
          }

          const novoStatus = String(remoto.status || "PENDING").toUpperCase();
          let motivo: string | null = remoto.rejected_reason || null;

          // Se REJECTED, busca sempre o detalhe individual do template para
          // capturar o motivo real (rejected_reason / categoria / quality score).
          if (novoStatus === "REJECTED" && remoto.id) {
            try {
              const detRes = await fetch(
                `https://graph.facebook.com/v21.0/${remoto.id}?fields=status,rejected_reason,quality_score,category,name,language`,
                { headers: { Authorization: `Bearer ${inst.access_token}` } },
              );
              const det = await detRes.json();
              if (detRes.ok) {
                const partes: string[] = [];
                if (det?.rejected_reason) partes.push(String(det.rejected_reason));
                if (det?.category) partes.push(`categoria=${det.category}`);
                const qs = det?.quality_score?.score;
                if (qs) partes.push(`quality_score=${qs}`);
                const reasons = det?.quality_score?.reasons;
                if (Array.isArray(reasons) && reasons.length > 0) partes.push(reasons.join("; "));
                if (partes.length > 0) motivo = partes.join(" · ");
              } else {
                motivo = motivo || det?.error?.message || null;
              }
            } catch (_e) { /* segue */ }
            if (!motivo) motivo = "Rejeitado pela Meta sem motivo detalhado na API";
          }

          const resolvido = ["APPROVED", "REJECTED"].includes(novoStatus);

          const patch: Record<string, unknown> = {
            status: novoStatus,
            meta_template_id: remoto.id ? String(remoto.id) : local.meta_template_id,
            motivo_rejeicao: motivo,
            ultima_verificacao_em: new Date().toISOString(),
            verificacoes: Number(local.verificacoes || 0) + 1,
            // resolvido → sai da conferência para sempre
            proxima_verificacao_em: resolvido ? null : proximaConferencia(local.criado_em),
          };

          await supabase.from("meta_templates_instancia").update(patch).eq("id", local.id);
          if (novoStatus !== local.status) atualizados++;
          if (novoStatus === "APPROVED" && local.status !== "APPROVED") aprovadosTotal++;

          // Preso em análise por mais de 48h: avisa uma vez.
          if (!resolvido && idadeH >= 48) {
            await notificarAdmin(supabase, {
              tipo: "template_preso_em_analise",
              destinatarios: DESTINO_AVISO,
              chaveIdempotencia: `preso:${local.id}`,
              umaVezPorChave: true,
              mensagem:
                `⏳ *Modelo preso em análise na Meta*\n\n` +
                `Número: *${rotuloInstancia(inst)}*\n` +
                `${await linhaBmInstancia(supabase, inst)}\n` +
                `Modelo: *${mestreNome || remoto.name || local.template_mestre_id}*\n` +
                `Aguardando há mais de 48 horas. Continuo conferindo a cada 6 horas.`,
            });
          }
        }

        // ===== Todos os modelos deste número aprovados? =====
        const { count: restantes } = await supabase
          .from("meta_templates_instancia")
          .select("id", { count: "exact", head: true })
          .eq("instancia_id", inst.id)
          .in("status", EM_ABERTO);

        if ((restantes || 0) === 0) {
          const { count: aprovados } = await supabase
            .from("meta_templates_instancia")
            .select("id", { count: "exact", head: true })
            .eq("instancia_id", inst.id)
            .eq("status", "APPROVED");

          if ((aprovados || 0) > 0) {
            await notificarAdmin(supabase, {
              tipo: "templates_todos_aprovados",
              destinatarios: DESTINO_AVISO,
              chaveIdempotencia: `aprovados:${inst.id}:${aprovados}`,
              umaVezPorChave: true,
              mensagem:
                `✅ *Templates aprovados*\n\n` +
                `Número: *${rotuloInstancia(inst)}*\n` +
                `${await linhaBmInstancia(supabase, inst)}\n` +
                `Modelos aprovados: *${aprovados}*\n\n` +
                `Não há mais nada aguardando resposta da Meta neste número — paro de conferir.`,
            });
          }
        }
      } catch (_e) {
        // segue para próxima instância
      }
    }

    return new Response(
      JSON.stringify({ success: true, atualizados, aprovados: aprovadosTotal, instancias: instIds.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : "Erro" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

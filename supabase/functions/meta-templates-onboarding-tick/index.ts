import { requireCaller } from '../_shared/auth-guard.ts';
import { templateIntervalSeconds } from "../_shared/meta-template-pacing.ts";
import { nextTemplateDay, isGhostSubmission } from "../_shared/meta-template-completion.ts";
import { podeDistribuirModelo } from "../_shared/meta-template-distribution.ts";
// Copia templates aprovados para números novos da API Oficial, de forma gradual.
// Reutiliza o agendamento existente, sem nova rotina.
//
// Regras anti-ban:
//  - Aplicação 24/7, inclusive domingos
//  - dose diária: 3 no 1º dia, 5 no 2º, 8 no 3º, 10/dia depois
//  - 1 modelo por vez por número, intervalo aleatório de 2 a 5 min
//  - 2 reprovações seguidas → pausa a fila do número e avisa
//  - erro de limite/bloqueio da Meta → pausa 24h nesse número
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.88.0";
import { notificarAdmin } from "../_shared/notificar-admin.ts";
import { rotuloInstancia, linhaBmInstancia } from "../_shared/rotulo-instancia.ts";
import { ehErroTemporario, humanizarErroTemplate } from "../_shared/humanizar-erro-template.ts";
import { motivoBloqueioTemplate } from "../_shared/meta-template-eligibility.ts";

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const DESTINO_AVISO = ["5562991672674"];
const MAX_INSTANCIAS_POR_RUN = 10;
const MAX_TENTATIVAS = 3;

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const agoraBrt = () => new Date(Date.now() - 3 * 60 * 60 * 1000);
const diaBrt = () => agoraBrt().toISOString().slice(0, 10);
const sorteio = (min: number, max: number) => Math.floor(min + Math.random() * (max - min + 1));

// "Já existe conteúdo nesse idioma" = o modelo já está no número.
// Não é reprovação: fecha o item como já existente.
const ehJaExiste = (texto: string) => {
  const t = String(texto || "").toLowerCase();
  return (
    t.includes("já existe conteúdo") || t.includes("ja existe conteudo") ||
    t.includes("already exists") || t.includes("existing template") ||
    (t.includes("content in") && t.includes("already"))
  );
};

const erroDeLimiteMeta = (texto: string) => {
  const t = String(texto || "").toLowerCase();
  return (
    t.includes("rate limit") || t.includes("too many") || t.includes("limit reached") ||
    t.includes("account locked") || t.includes("business account locked") ||
    t.includes("131031") || t.includes("131042") || t.includes("policy violation")
  );
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const __caller = await requireCaller(req, { scheduler: true, user: 'any' });
  if (__caller instanceof Response) return __caller;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { data: cfg } = await supabase
      .from("meta_templates_onboarding_config")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    if (!cfg || cfg.ativo === false) return json({ ok: true, skipped: "desativado" });

    // ===== 1) Reconciliação: fecha itens já respondidos pela Meta =====
    const { data: emVoo } = await supabase
      .from("meta_templates_onboarding_fila")
      .select("id, instancia_id, template_mestre_id, status, tentativas, enviado_em, motivo")
      .eq("status", "ENVIADO")
      .limit(200);

    const avisos: any[] = [];

    for (const item of (emVoo as any[]) || []) {
      const { data: ti, error: tiError } = await supabase
        .from("meta_templates_instancia")
        .select("status, erro, motivo_rejeicao")
        .eq("instancia_id", item.instancia_id)
        .eq("template_mestre_id", item.template_mestre_id)
        .maybeSingle();
      if (tiError) continue;
      if (!ti) {
        // A interrupted admission has no submission record. Requeue only after
        // the lease expired; the submitter checks Meta again before any POST.
        if (item.enviado_em && Date.now() - new Date(item.enviado_em).getTime() > 600_000) {
          await supabase.from("meta_templates_onboarding_fila").update({
            status: "PENDENTE", enviado_em: null,
            motivo: "aplicacao_manual: admissão interrompida; conferir Meta antes de retomar",
            agendado_para: new Date().toISOString(),
          }).eq("id", item.id).eq("status", "ENVIADO");
        }
        continue;
      }
      const st = String(ti.status || "").toUpperCase();
      if (!["APPROVED", "REJECTED", "FALHA_ENVIO"].includes(st)) continue;

      const motivo = ti.motivo_rejeicao || ti.erro || null;

      const { data: inst } = await supabase
        .from("meta_whatsapp_instances")
        .select("id, nome, display_phone, meta_verified_name, phone_number_id, meta_bm_id, business_id, templates_auto_rejeicoes_seguidas")
        .eq("id", item.instancia_id)
        .maybeSingle();
      const { data: mestre } = await supabase
        .from("meta_templates_mestre")
        .select("nome")
        .eq("id", item.template_mestre_id)
        .maybeSingle();
      const linhaBm = await linhaBmInstancia(supabase, inst || { id: item.instancia_id });

      if (st === "APPROVED" || ehJaExiste(motivo)) {
        await supabase
          .from("meta_templates_onboarding_fila")
          .update({
            status: "APPROVED",
            motivo: st === "APPROVED" ? motivo : "já existente no número",
            finalizado_em: new Date().toISOString(),
          })
          .eq("id", item.id);
        await supabase
          .from("meta_whatsapp_instances")
          .update({ templates_auto_rejeicoes_seguidas: 0 })
          .eq("id", item.instancia_id);
        continue;
      }

      // Falha temporária da Meta: não é reprovação — volta para a fila e tenta de novo.
      const tentativas = Number(item.tentativas || 1);
      if (st === "FALHA_ENVIO" && ehErroTemporario(motivo) && tentativas < MAX_TENTATIVAS) {
        const esperaSeg = sorteio(120, 300) * tentativas;
        await supabase
          .from("meta_templates_onboarding_fila")
          .update({
            status: "PENDENTE",
            motivo,
            tentativas: tentativas + 1,
            agendado_para: new Date(Date.now() + esperaSeg * 1000).toISOString(),
            finalizado_em: null,
          })
          .eq("id", item.id);

        await notificarAdmin(supabase, {
          tipo: "templates_onboarding_falha_temporaria",
          destinatarios: DESTINO_AVISO,
          chaveIdempotencia: `${item.id}:${tentativas}`,
          umaVezPorChave: true,
          mensagem:
            `⏳ *Falha temporária da Meta*\n\n` +
            `Número: *${rotuloInstancia(inst)}*\n` +
            `${linhaBm}\n` +
            `Modelo: *${mestre?.nome || item.template_mestre_id}*\n` +
            `Motivo: ${humanizarErroTemplate(motivo)}\n` +
            `Detalhe técnico: ${String(motivo || "").slice(0, 300)}\n\n` +
            `O template *não foi reprovado*. Vou tentar de novo automaticamente (tentativa ${tentativas + 1} de ${MAX_TENTATIVAS}). A fila deste número continua.`,
        });
        avisos.push({ tipo: "falha_temporaria", instancia_id: item.instancia_id, tentativa: tentativas + 1 });
        continue;
      }

      // Reprovação real da Meta ou falha definitiva de cadastro
      await supabase
        .from("meta_templates_onboarding_fila")
        .update({ status: st, motivo, finalizado_em: new Date().toISOString() })
        .eq("id", item.id);

      const seguidas = Number(inst?.templates_auto_rejeicoes_seguidas || 0) + 1;
      const limite = Number(cfg.max_rejeicoes_seguidas || 2);
      const pausar = seguidas >= limite;
      await supabase
        .from("meta_whatsapp_instances")
        .update({
          templates_auto_rejeicoes_seguidas: seguidas,
          ...(pausar ? { templates_auto_status: "PAUSADO_REJEICOES" } : {}),
        })
        .eq("id", item.instancia_id);

      await notificarAdmin(supabase, {
        tipo: "templates_onboarding_rejeicao",
        destinatarios: DESTINO_AVISO,
        chaveIdempotencia: `${item.id}`,
        umaVezPorChave: true,
        mensagem:
          `⚠️ *Template reprovado*\n\n` +
          `Número: *${rotuloInstancia(inst)}*\n` +
          `${linhaBm}\n` +
          `Modelo: *${mestre?.nome || item.template_mestre_id}*\n` +
          `Motivo: ${humanizarErroTemplate(motivo)}\n` +
          `Detalhe técnico: ${String(motivo || "sem motivo informado pela Meta").slice(0, 300)}\n\n` +
          (pausar
            ? `⛔ Fila deste número *pausada* após ${seguidas} reprovações seguidas. Corrija manualmente e reative no card.`
            : `A fila continua. Entre e ajuste este modelo se quiser reenviar.`),
      });
      avisos.push({ tipo: "rejeicao", instancia_id: item.instancia_id, pausada: pausar });
    }

    // ===== 2) Conclusão: números sem nada pendente =====
    // Reuse this worker for specific manual deferrals without enabling automatic copying.
    const { data: manualRows, error: manualError } = await supabase.from('meta_templates_onboarding_fila')
      .select('instancia_id').eq('status', 'PENDENTE').like('motivo', 'aplicacao_manual:%')
      .lte('agendado_para', new Date().toISOString()).limit(200);
    if (manualError) throw manualError;
    const manualIds = [...new Set((manualRows || []).map(r => r.instancia_id))];
    const { data: instsAtivas } = await supabase
      .from("meta_whatsapp_instances")
      .select("id, nome, display_phone, user_id, meta_verified_name, phone_number_id, meta_bm_id, business_id, waba_id, access_token, ativo, saude_quality, saude_status, templates_auto_status, templates_auto_pausado_ate, templates_auto_iniciado_em, templates_auto_rejeicoes_seguidas, provider, qualidade_leitura_ok, qualidade_leitura_erro, meta_name_status, saude_ban_info, saude_restricoes, pausa_automatica_motivo, instancia_teste_aquecimento, templates_auto_copiar")
      .or(manualIds.length ? `templates_auto_copiar.eq.true,id.in.(${manualIds.join(",")})` : "templates_auto_copiar.eq.true");

    const elegiveis = ((instsAtivas as any[]) || []).filter(
      (i) => !i.instancia_teste_aquecimento && motivoBloqueioTemplate(i) === null,
    );

    for (const inst of elegiveis) {
      const { count: pendentes } = await supabase
        .from("meta_templates_onboarding_fila")
        .select("id", { count: "exact", head: true })
        .eq("instancia_id", inst.id)
        .in("status", ["PENDENTE", "ENVIADO"]);
      if ((pendentes || 0) > 0) continue;
      if (inst.templates_auto_status === "CONCLUIDO") continue;

      const { data: todos } = await supabase
        .from("meta_templates_onboarding_fila")
        .select("status")
        .eq("instancia_id", inst.id);
      const lista = (todos as any[]) || [];
      if (lista.length === 0) continue;
      const aprovados = lista.filter((r) => r.status === "APPROVED").length;
      const reprovados = lista.filter((r) => r.status === "REJECTED").length;
      const falhas = lista.filter((r) => r.status === "FALHA_ENVIO").length;

      await supabase
        .from("meta_whatsapp_instances")
        .update({ templates_auto_status: "CONCLUIDO" })
        .eq("id", inst.id);

      await notificarAdmin(supabase, {
        tipo: "templates_onboarding_fim",
        destinatarios: DESTINO_AVISO,
        chaveIdempotencia: `${inst.id}:${lista.length}`,
        umaVezPorChave: true,
        mensagem:
          `✅ *Cópia de templates concluída*\n\n` +
          `Número: *${rotuloInstancia(inst)}*\n` +
          `${await linhaBmInstancia(supabase, inst)}\n` +
          `Aprovados: *${aprovados}*\nReprovados: *${reprovados}*\nFalhas de envio: *${falhas}*\n` +
          `Total processado: *${lista.length}*`,
      });
      avisos.push({ tipo: "conclusao", instancia_id: inst.id });
    }

    // ===== 3) Envio 24/7, inclusive domingos e madrugada =====
    // Todos os tiers usam a mesma reserva atômica de 120–300 segundos.

    const dia = diaBrt();
    const agoraIso = new Date().toISOString();
    const processados: any[] = [];

    for (const inst of elegiveis) {
      if (processados.length >= MAX_INSTANCIAS_POR_RUN) break;
      if (inst.ativo === false) continue;
      if (inst.templates_auto_status === "PAUSADO_REJEICOES") continue;
      if (inst.templates_auto_pausado_ate && new Date(inst.templates_auto_pausado_ate) > new Date()) continue;

      // Dose diária conforme o dia de aquecimento do número.
      // Quando sem_limite_diario = true, todos os modelos marcados podem entrar no
      // mesmo dia — a proteção fica no intervalo de 2–5 min entre um e outro.
      const semLimiteDiario = (cfg as any).sem_limite_diario !== false;
      if (!semLimiteDiario) {
        const iniciado = inst.templates_auto_iniciado_em ? new Date(inst.templates_auto_iniciado_em) : new Date();
        const diasCorridos = Math.floor((Date.now() - iniciado.getTime()) / 86400000);
        const dose =
          diasCorridos <= 0 ? Number(cfg.qtd_dia_1 || 3)
          : diasCorridos === 1 ? Number(cfg.qtd_dia_2 || 5)
          : diasCorridos === 2 ? Number(cfg.qtd_dia_3 || 8)
          : Number(cfg.qtd_dia_padrao || 10);

        const inicioDia = new Date(`${dia}T00:00:00-03:00`).toISOString();
        const { count: enviadosHoje } = await supabase
          .from("meta_templates_onboarding_fila")
          .select("id", { count: "exact", head: true })
          .eq("instancia_id", inst.id)
          .gte("enviado_em", inicioDia);
        if ((enviadosHoje || 0) >= dose) continue;
      }


      let proximoQuery = supabase
        .from("meta_templates_onboarding_fila")
        .select("id, template_mestre_id, motivo")
        .eq("instancia_id", inst.id)
        .eq("status", "PENDENTE")
        .lte("agendado_para", agoraIso)
        .order("prioridade", { ascending: false })
        .order("criado_em", { ascending: true })
        .limit(1);
      if (inst.templates_auto_copiar !== true) proximoQuery = proximoQuery.like("motivo", "aplicacao_manual:%");
      const { data: proximo, error: proximoError } = await proximoQuery.maybeSingle();
      if (proximoError) throw proximoError;
      const manualPrefix = inst.templates_auto_copiar !== true ? "aplicacao_manual: " : "";
      if (!proximo) continue;

      // Última checagem: se o modelo já existe nesse número na Meta, não reenvia.
      const { data: mestreItem } = await supabase
        .from("meta_templates_mestre")
        .select("nome, idioma, corpo, categoria, reclassificado_marketing, criado_por, injetar_em_novos")
        .eq("id", proximo.template_mestre_id)
        .maybeSingle();

      // A fila também pode receber Utility aprovado pela sincronização manual
      // de todos os HSM. A inserção é feita somente por funções autenticadas;
      // ainda exigimos o mesmo proprietário e uma categoria segura.
      const categoriaMestre = String(mestreItem?.categoria || "").toUpperCase();
      const permitidoPelaFila = !!mestreItem && podeDistribuirModelo(mestreItem, inst.user_id, true);
      if (!mestreItem || mestreItem.criado_por !== inst.user_id || !permitidoPelaFila) {
        await supabase.from("meta_templates_onboarding_fila").update({
          status: "CANCELADO",
          motivo: "modelo não autorizado ou não pertence ao proprietário desta instância",
          finalizado_em: new Date().toISOString(),
        }).eq("id", proximo.id);
        processados.push({ instancia_id: inst.id, ok: false, cancelado: "proprietario_incompativel" });
        continue;
      }

      // Sobe UTILIDADE ou MARKETING com variável numerada. Qualquer outro caso sai da fila.
      if (mestreItem) {
        const nomeadas = String((mestreItem as any).corpo || "").match(/\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g) || [];
        const categoria = String((mestreItem as any).categoria || "").toUpperCase();
        const categoriaInvalida = categoria !== "UTILITY";
        if (nomeadas.length > 0 || categoriaInvalida) {
          await supabase
            .from("meta_templates_onboarding_fila")
            .update({
              status: "CANCELADO",
              motivo: categoriaInvalida
                ? "categoria incompatível com a aplicação automática"
                : "modelo usa variável com nome; use {{1}}, {{2}}...",
              finalizado_em: new Date().toISOString(),
            })
            .eq("id", proximo.id);
          processados.push({ instancia_id: inst.id, ok: false, cancelado: mestreItem.nome });
          continue;
        }
      }
      if (mestreItem?.nome) {
        // A criação pode ter sido iniciada manualmente antes de o tick alcançar
        // a fila. PENDING significa submissão real, não autorização para reenviar.
        const { data: submissao } = await supabase.from("meta_templates_instancia")
          .select("status,meta_template_id,erro,atualizado_em")
          .eq("instancia_id", inst.id).eq("template_mestre_id", proximo.template_mestre_id)
          .maybeSingle();
        const { data: realAgora } = await supabase.from("meta_whatsapp_templates").select("id")
          .eq("instancia_id", inst.id).eq("nome_template", mestreItem.nome).limit(1).maybeSingle();
        const fantasma = isGhostSubmission(submissao as any, !!realAgora);
        if (!fantasma && submissao && ["PENDING", "ENVIADO", "APPROVED"].includes(String(submissao.status).toUpperCase())) {
          await supabase.from("meta_templates_onboarding_fila").update({
            status: submissao.status === "APPROVED" ? "APPROVED" : "ENVIADO",
            motivo: submissao.status === "APPROVED" ? "aprovado pela Meta" : "enviado; aguardando aprovação da Meta",
            enviado_em: new Date().toISOString(),
            ...(submissao.status === "APPROVED" ? { finalizado_em: new Date().toISOString() } : {}),
          }).eq("id", proximo.id);
          processados.push({ instancia_id: inst.id, ok: true, aguardando_meta: submissao.status !== "APPROVED" });
          continue;
        }
        const { data: existeReal } = await supabase
          .from("meta_whatsapp_templates")
          .select("id, status")
          .eq("instancia_id", inst.id)
          .eq("nome_template", mestreItem.nome)
          .eq("idioma", String((mestreItem as any).idioma || "pt_BR"))
          .limit(1)
          .maybeSingle();
        const stReal = String((existeReal as any)?.status || "").toLowerCase();
        if (existeReal && ["approved", "pending", "in_appeal", "pending_deletion"].includes(stReal)) {
          const aprovado = stReal === "approved";
          await supabase
            .from("meta_templates_onboarding_fila")
            .update({
              status: aprovado ? "APPROVED" : "ENVIADO",
              motivo: aprovado ? "já aprovado no número" : "enviado; aguardando aprovação da Meta",
              enviado_em: new Date().toISOString(),
              finalizado_em: aprovado ? new Date().toISOString() : null,
            })
            .eq("id", proximo.id);
          processados.push({ instancia_id: inst.id, ok: true, ja_existia: mestreItem.nome });
          continue;
        }
      }

      // Marca antes de submeter (evita duplicidade se o tick rodar de novo)
      const { data: claimed, error: claimError } = await supabase
        .from("meta_templates_onboarding_fila")
        .update({ status: "ENVIADO", enviado_em: new Date().toISOString(), tentativas: 1 })
        .eq("id", proximo.id).eq("status", "PENDENTE").select("id");
      if (claimError) throw claimError;
      if (!claimed?.length) continue;

      let erroEnvio: string | null = null;
      try {
        // A chamada interna deve usar a identidade de serviço. O cliente sem
        // cabeçalho explícito envia a chave pública e recebe "Sessão inválida".
        const resposta = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/meta-criar-template-lote`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ mestre_id: proximo.template_mestre_id, instancia_ids: [inst.id] }),
        });
        const res = await resposta.json().catch(() => ({}));
        if (!resposta.ok) erroEnvio = String((res as any)?.error || `Falha ao submeter modelo (HTTP ${resposta.status})`);
        else if ((res as any)?.success === false) erroEnvio = String((res as any)?.error || "falha");
        else if (Number(res?.total || 0) === 0 && res?.adiadas?.length) {
          const adiada = res.adiadas.find((r: any) => r.instancia_id === inst.id);
          const quota = adiada?.motivo === "limite_tier_250";
          await supabase
            .from("meta_templates_onboarding_fila")
            .update({ status: "PENDENTE", enviado_em: null, motivo: manualPrefix + (quota ? "limite diário tier 250: próximo dia BRT, inclusive domingo" : "aguardando intervalo de 2–5 minutos ou aplicação em andamento na BM"), agendado_para: adiada?.agendado_para || (quota ? nextTemplateDay().toISOString() : new Date(Date.now() + 120_000).toISOString()), tentativas: 0 })
            .eq("id", proximo.id);
          processados.push({ instancia_id: inst.id, ok: true, adiado: quota ? "limite_tier_250" : "intervalo_2_5_min" });
          continue;
        }
        else if (Number(res?.total || 0) === 0) {
          const { data: copia } = await supabase.from("meta_templates_instancia")
            .select("status").eq("instancia_id", inst.id)
            .eq("template_mestre_id", proximo.template_mestre_id).maybeSingle();
          const statusReal = String(copia?.status || "").toUpperCase();
          if (["APPROVED", "PENDING", "IN_APPEAL", "PENDING_DELETION"].includes(statusReal)) {
            await supabase.from("meta_templates_onboarding_fila").update({
              status: statusReal, motivo: "cópia existente preservada",
              finalizado_em: statusReal === "APPROVED" ? new Date().toISOString() : null,
            }).eq("id", proximo.id);
          } else {
            const motivo = String(res?.ignoradas?.[0]?.motivo || "consulta Meta inconclusiva");
            await supabase.from("meta_templates_onboarding_fila").update({
              status: "PENDENTE", enviado_em: null, motivo: manualPrefix + motivo,
              agendado_para: new Date(Date.now() + 300_000).toISOString(),
            }).eq("id", proximo.id);
          }
          processados.push({ instancia_id: inst.id, ok: true, sem_submissao: true });
          continue;
        }
      } catch (e) {
        erroEnvio = String(e);
      }

      if (erroEnvio && ehJaExiste(erroEnvio)) {
        // O modelo já está nesse número: encerra como concluído e segue a fila.
        await supabase
          .from("meta_templates_onboarding_fila")
          .update({
            status: "APPROVED",
            motivo: "já existente no número",
            finalizado_em: new Date().toISOString(),
          })
          .eq("id", proximo.id);
        await supabase
          .from("meta_whatsapp_instances")
          .update({ templates_auto_rejeicoes_seguidas: 0 })
          .eq("id", inst.id);
        processados.push({ instancia_id: inst.id, ok: true, ja_existia: true });
        continue;
      }

      if (erroEnvio) {
        const temporario = ehErroTemporario(erroEnvio) && !erroDeLimiteMeta(erroEnvio);
        if (temporario) {
          // Volta para a fila: não conta como reprovação.
          const esperaSeg = sorteio(120, 300);
          await supabase
            .from("meta_templates_onboarding_fila")
            .update({
              status: "PENDENTE",
              motivo: manualPrefix + erroEnvio.slice(0, 1000),
              tentativas: 2,
              agendado_para: new Date(Date.now() + esperaSeg * 1000).toISOString(),
              finalizado_em: null,
            })
            .eq("id", proximo.id);
          processados.push({ instancia_id: inst.id, ok: false, temporario: true, reenfileirado_em_seg: esperaSeg });
          continue;
        }

        await supabase
          .from("meta_templates_onboarding_fila")
          .update({ status: "FALHA_ENVIO", motivo: erroEnvio.slice(0, 1000), finalizado_em: new Date().toISOString() })
          .eq("id", proximo.id);

        if (erroDeLimiteMeta(erroEnvio)) {
          await supabase
            .from("meta_whatsapp_instances")
            .update({
              templates_auto_pausado_ate: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
              templates_auto_status: "PAUSADO_META",
            })
            .eq("id", inst.id);
          await notificarAdmin(supabase, {
            tipo: "templates_onboarding_pausa",
            destinatarios: DESTINO_AVISO,
            chaveIdempotencia: `${inst.id}:${dia}`,
            umaVezPorChave: true,
            mensagem:
              `⛔ *Cópia de templates pausada 24h*\n\n` +
              `Número: *${rotuloInstancia(inst)}*\n` +
              `${await linhaBmInstancia(supabase, inst)}\n` +
              `A Meta respondeu com limite/bloqueio: ${erroEnvio.slice(0, 400)}`,
          });
        }
        processados.push({ instancia_id: inst.id, ok: false, erro: erroEnvio.slice(0, 200) });
        continue;
      }

      // Próximo item deste número só depois do intervalo aleatório
      const espera = templateIntervalSeconds();
      const quando = new Date(Date.now() + espera * 1000).toISOString();
      const { data: restantes } = await supabase
        .from("meta_templates_onboarding_fila")
        .select("id")
        .eq("instancia_id", inst.id)
        .eq("status", "PENDENTE");
      const ids = ((restantes as any[]) || []).map((r) => r.id);
      if (ids.length > 0) {
        await supabase
          .from("meta_templates_onboarding_fila")
          .update({ agendado_para: quando })
          .in("id", ids).lt("agendado_para", quando);
      }

      processados.push({ instancia_id: inst.id, ok: true, proximo_em_seg: espera });
    }

    return json({ ok: true, processados, avisos });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
});

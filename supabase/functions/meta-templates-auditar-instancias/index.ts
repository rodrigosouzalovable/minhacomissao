// Audita instâncias da API Oficial Meta e enfileira somente os templates
// automáticos criados pelo mesmo proprietário da instância.
// Somente administrador. dry_run=true devolve apenas o relatório.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.88.0";
import { notificarAdmin } from "../_shared/notificar-admin.ts";
import { linhaBmInstancia } from "../_shared/rotulo-instancia.ts";
import { approvedOwnerModels, readAllTemplateRows, isInternalSlotFailure, isGhostSubmission } from "../_shared/meta-template-completion.ts";
import { sincronizarTemplatesMeta } from "../_shared/sincronizar-templates-meta.ts";
import { runBoundedSync } from "../_shared/meta-sync-bounded.ts";
import { motivoBloqueioTemplate } from "../_shared/meta-template-eligibility.ts";


import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const DESTINO_AVISO = ["5562991672674"];

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return json({ success: false, error: "Configuração indisponível" }, 500);
  const deadline = AbortSignal.timeout(110_000);
  const supabase = createClient(url, key, { global: { fetch: (input, init) => fetch(input, { ...init,
    signal: AbortSignal.any([deadline, AbortSignal.timeout(65_000), ...(init?.signal ? [init.signal] : [])]) }) } });

  try {
    const body = await req.json().catch(() => ({}));
    const dryRun = body?.dry_run !== false;
    const utilityApprovedOnly = true;
    let requester: string | null = null;
    const selectedIds = Array.isArray(body?.instancia_ids) ? body.instancia_ids.slice(0, body?.auto === true ? 500 : 8) : null;
    // Modo automático (cron diário): roda sem token de usuário, sempre aplicando.
    const auto = body?.auto === true;
    const instanciaAlvo = typeof body?.instancia_id === "string" && /^[0-9a-f-]{36}$/i.test(body.instancia_id)
      ? body.instancia_id : null;

    // ===== Autorização: somente admin (dispensado no modo automático) =====
    const serviceToken = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (auto && (!serviceToken || req.headers.get("Authorization") !== `Bearer ${serviceToken}`)) return json({ success: false, error: "Acesso interno obrigatório" }, 403);
    if (!auto) {
      const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
      if (!token) return json({ success: false, error: "nao_autenticado" }, 401);
      const { data: userData } = await supabase.auth.getUser(token);
      const uid = userData?.user?.id;
      if (!uid) return json({ success: false, error: "nao_autenticado" }, 401);
      const { data: ehAdmin } = await supabase.rpc("has_role", { _user_id: uid, _role: "admin" });
      if (ehAdmin !== true) return json({ success: false, error: "somente_admin" }, 403);
      requester = uid;
    }


    // ===== Modelos marcados para injeção =====
    let modelosQuery = supabase
      .from("meta_templates_mestre")
      .select("id, nome, idioma, criado_por, categoria")
      .order("criado_em", { ascending: true });
    modelosQuery = modelosQuery.eq("categoria", "UTILITY");
    if (requester) modelosQuery = modelosQuery.eq("criado_por", requester);
    const { data: marcados, error: masterError } = await modelosQuery;
    if (masterError) throw masterError;
    let lista = ((marcados as any[]) || []).map((r) => ({
      id: r.id as string,
      nome: r.nome as string,
      idioma: String(r.idioma || "pt_BR"),
      criado_por: r.criado_por as string | null,
      categoria: String(r.categoria || "").toUpperCase(),
    })).filter((r) => !!r.criado_por);
    if (lista.length === 0) {
      return json({ success: true, modelos: 0, erro_amigavel: "nenhum_modelo_marcado", instancias: [] });
    }

    // ===== Instâncias próprias da API Oficial =====
    const { data: parceirosRows, error: partnerError } = await supabase
      .from("meta_instance_parceiros")
      .select("instancia_id");
    if (partnerError) throw partnerError;
    const idsParceiros = new Set<string>(((parceirosRows as any[]) || []).map((p) => p.instancia_id));

    const { data: instsRaw, error: instancesError } = await supabase
      .from("meta_whatsapp_instances")
      .select("id, nome, display_phone, user_id, waba_id, access_token, saude_quality, saude_status, meta_name_status, ativo, provider, templates_auto_pausado_ate, templates_auto_status, templates_resync_pendente, qualidade_leitura_ok, qualidade_leitura_erro, saude_ban_info, saude_restricoes, pausa_automatica_motivo, templates_auto_copiar, instancia_teste_aquecimento")
      .eq("ativo", true)
      .eq("provider", "meta");

    if (instancesError) throw instancesError;
    const ownInstances = ((instsRaw as any[]) || []).filter(i => !idsParceiros.has(i.id) && (!requester || i.user_id === requester));
    const insts = ownInstances.filter(i => (!instanciaAlvo || i.id === instanciaAlvo) && (!selectedIds || selectedIds.includes(i.id)));

    // Na sincronização manual completa, a referência é formada somente por
    // modelos Utility que já estejam APPROVED em ao menos uma instância do
    // mesmo proprietário. Isso impede copiar um rascunho ou misturar donos.
    const owners = new Map<string, string>(ownInstances.filter(i => i.user_id).map(i => [i.id, i.user_id]));
    const copies = ownInstances.length ? await readAllTemplateRows(() => supabase.from("meta_whatsapp_templates")
      .select("id,instancia_id,nome_template,idioma,categoria,status").in("instancia_id", ownInstances.map(i => i.id)).eq("status", "approved").eq("categoria", "UTILITY")) : [];
    lista = approvedOwnerModels(lista, copies, owners);
    const syncErrors = new Map<string, string>();
    if (!auto && body?.sync === true) {
      const results = await runBoundedSync(insts, (i, signal) => sincronizarTemplatesMeta(supabase, i, signal),
        () => ({ success: false, error: "Consulta Meta não concluída; nenhuma aplicação iniciada neste número." }), 4, 60_000);
      results.forEach((r, idx) => { if (!r.success) syncErrors.set(insts[idx].id, r.error || "Consulta inconclusiva"); });
    }

    const motivoIgnorar = (i: any): string | null =>
      syncErrors.has(i.id) ? syncErrors.get(i.id) || "Consulta inconclusiva" : i.instancia_teste_aquecimento || (auto && i.templates_auto_copiar === false)
        ? "cópia automática desativada"
        : motivoBloqueioTemplate(i);

    const elegiveis = insts.filter((i) => motivoIgnorar(i) === null);
    const ignoradas = insts
      .filter((i) => motivoIgnorar(i) !== null)
      .map((i) => ({
        id: i.id,
        nome: i.nome || i.display_phone || i.id.slice(0, 8),
        motivo: motivoIgnorar(i) || "indisponível",
      }));

    // Templates REAIS existentes na Meta (nome|idioma) — cobre números conectados
    // antes da injeção automática existir.
    const idsElegiveis = elegiveis.map((i) => i.id);
    const jaTemNome = new Map<string, Set<string>>();
    if (idsElegiveis.length > 0) {
      const reais = await readAllTemplateRows(() => supabase.from("meta_whatsapp_templates").select("id,instancia_id, nome_template, idioma, status").in("instancia_id", idsElegiveis));
      for (const r of ((reais as any[]) || [])) {
        const st = String(r.status || "").toLowerCase();
        if (!["approved", "pending", "in_appeal", "pending_deletion"].includes(st)) continue;
        if (!jaTemNome.has(r.instancia_id)) jaTemNome.set(r.instancia_id, new Set());
        jaTemNome.get(r.instancia_id)?.add(`${r.nome_template}|${String(r.idioma || "pt_BR")}`);
      }
    }

    // ===== O que cada instância já possui =====
    // Registros sem id da Meta, antigos e ausentes numa leitura fresca da Meta
    // são liberados para reaplicação (nunca chegaram à Meta).
    const mestrePorId = new Map(lista.map((m: any) => [m.id, m]));
    const fantasmas: string[] = [];
    const fantasmaPares: any[] = [];
    const jaTem = new Map<string, Set<string>>();
    if (idsElegiveis.length > 0) {
      const existentes = await readAllTemplateRows(() => supabase.from("meta_templates_instancia").select("id,instancia_id, template_mestre_id, status, meta_template_id, atualizado_em").in("instancia_id", idsElegiveis));
      for (const r of ((existentes as any[]) || [])) {
        const m: any = mestrePorId.get(r.template_mestre_id);
        const real = !!m && (jaTemNome.get(r.instancia_id)?.has(`${m.nome}|${m.idioma}`) ?? false);
        if (!auto && body?.sync === true && m && isGhostSubmission(r, real)) { fantasmas.push(r.id); fantasmaPares.push(r); continue; }
        if (["APPROVED", "PENDING", "IN_APPEAL", "ENVIADO"].includes(String(r.status || "").toUpperCase())) {
          if (!jaTem.has(r.instancia_id)) jaTem.set(r.instancia_id, new Set());
          jaTem.get(r.instancia_id)?.add(r.template_mestre_id);
        }
      }
    }
    if (fantasmas.length) {
      await supabase.from("meta_templates_instancia").update({
        status: "FALHA_ENVIO", erro: "Registro sem submissão real: ausente na Meta; liberado para reaplicação", atualizado_em: new Date().toISOString(),
      }).in("id", fantasmas).is("meta_template_id", null);
      for (const g of fantasmaPares) {
        await supabase.from("meta_templates_onboarding_fila").update({
          status: "PENDENTE", enviado_em: null, finalizado_em: null, tentativas: 0,
          agendado_para: new Date().toISOString(), motivo: "Registro fantasma liberado; conferir Meta antes de aplicar",
        }).eq("instancia_id", g.instancia_id).eq("template_mestre_id", g.template_mestre_id);
      }
    }

    // Itens já na fila (não repetir contagem de pendentes)
    const terminalRows = new Map<string, any>();
    const naFila = new Map<string, Set<string>>();
    if (idsElegiveis.length > 0) {
      const fila = await readAllTemplateRows(() => supabase.from("meta_templates_onboarding_fila").select("id,instancia_id, template_mestre_id, status,motivo").in("instancia_id", idsElegiveis));
      for (const r of ((fila as any[]) || [])) {
        if (!["PENDENTE", "ENVIADO", "APPROVED"].includes(String(r.status).toUpperCase())) terminalRows.set(`${r.instancia_id}|${r.template_mestre_id}`, r);
        if (!["PENDENTE", "ENVIADO", "APPROVED"].includes(String(r.status || "").toUpperCase())) {
          continue;
        }
        if (!naFila.has(r.instancia_id)) naFila.set(r.instancia_id, new Set());
        naFila.get(r.instancia_id)?.add(r.template_mestre_id);
      }
    }

    const relatorio = elegiveis.map((i) => {
      const modelosDoProprietario = lista.filter(m => m.criado_por === i.user_id);
      const tem = jaTem.get(i.id) || new Set<string>();
      const temNome = jaTemNome.get(i.id) || new Set<string>();
      const fila = naFila.get(i.id) || new Set<string>();
      const faltando = modelosDoProprietario.filter(
        (m) => !temNome.has(`${m.nome}|${m.idioma}`) && !tem.has(m.id),
      );
      const novos = faltando.filter(m => !fila.has(m.id) && (!terminalRows.has(`${i.id}|${m.id}`) || isInternalSlotFailure(terminalRows.get(`${i.id}|${m.id}`)?.motivo)));
      return {
        id: i.id,
        nome: i.nome || i.display_phone || i.id.slice(0, 8),
        telefone: i.display_phone || null,
        total_modelos: modelosDoProprietario.length,
        possui: modelosDoProprietario.length - faltando.length,
        faltando: faltando.length,
        ja_na_fila: faltando.length - novos.length,
        a_enfileirar: novos.length,
        faltando_nomes: faltando.map((m) => m.nome),
        voltou_ao_verde: i.templates_resync_pendente === true,
        _novos: novos.map((m) => m.id),
      };
    });

    // Números que acabaram de voltar ao verde entram primeiro na fila.
    relatorio.sort((a, b) => Number(b.voltou_ao_verde) - Number(a.voltou_ao_verde));

    const comPendencia = relatorio.filter((r) => r.a_enfileirar > 0);
    const completas = relatorio.filter((r) => r.faltando === 0).length;

    const resposta = {
      success: true,
      modo: utilityApprovedOnly ? "utility_aprovados" : "marcados_automaticos",
      modelos: lista.length,
      verificadas: relatorio.length,
      completas,
      ignoradas,
      instancias: relatorio.map(({ _novos, ...r }) => r),
      total_a_enfileirar: comPendencia.reduce((s, r) => s + r.a_enfileirar, 0),
    };

    if (!auto && dryRun) return json(resposta);


    // ===== Enfileira os faltantes =====
    let enfileirados = 0;
    for (const r of comPendencia) {
      const rows = r._novos.map((mestreId, idx) => ({
        instancia_id: r.id,
        template_mestre_id: mestreId,
        status: "PENDENTE",
        prioridade: r._novos.length - idx,
        agendado_para: new Date().toISOString(),
      }));
      const recoverIds = rows.map(row => terminalRows.get(`${r.id}|${row.template_mestre_id}`))
        .filter(prior => prior && isInternalSlotFailure(prior.motivo)).map(prior => prior.id);
      let count = 0;
      if (recoverIds.length) {
        const { data, error } = await supabase.from("meta_templates_onboarding_fila")
          .update({ status: "PENDENTE", enviado_em: null, finalizado_em: null, tentativas: 0, agendado_para: new Date().toISOString(), motivo: "Reserva interna corrigida; aguardando aplicação" })
          .in("id", recoverIds).like("motivo", "%meta_template_daily_reservations_slot_check%").select("id");
        if (error) throw error;
        count += data?.length || 0;
      }
      const fresh = rows.filter(row => !terminalRows.has(`${r.id}|${row.template_mestre_id}`));
      if (fresh.length) {
        const { data, error } = await supabase.from("meta_templates_onboarding_fila")
          .upsert(fresh, { onConflict: "instancia_id,template_mestre_id", ignoreDuplicates: true }).select("id");
        if (error) throw error;
        count += data?.length || 0;
      }
      enfileirados += count;
      await supabase
        .from("meta_whatsapp_instances")
        .update({
          templates_auto_copiar: true,
          templates_auto_status: "EM_ANDAMENTO",
          templates_auto_iniciado_em: new Date().toISOString(),
        })
        .eq("id", r.id);

      // Voltou ao verde: avisa que a sincronização foi retomada.
      if (r.voltou_ao_verde) {
        const inst = elegiveis.find((i) => i.id === r.id);
        await notificarAdmin(supabase, {
          tipo: "templates_resync_pos_green",
          destinatarios: DESTINO_AVISO,
          chaveIdempotencia: `resync:${r.id}:${new Date().toISOString().slice(0, 10)}`,
          umaVezPorChave: true,
          mensagem:
            `🟢 *Número voltou ao verde — sincronizando templates*\n\n` +
            `Número: *${r.nome}*\n` +
            (inst ? `${await linhaBmInstancia(supabase, inst)}\n` : "") +
            `Modelos que faltavam: *${r.a_enfileirar}*\n\n` +
            `Envio gradual: contas tier 250 recebem no máximo 2 modelos de utilidade por número/dia; demais tiers mantêm o fluxo atual. 24 horas por dia, inclusive domingos.`,
        });
      }
    }

    // Todas as elegíveis foram conferidas agora: limpa a marca de re-sincronização.
    const idsResync = elegiveis.filter((i) => i.templates_resync_pendente === true).map((i) => i.id);
    if (idsResync.length > 0) {
      await supabase
        .from("meta_whatsapp_instances")
        .update({ templates_resync_pendente: false })
        .in("id", idsResync);
    }

    if (enfileirados > 0) {
      const linhas = comPendencia
        .slice(0, 15)
        .map((r) => `• ${r.nome}: ${r.a_enfileirar} modelo(s)`)
        .join("\n");

      await notificarAdmin(supabase, {
        tipo: "templates_auditoria_inicio",
        destinatarios: DESTINO_AVISO,
        chaveIdempotencia: `auditoria:${new Date().toISOString().slice(0, 16)}`,
        mensagem:
          `📋 *Completando templates das instâncias*\n\n` +
          `Números verificados: *${relatorio.length}*\n` +
          `Números com pendência: *${comPendencia.length}*\n` +
          `Modelos na fila: *${enfileirados}*\n` +
          (ignoradas.length ? `Ignorados (qualidade/bloqueio): *${ignoradas.length}*\n` : "") +
          `\n${linhas}${comPendencia.length > 15 ? "\n…" : ""}\n\n` +
          `Envio gradual: 1 por vez com 2–5 min de intervalo, 24 horas por dia, inclusive domingos.`,
      });
    }

    return json({ ...resposta, enfileirados, instancias_afetadas: comPendencia.length });
  } catch (e) {
    return json({ success: false, error: String(e) }, 500);
  }
});

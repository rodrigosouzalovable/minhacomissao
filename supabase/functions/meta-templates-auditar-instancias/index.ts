// Audita todas as instâncias próprias da API Oficial Meta e enfileira os
// templates marcados como "injetar em números novos" que estiverem faltando.
// Somente administrador. dry_run=true devolve apenas o relatório.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { notificarAdmin } from "../_shared/notificar-admin.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DESTINO_AVISO = ["5562991672674"];

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json().catch(() => ({}));
    const dryRun = body?.dry_run !== false;
    // Modo automático (cron diário): roda sem token de usuário, sempre aplicando.
    const auto = body?.auto === true;

    // ===== Autorização: somente admin (dispensado no modo automático) =====
    if (!auto) {
      const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
      if (!token) return json({ success: false, error: "nao_autenticado" }, 401);
      const { data: userData } = await supabase.auth.getUser(token);
      const uid = userData?.user?.id;
      if (!uid) return json({ success: false, error: "nao_autenticado" }, 401);
      const { data: ehAdmin } = await supabase.rpc("has_role", { _user_id: uid, _role: "admin" });
      if (ehAdmin !== true) return json({ success: false, error: "somente_admin" }, 403);
    }


    // ===== Modelos marcados para injeção =====
    const { data: marcados } = await supabase
      .from("meta_templates_mestre")
      .select("id, nome, idioma")
      .eq("injetar_em_novos", true)
      .order("criado_em", { ascending: true });
    const lista = ((marcados as any[]) || []).map((r) => ({
      id: r.id as string,
      nome: r.nome as string,
      idioma: String(r.idioma || "pt_BR"),
    }));
    if (lista.length === 0) {
      return json({ success: true, modelos: 0, erro_amigavel: "nenhum_modelo_marcado", instancias: [] });
    }

    // ===== Instâncias próprias da API Oficial =====
    const { data: parceirosRows } = await supabase
      .from("meta_instance_parceiros")
      .select("instancia_id");
    const idsParceiros = new Set<string>(((parceirosRows as any[]) || []).map((p) => p.instancia_id));

    const { data: instsRaw } = await supabase
      .from("meta_whatsapp_instances")
      .select("id, nome, display_phone, waba_id, access_token, saude_quality, saude_status, meta_name_status, ativo, provider, templates_auto_pausado_ate, templates_resync_pendente")
      .eq("ativo", true)
      .eq("provider", "meta");

    const insts = ((instsRaw as any[]) || []).filter((i) => !idsParceiros.has(i.id));

    const motivoIgnorar = (i: any): string | null => {
      if (!i.waba_id || !i.access_token) return "sem credenciais da Meta";
      const status = String(i.saude_status || "").toUpperCase();
      const qual = String(i.saude_quality || "").toUpperCase();
      const nomeStatus = String(i.meta_name_status || "").toUpperCase();
      if (qual === "YELLOW") return "qualidade amarela";
      if (qual === "RED") return "qualidade vermelha";
      if (nomeStatus === "REJECTED") return "nome reprovado";
      if (["BANNED", "RESTRICTED", "FLAGGED", "DISABLED", "PENDING_PAYMENT"].includes(status)) {
        return `situação na Meta: ${status}`;
      }
      if (status && status !== "CONNECTED" && status !== "PENDING_REVIEW") {
        return `não conectado (${status})`;
      }
      if (i.templates_auto_pausado_ate && new Date(i.templates_auto_pausado_ate) > new Date()) {
        return "fila pausada temporariamente";
      }
      return null;
    };

    const elegiveis = insts.filter((i) => motivoIgnorar(i) === null);
    const ignoradas = insts
      .filter((i) => motivoIgnorar(i) !== null)
      .map((i) => ({
        id: i.id,
        nome: i.nome || i.display_phone || i.id.slice(0, 8),
        motivo: motivoIgnorar(i)!,
      }));

    // ===== O que cada instância já possui =====
    const idsElegiveis = elegiveis.map((i) => i.id);
    const jaTem = new Map<string, Set<string>>();
    if (idsElegiveis.length > 0) {
      const { data: existentes } = await supabase
        .from("meta_templates_instancia")
        .select("instancia_id, template_mestre_id")
        .in("instancia_id", idsElegiveis);
      for (const r of ((existentes as any[]) || [])) {
        if (!jaTem.has(r.instancia_id)) jaTem.set(r.instancia_id, new Set());
        jaTem.get(r.instancia_id)!.add(r.template_mestre_id);
      }
    }

    // Templates REAIS existentes na Meta (nome|idioma) — cobre números conectados
    // antes da injeção automática existir.
    const jaTemNome = new Map<string, Set<string>>();
    if (idsElegiveis.length > 0) {
      const { data: reais } = await supabase
        .from("meta_whatsapp_templates")
        .select("instancia_id, nome_template, idioma, status")
        .in("instancia_id", idsElegiveis);
      for (const r of ((reais as any[]) || [])) {
        const st = String(r.status || "").toLowerCase();
        if (!["approved", "pending", "in_appeal", "pending_deletion"].includes(st)) continue;
        if (!jaTemNome.has(r.instancia_id)) jaTemNome.set(r.instancia_id, new Set());
        jaTemNome.get(r.instancia_id)!.add(`${r.nome_template}|${String(r.idioma || "pt_BR")}`);
      }
    }

    // Itens já na fila (não repetir contagem de pendentes)
    const naFila = new Map<string, Set<string>>();
    if (idsElegiveis.length > 0) {
      const { data: fila } = await supabase
        .from("meta_templates_onboarding_fila")
        .select("instancia_id, template_mestre_id, status")
        .in("instancia_id", idsElegiveis);
      for (const r of ((fila as any[]) || [])) {
        if (!naFila.has(r.instancia_id)) naFila.set(r.instancia_id, new Set());
        naFila.get(r.instancia_id)!.add(r.template_mestre_id);
      }
    }

    const relatorio = elegiveis.map((i) => {
      const tem = jaTem.get(i.id) || new Set<string>();
      const temNome = jaTemNome.get(i.id) || new Set<string>();
      const fila = naFila.get(i.id) || new Set<string>();
      const faltando = lista.filter(
        (m) => !tem.has(m.id) && !temNome.has(`${m.nome}|${m.idioma}`),
      );
      const novos = faltando.filter((m) => !fila.has(m.id));
      return {
        id: i.id,
        nome: i.nome || i.display_phone || i.id.slice(0, 8),
        telefone: i.display_phone || null,
        total_modelos: lista.length,
        possui: lista.length - faltando.length,
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
      const { error } = await supabase
        .from("meta_templates_onboarding_fila")
        .upsert(rows, { onConflict: "instancia_id,template_mestre_id", ignoreDuplicates: true });
      if (error) continue;
      enfileirados += rows.length;
      await supabase
        .from("meta_whatsapp_instances")
        .update({
          templates_auto_copiar: true,
          templates_auto_status: "EM_ANDAMENTO",
          templates_auto_pausado_ate: null,
          templates_auto_rejeicoes_seguidas: 0,
          templates_auto_iniciado_em: new Date().toISOString(),
        })
        .eq("id", r.id);
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
          `Envio gradual: 1 por vez com 2–5 min de intervalo, das 07h às 20h e nunca no domingo.`,
      });
    }

    return json({ ...resposta, enfileirados, instancias_afetadas: comPendencia.length });
  } catch (e) {
    return json({ success: false, error: String(e) }, 500);
  }
});

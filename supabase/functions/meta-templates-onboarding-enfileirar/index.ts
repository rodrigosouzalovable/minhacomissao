// Monta a fila de cópia gradual de templates já aprovados para um número novo.
// Só administradores podem chamar. Avisa no WhatsApp quando a fila começa.
// Também aceita instancia_ids[] + template_nome/idioma para injetar UM modelo
// específico apenas nas instâncias que ainda não o possuem (usado no Envio Meta).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { notificarAdmin } from "../_shared/notificar-admin.ts";
import { linhaBmInstancia } from "../_shared/rotulo-instancia.ts";
import { modelosParaCopiar } from "../_shared/meta-template-copy-candidates.ts";
import { motivoBloqueioTemplate } from "../_shared/meta-template-eligibility.ts";

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
    const serviceToken = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const interno = body?.interno === true && !!serviceToken && req.headers.get("Authorization") === `Bearer ${serviceToken}`;
    let solicitanteId: string | null = null;
    const listaInstancias: string[] = Array.isArray(body?.instancia_ids)
      ? body.instancia_ids.map((x: unknown) => String(x || "").trim()).filter(Boolean)
      : [String(body?.instancia_id || "").trim()].filter(Boolean);
    if (listaInstancias.length === 0) {
      return json({ success: false, error: "instancia_id obrigatório" }, 400);
    }

    // Autorização: somente admin (exceto chamadas internas do próprio sistema)
    if (!interno) {
      const authHeader = req.headers.get("Authorization") || "";
      const token = authHeader.replace("Bearer ", "");
      const { data: userData } = await supabase.auth.getUser(token);
      const uid = userData?.user?.id;
      if (!uid) return json({ success: false, error: "nao_autenticado" }, 401);
      const { data: ehAdmin } = await supabase.rpc("has_role", { _user_id: uid, _role: "admin" });
      if (ehAdmin !== true) return json({ success: false, error: "somente_admin" }, 403);
      solicitanteId = uid;
    }

    // Modelo específico (opcional): injeta apenas esse template.
    const templateNome = String(body?.template_nome || "").trim();
    const templateIdioma = String(body?.idioma || "").trim();
    let mestresEspecificos: Array<{
      id: string;
      nome: string;
      idioma: string;
      criado_por: string | null;
      categoria: string;
      reclassificado_marketing: boolean;
    }> | null = null;
    if (templateNome) {
      let q = supabase
        .from("meta_templates_mestre")
        .select("id, nome, idioma, criado_por, categoria, reclassificado_marketing")
        .eq("nome", templateNome);
      if (templateIdioma) q = q.eq("idioma", templateIdioma);
      const { data: mestres, error: mestresError } = await q;
      if (mestresError) throw mestresError;
      const encontrados = ((mestres as any[]) || []) as typeof mestresEspecificos;
      if (encontrados.length === 0) {
        // Erro de negócio: responder 200 permite que a tela mostre a orientação
        // sem transformar o caso esperado em RUNTIME_ERROR do invoke.
        return json({ success: false, error: "template_nao_cadastrado_como_mestre" });
      }
      mestresEspecificos = encontrados.filter((m) =>
        String(m.categoria || "").toUpperCase() === "UTILITY" &&
        m.reclassificado_marketing !== true
      );
      if (mestresEspecificos.length === 0) {
        return json({ success: false, error: "template_mestre_nao_elegivel" });
      }
    }

    const resultados: any[] = [];

    for (const instanciaId of listaInstancias) {
      const { data: inst } = await supabase
        .from("meta_whatsapp_instances")
        .select("id, nome, display_phone, user_id, provider, ativo, saude_quality, saude_status, waba_id, access_token, templates_auto_copiar, meta_bm_id, business_id, qualidade_leitura_ok, qualidade_leitura_erro, meta_name_status, saude_ban_info, saude_restricoes, pausa_automatica_motivo, templates_auto_pausado_ate, templates_auto_status, instancia_teste_aquecimento")
        .eq("id", instanciaId)
        .maybeSingle();
      if (!inst) {
        resultados.push({ instancia_id: instanciaId, ok: false, erro: "instancia_nao_encontrada" });
        continue;
      }
      const { data: parceiro } = await supabase.from("meta_instance_parceiros")
        .select("instancia_id").eq("instancia_id", instanciaId).maybeSingle();
      if (parceiro) {
        resultados.push({ instancia_id: instanciaId, ok: false, erro: "instancia_de_parceiro" });
        continue;
      }
      if ((inst as any).provider && (inst as any).provider !== "meta") {
        resultados.push({ instancia_id: instanciaId, ok: false, erro: "somente_api_oficial" });
        continue;
      }
      if (!inst.waba_id || !inst.access_token) {
        resultados.push({ instancia_id: instanciaId, ok: false, erro: "instancia_sem_credenciais" });
        continue;
      }
      if (solicitanteId && inst.user_id !== solicitanteId) {
        resultados.push({ instancia_id: instanciaId, ok: false, erro: "instancia_de_outro_proprietario" });
        continue;
      }
      const idsMestreDoProprietario = mestresEspecificos
        ?.filter((m) => m.criado_por === inst.user_id)
        .map((m) => m.id) ?? null;
      if (mestresEspecificos && idsMestreDoProprietario?.length === 0) {
        resultados.push({ instancia_id: instanciaId, ok: false, erro: "template_mestre_de_outro_proprietario" });
        continue;
      }
      const bloqueio = motivoBloqueioTemplate(inst);
      if (bloqueio || inst.instancia_teste_aquecimento || inst.templates_auto_copiar !== true) {
        resultados.push({ instancia_id: instanciaId, ok: false, erro: bloqueio || (inst.instancia_teste_aquecimento ? "instancia_de_teste" : "copia_automatica_desativada") });
        continue;
      }

      // Modelos já processados internamente e templates reais conhecidos nesse número.
      const { data: aprovados } = await supabase
        .from("meta_templates_instancia")
        .select("template_mestre_id, instancia_id, status")
        .eq("instancia_id", instanciaId);

      const jaNoNumero = new Set<string>();
      for (const r of (aprovados as any[]) || []) {
        if (r.instancia_id === instanciaId) {
          if (["APPROVED", "PENDING", "IN_APPEAL", "ENVIADO"].includes(String(r.status || "").toUpperCase())) {
            jaNoNumero.add(r.template_mestre_id);
          }
          continue;
        }
      }

      let mestresQuery = supabase
        .from("meta_templates_mestre")
        .select("id,nome,idioma,categoria,criado_por,injetar_em_novos,reclassificado_marketing")
        .eq("criado_por", inst.user_id)
        .eq("categoria", "UTILITY")
        .eq("reclassificado_marketing", false)
        .order("criado_em", { ascending: true });
      // A marcação “injetar em números novos” vale apenas para o fluxo automático.
      // Uma aplicação manual pode usar qualquer mestre Utility seguro do proprietário.
      if (idsMestreDoProprietario) mestresQuery = mestresQuery.in("id", idsMestreDoProprietario);
      else mestresQuery = mestresQuery.eq("injetar_em_novos", true);
      const { data: mestresValidos, error: mestresError } = await mestresQuery;
      if (mestresError) throw mestresError;
      const mestresPermitidos = (mestresValidos as any[]) || [];
      const { data: reais } = await supabase.from("meta_whatsapp_templates")
        .select("nome_template,idioma,status").eq("instancia_id", instanciaId);
      const chavesReais = new Set(((reais as any[]) || [])
        .filter((r) => ["approved", "pending", "in_appeal", "pending_deletion"].includes(String(r.status || "").toLowerCase()))
        .map((r) => `${r.nome_template}|${r.idioma || "pt_BR"}`));
      const mestresAusentes = mestresPermitidos.filter((m) => !chavesReais.has(`${m.nome}|${m.idioma || "pt_BR"}`));
      const { data: filaAtual } = await supabase.from("meta_templates_onboarding_fila")
        .select("template_mestre_id,status").eq("instancia_id", instanciaId);
      const emProcessamento = new Set(((filaAtual as any[]) || [])
        .filter((r) => ["PENDENTE", "ENVIADO", "APPROVED"].includes(String(r.status || "").toUpperCase()))
        .map((r) => r.template_mestre_id));

      const aplicaveis = modelosParaCopiar(mestresPermitidos, jaNoNumero, chavesReais, emProcessamento);
      const candidatos: [string, number][] = aplicaveis.map((m, idx) => [m.id, aplicaveis.length - idx]);

      if (candidatos.length === 0) {
        resultados.push({
          instancia_id: instanciaId,
          ok: true,
          enfileirados: 0,
          motivo: "nenhum_modelo_pendente",
        });
        continue;
      }

      const rows = candidatos.map(([mestreId, votos]) => ({
        instancia_id: instanciaId,
        template_mestre_id: mestreId,
        status: "PENDENTE",
        prioridade: votos,
        agendado_para: new Date().toISOString(),
      }));

      const { data: inseridos, error: errIns } = await supabase
        .from("meta_templates_onboarding_fila")
        .upsert(rows, { onConflict: "instancia_id,template_mestre_id", ignoreDuplicates: true }).select("template_mestre_id");
      if (errIns) {
        resultados.push({ instancia_id: instanciaId, ok: false, erro: errIns.message });
        continue;
      }

      const quantidade = inseridos?.length || 0;
      if (quantidade === 0) {
        resultados.push({ instancia_id: instanciaId, ok: true, enfileirados: 0, motivo: "ja_na_fila" });
        continue;
      }
      await supabase
        .from("meta_whatsapp_instances")
        .update({
          templates_auto_copiar: true,
          templates_auto_status: "EM_ANDAMENTO",
          templates_auto_iniciado_em: new Date().toISOString(),
        })
        .eq("id", instanciaId);

      const bm = await linhaBmInstancia(supabase, inst).catch(() => "");
      await notificarAdmin(supabase, {
        tipo: "templates_onboarding_inicio",
        destinatarios: DESTINO_AVISO,
        chaveIdempotencia: `${instanciaId}:${templateNome || "todos"}:${new Date().toISOString().slice(0, 10)}`,
        mensagem:
          `📋 *Cópia de templates iniciada*\n\n` +
          `Número: *${inst.nome || inst.display_phone || instanciaId}*\n` +
          (bm ? `${bm}\n` : "") +
          (templateNome ? `Modelo: *${templateNome}*\n` : "") +
          `Modelos na fila: *${quantidade}*\n\n` +
          `Envio gradual: contas tier 250 recebem no máximo 2 modelos por número/dia; demais tiers mantêm o fluxo atual. Sempre das 07h às 20h e nunca no domingo.`,
      });

      resultados.push({ instancia_id: instanciaId, ok: true, enfileirados: quantidade });
    }

    const enfileirados = resultados.reduce((s, r) => s + (r.enfileirados || 0), 0);
    const algumSucesso = resultados.some((r) => r.ok === true);
    const primeiroErro = resultados.find((r) => r.erro)?.erro;
    return json({
      success: algumSucesso,
      enfileirados,
      instancias: resultados,
      ...(!algumSucesso && primeiroErro ? { error: primeiroErro } : {}),
      // compat: chamadas antigas de 1 instância
      ...(listaInstancias.length === 1 && resultados[0]?.erro ? { error: resultados[0].erro } : {}),
    });
  } catch (e) {
    return json({ success: false, error: String(e) }, 500);
  }
});

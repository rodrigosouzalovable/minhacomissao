// Monta a fila de cópia gradual de templates já aprovados para um número novo.
// Só administradores podem chamar. Avisa no WhatsApp quando a fila começa.
// Também aceita instancia_ids[] + template_nome/idioma para injetar UM modelo
// específico apenas nas instâncias que ainda não o possuem (usado no Envio Meta).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { notificarAdmin } from "../_shared/notificar-admin.ts";
import { linhaBmInstancia } from "../_shared/rotulo-instancia.ts";

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
    const interno = body?.interno === true;
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
    let restricaoMestres: string[] | null = null;
    if (templateNome) {
      let q = supabase.from("meta_templates_mestre").select("id, nome, idioma, criado_por").eq("nome", templateNome).in("categoria", ["UTILITY", "MARKETING"]);
      if (templateIdioma) q = q.eq("idioma", templateIdioma);
      const { data: mestres } = await q;
      restricaoMestres = ((mestres as any[]) || []).map((r) => r.id as string);
      if (restricaoMestres.length === 0) {
        return json({ success: false, error: "template_nao_cadastrado_como_mestre" }, 400);
      }
    }

    const resultados: any[] = [];

    for (const instanciaId of listaInstancias) {
      const { data: inst } = await supabase
        .from("meta_whatsapp_instances")
        .select("id, nome, display_phone, user_id, provider, ativo, saude_quality, saude_status, waba_id, access_token, templates_auto_copiar, meta_bm_id, business_id")
        .eq("id", instanciaId)
        .maybeSingle();
      if (!inst) {
        resultados.push({ instancia_id: instanciaId, ok: false, erro: "instancia_nao_encontrada" });
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
      if (String(inst.saude_quality || "").toUpperCase() !== "GREEN" || String(inst.saude_status || "").toUpperCase() !== "CONNECTED") {
        resultados.push({ instancia_id: instanciaId, ok: false, erro: "instancia_precisa_estar_conectada_e_green" });
        continue;
      }

      // Modelos já processados internamente e templates reais conhecidos nesse número.
      const { data: aprovados } = await supabase
        .from("meta_templates_instancia")
        .select("template_mestre_id, instancia_id, status");

      const contagem = new Map<string, number>();
      const jaNoNumero = new Set<string>();
      for (const r of (aprovados as any[]) || []) {
        if (r.instancia_id === instanciaId) {
          if (["APPROVED", "PENDING", "IN_APPEAL", "ENVIADO"].includes(String(r.status || "").toUpperCase())) {
            jaNoNumero.add(r.template_mestre_id);
          }
          continue;
        }
        if (String(r.status || "").toUpperCase() !== "APPROVED") continue;
        contagem.set(r.template_mestre_id, (contagem.get(r.template_mestre_id) || 0) + 1);
      }

      const { data: mestresValidos, error: mestresError } = await supabase
        .from("meta_templates_mestre")
        .select("id,nome,idioma,categoria,criado_por,injetar_em_novos")
        .eq("criado_por", inst.user_id)
        .eq("injetar_em_novos", true)
        .in("categoria", ["UTILITY", "MARKETING"])
        .order("criado_em", { ascending: true });
      if (mestresError) throw mestresError;
      const mestresPermitidos = ((mestresValidos as any[]) || []).filter((m) => !restricaoMestres || restricaoMestres.includes(m.id));
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

      let candidatos: [string, number][];
      if (restricaoMestres) {
        const idsPermitidos = new Set(mestresPermitidos.map((m) => m.id as string));
        candidatos = restricaoMestres
          .filter((id) => idsPermitidos.has(id))
          .filter((id) => !jaNoNumero.has(id))
          .map((id, idx) => [id, restricaoMestres!.length - idx] as [string, number]);
      } else {
        const listaAplicaveis = mestresAusentes.map((r) => r.id as string);
        candidatos = listaAplicaveis
          .filter((id) => !jaNoNumero.has(id) && !emProcessamento.has(id))
          .map((id, idx) => [id, (contagem.get(id) || 0) * 1000 + listaAplicaveis.length - idx] as [string, number])
          .sort((a, b) => b[1] - a[1]);
      }

      if (candidatos.length === 0) {
        if (!restricaoMestres) {
          await supabase
            .from("meta_whatsapp_instances")
            .update({ templates_auto_status: "SEM_MODELOS" })
            .eq("id", instanciaId);
        }
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

      const { error: errIns } = await supabase
        .from("meta_templates_onboarding_fila")
        .upsert(rows, { onConflict: "instancia_id,template_mestre_id" });
      if (errIns) {
        resultados.push({ instancia_id: instanciaId, ok: false, erro: errIns.message });
        continue;
      }

      await supabase
        .from("meta_whatsapp_instances")
        .update({
          templates_auto_copiar: true,
          templates_auto_status: "EM_ANDAMENTO",
          templates_auto_pausado_ate: null,
          templates_auto_rejeicoes_seguidas: 0,
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
          `Modelos na fila: *${rows.length}*\n\n` +
          `Envio gradual: contas tier 250 recebem no máximo 2 modelos por número/dia; demais tiers mantêm o fluxo atual. Sempre das 07h às 20h e nunca no domingo.`,
      });

      resultados.push({ instancia_id: instanciaId, ok: true, enfileirados: rows.length });
    }

    const enfileirados = resultados.reduce((s, r) => s + (r.enfileirados || 0), 0);
    return json({
      success: true,
      enfileirados,
      instancias: resultados,
      // compat: chamadas antigas de 1 instância
      ...(listaInstancias.length === 1 && resultados[0]?.erro ? { error: resultados[0].erro } : {}),
    });
  } catch (e) {
    return json({ success: false, error: String(e) }, 500);
  }
});

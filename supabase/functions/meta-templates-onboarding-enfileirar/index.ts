// Monta a fila de cópia gradual de templates já aprovados para um número novo.
// Só administradores podem chamar. Avisa no WhatsApp quando a fila começa.
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
    const instanciaId = String(body?.instancia_id || "").trim();
    const interno = body?.interno === true;
    if (!instanciaId) return json({ success: false, error: "instancia_id obrigatório" }, 400);

    // Autorização: somente admin (exceto chamadas internas do próprio sistema)
    if (!interno) {
      const authHeader = req.headers.get("Authorization") || "";
      const token = authHeader.replace("Bearer ", "");
      const { data: userData } = await supabase.auth.getUser(token);
      const uid = userData?.user?.id;
      if (!uid) return json({ success: false, error: "nao_autenticado" }, 401);
      const { data: ehAdmin } = await supabase.rpc("has_role", { _user_id: uid, _role: "admin" });
      if (ehAdmin !== true) return json({ success: false, error: "somente_admin" }, 403);
    }

    const { data: inst } = await supabase
      .from("meta_whatsapp_instances")
      .select("id, nome, display_phone, provider, waba_id, access_token, templates_auto_copiar, meta_bm_id, business_id")
      .eq("id", instanciaId)
      .maybeSingle();
    if (!inst) return json({ success: false, error: "instancia_nao_encontrada" }, 404);
    if ((inst as any).provider && (inst as any).provider !== "meta") {
      return json({ success: false, error: "somente_api_oficial" }, 400);
    }
    if (!inst.waba_id || !inst.access_token) {
      return json({ success: false, error: "instancia_sem_credenciais" }, 400);
    }

    // Modelos já aprovados em OUTROS números (os que a Meta claramente aceita)
    const { data: aprovados } = await supabase
      .from("meta_templates_instancia")
      .select("template_mestre_id, instancia_id, status");

    const contagem = new Map<string, number>();
    const jaNoNumero = new Set<string>();
    for (const r of (aprovados as any[]) || []) {
      if (r.instancia_id === instanciaId) {
        jaNoNumero.add(r.template_mestre_id);
        continue;
      }
      if (String(r.status || "").toUpperCase() !== "APPROVED") continue;
      contagem.set(r.template_mestre_id, (contagem.get(r.template_mestre_id) || 0) + 1);
    }

    // Se o admin marcou modelos específicos ("injetar em números novos"),
    // a fila usa exatamente esses — na ordem da lista. Sem marcação, mantém
    // a escolha automática pelos mais aprovados em outros números.
    const { data: marcados } = await supabase
      .from("meta_templates_mestre")
      .select("id")
      .eq("injetar_em_novos", true)
      .order("criado_em", { ascending: true });

    const listaMarcados = ((marcados as any[]) || []).map((r) => r.id as string);

    const candidatos: [string, number][] = listaMarcados.length > 0
      ? listaMarcados
          .filter((id) => !jaNoNumero.has(id))
          .map((id, idx) => [id, listaMarcados.length - idx] as [string, number])
      : Array.from(contagem.entries())
          .filter(([id]) => !jaNoNumero.has(id))
          .sort((a, b) => b[1] - a[1]);


    if (candidatos.length === 0) {
      await supabase
        .from("meta_whatsapp_instances")
        .update({ templates_auto_status: "SEM_MODELOS" })
        .eq("id", instanciaId);
      return json({ success: true, enfileirados: 0, motivo: "nenhum_modelo_aprovado_disponivel" });
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
      .upsert(rows, { onConflict: "instancia_id,template_mestre_id", ignoreDuplicates: true });
    if (errIns) return json({ success: false, error: errIns.message }, 500);

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
      chaveIdempotencia: `${instanciaId}:${new Date().toISOString().slice(0, 10)}`,
      mensagem:
        `📋 *Cópia de templates iniciada*\n\n` +
        `Número: *${inst.nome || inst.display_phone || instanciaId}*\n` +
        (bm ? `${bm}\n` : "") +
        `Modelos na fila: *${rows.length}*\n\n` +
        `Envio gradual: 1 por vez com 2–5 min de intervalo, das 07h às 20h e nunca no domingo.`,
    });

    return json({ success: true, enfileirados: rows.length });
  } catch (e) {
    return json({ success: false, error: String(e) }, 500);
  }
});

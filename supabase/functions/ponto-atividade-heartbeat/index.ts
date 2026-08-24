// Recebe o batimento de atividade do funcionário e mantém presença + janelas de inatividade.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.88.0";
import { dataBRT } from "../_shared/ponto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Não autenticado" }, 401);

    const anon = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await anon.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Sessão inválida" }, 401);
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    // "ativo" = houve interação; "inativo" = passou do limite sem interação
    const estado = body?.estado === "inativo" ? "inativo" : "ativo";
    const pagina = typeof body?.pagina === "string" ? body.pagina.slice(0, 200) : null;
    const inativoDesde = typeof body?.inativo_desde === "string" ? body.inativo_desde : null;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const agora = new Date();
    const agoraISO = agora.toISOString();

    // Janela de inatividade aberta (se houver)
    const { data: aberta } = await admin
      .from("atividade_inatividade")
      .select("id, inicio")
      .eq("user_id", userId)
      .is("fim", null)
      .maybeSingle();

    if (estado === "inativo") {
      if (!aberta) {
        const inicio = inativoDesde ?? agoraISO;
        await admin.from("atividade_inatividade").insert({
          user_id: userId,
          data: dataBRT(agora),
          inicio,
        });
      }
      await admin.from("atividade_presenca").upsert({
        user_id: userId,
        ultima_interacao: inativoDesde ?? agoraISO,
        status: "inativo",
        pagina,
        inativo_desde: inativoDesde ?? agoraISO,
        updated_at: agoraISO,
      }, { onConflict: "user_id" });
      return json({ ok: true, estado });
    }

    // Voltou a ficar ativo: fecha janela aberta
    if (aberta) {
      const dur = Math.max(0, Math.round((agora.getTime() - new Date(aberta.inicio).getTime()) / 1000));
      await admin
        .from("atividade_inatividade")
        .update({ fim: agoraISO, duracao_seg: dur })
        .eq("id", aberta.id);
    }

    await admin.from("atividade_presenca").upsert({
      user_id: userId,
      ultima_interacao: agoraISO,
      status: "ativo",
      pagina,
      inativo_desde: null,
      updated_at: agoraISO,
    }, { onConflict: "user_id" });

    return json({ ok: true, estado });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Erro inesperado" }, 500);
  }
});

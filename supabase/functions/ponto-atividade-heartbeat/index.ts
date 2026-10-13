// Recebe o batimento de atividade do funcionário e mantém presença + janelas de inatividade.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.88.0";
import { dataBRT, horaBRT, diaSemanaBRT } from "../_shared/ponto.ts";
import { notificarNumeros } from "../_shared/notificar-numeros.ts";

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

    const avisar = async (mensagemFn: (nome: string) => string, chave: string) => {
      try {
        if (diaSemanaBRT(agora) === 0) return;
        const { data: perfil } = await admin.from("profiles").select("nome").eq("id", userId).maybeSingle();
        const nome = (perfil as { nome?: string } | null)?.nome || "Funcionário";
        await notificarNumeros(admin, {
          tipo: "ponto_inatividade",
          mensagem: mensagemFn(nome),
          destinatarios: ["62991672674"],
          chaveIdempotencia: chave,
        });
      } catch (e) {
        console.error("[heartbeat] falha ao notificar", e);
      }
    };

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
        const { data: nova } = await admin.from("atividade_inatividade").insert({
          user_id: userId,
          data: dataBRT(agora),
          inicio,
        }).select("id").maybeSingle();
        if (nova?.id) {
          const desde = horaBRT(new Date(inicio));
          await avisar(
            (nome) => `*INATIVIDADE*\nFuncionário *${nome}* está há 10 minutos sem mexer no sistema (desde ${desde}${pagina ? `, página ${pagina}` : ""}).`,
            `inatividade:${nova.id}:inicio`,
          );
        }
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
      if (dur >= 600) {
        const min = Math.round(dur / 60);
        await avisar(
          (nome) => `*RETORNO*\nFuncionário *${nome}* voltou ao sistema após ${min} minutos parado (às ${horaBRT(agora)}).`,
          `inatividade:${aberta.id}:fim`,
        );
      }
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

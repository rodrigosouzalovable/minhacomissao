import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function mensagemPorNivel(nivel: string, consumo: number, limite: number, bloqueio: number, reset: string): string {
  const pct = Math.round((consumo / Math.max(limite, 1)) * 100);
  switch (nivel) {
    case "bloqueado":
      return `🚫 Limite mensal de consultas atingido (${bloqueio}). O contador será resetado em ${reset}.`;
    case "critico":
      return `🔴 ALERTA! Você está próximo do limite mensal (${consumo} de ${limite}). Novas buscas serão bloqueadas ao atingir ${bloqueio} consultas.`;
    case "alto":
      return `⚠️ Atenção! Você já utilizou ${consumo} consultas (${pct}% do limite). Seu limite mensal é de ${limite} consultas.`;
    default:
      return `Você já utilizou ${consumo} consultas este mês. Limite: ${limite}.`;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Sem permissão para o Google Maps Leads" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data, error } = await supabase.rpc("gm_status_uso");
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    const { data: provedores, error: provedoresError } = await supabase.rpc("gm_status_chaves");
    if (provedoresError) throw provedoresError;
    const contas = (provedores ?? []) as Array<any>;
    const ativa = contas.find((c) => c.em_uso && c.configurada && c.pode_buscar)
      ?? contas.find((c) => c.configurada && c.pode_buscar);
    const consumoAtual = contas.reduce((total, conta) => total + Number(conta.total_consultas || 0), 0);
    const limiteMaximo = contas.reduce((total, conta) => total + Number(conta.limite_maximo || 0), 0);
    const limiteBloqueio = contas.reduce((total, conta) => total + Number(conta.limite_bloqueio || 0), 0);
    const percentual = limiteMaximo > 0 ? (consumoAtual / limiteMaximo) * 100 : 0;
    const nivel = !ativa ? "bloqueado" : percentual >= 90 ? "critico" : percentual >= 75 ? "alto" : "normal";
    const dataResetBR = new Date(row.data_reset).toLocaleDateString("pt-BR");
    const mensagem = mensagemPorNivel(
      nivel,
      consumoAtual,
      limiteMaximo,
      limiteBloqueio,
      dataResetBR,
    );

    return new Response(
      JSON.stringify({
        pode_buscar: !!ativa,
        consumo_atual: consumoAtual,
        limite_maximo: limiteMaximo,
        limite_bloqueio: limiteBloqueio,
        alerta_percentual: row.alerta_percentual,
        percentual_consumido: percentual,
        data_reset: row.data_reset,
        data_reset_br: dataResetBR,
        nivel,
        mes_referencia: row.mes_referencia,
        mensagem,
        conta_ativa: ativa?.chave_id ?? null,
        provedores: contas,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("verificar-limite-google-maps erro:", err);
    return new Response(JSON.stringify({ error: String((err as any)?.message ?? err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

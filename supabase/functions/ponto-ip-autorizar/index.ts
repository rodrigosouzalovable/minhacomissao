// Retorna o IP público atual e (admin) permite cadastrar/remover redes autorizadas para bater ponto.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.88.0";
import { ipDoRequest, ipAutorizado } from "../_shared/ponto.ts";

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

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();
    const isAdmin = roleRow?.role === "admin";

    const ip = ipDoRequest(req);
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const acao = String(body?.acao ?? "consultar");

    if (acao === "consultar") {
      const { data: regras } = await admin.from("ponto_ips_autorizados").select("cidr, ativo");
      return json({ ip, autorizado: ipAutorizado(ip, regras ?? []) });
    }

    if (!isAdmin) return json({ error: "Apenas administradores" }, 403);

    if (acao === "autorizar_atual" || acao === "adicionar") {
      const cidr = acao === "adicionar" ? String(body?.cidr ?? "").trim() : ip;
      if (!cidr) return json({ error: "IP não identificado" }, 400);
      const { data, error } = await admin
        .from("ponto_ips_autorizados")
        .insert({
          cidr,
          descricao: String(body?.descricao ?? "").slice(0, 200) || "Rede do escritório",
          criado_por: userId,
        })
        .select("*")
        .single();
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true, regra: data, ip });
    }

    return json({ error: "Ação desconhecida" }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Erro inesperado" }, 500);
  }
});

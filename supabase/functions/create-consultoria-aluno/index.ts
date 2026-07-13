import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace("Bearer ", "");
    if (!jwt) return json({ error: "não autenticado" }, 401);

    const authClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await authClient.auth.getUser(jwt);
    const requester = userData.user;
    if (!requester) return json({ error: "sessão inválida" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Permission check: system admin OR consultoria admin
    const { data: isAdmin } = await admin.rpc("is_consultoria_admin", { _uid: requester.id });
    if (!isAdmin) return json({ error: "sem permissão" }, 403);

    const body = await req.json();
    const { nome, email, senha, empresa, telefone, is_admin_consultoria } = body ?? {};
    if (!nome || !email || !senha || String(senha).length < 6)
      return json({ error: "dados inválidos (nome, email, senha ≥ 6)" }, 400);

    // Try find existing user by email
    let userId: string | null = null;
    const { data: existing } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const found = existing?.users?.find((u) => u.email?.toLowerCase() === String(email).toLowerCase());
    if (found) {
      userId = found.id;
      await admin.auth.admin.updateUserById(userId, { password: senha });
    } else {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password: senha,
        email_confirm: true,
        user_metadata: { nome },
      });
      if (createErr) return json({ error: createErr.message }, 400);
      userId = created.user?.id ?? null;
    }
    if (!userId) return json({ error: "falha ao criar usuário" }, 500);

    const { error: upErr } = await admin.from("consultoria_alunos").upsert(
      {
        user_id: userId,
        nome,
        email,
        empresa: empresa ?? null,
        telefone: telefone ?? null,
        is_admin_consultoria: !!is_admin_consultoria,
        ativo: true,
      },
      { onConflict: "user_id" }
    );
    if (upErr) return json({ error: upErr.message }, 400);

    return json({ ok: true, user_id: userId });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

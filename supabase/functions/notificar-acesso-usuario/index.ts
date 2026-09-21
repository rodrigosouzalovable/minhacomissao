import { createClient } from "https://esm.sh/@supabase/supabase-js@2.88.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.23.8";
import { enqueueAdminNotification } from "../_shared/enqueue-admin-notification.ts";

const BodySchema = z.object({
  accessId: z.string().uuid(),
});

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  try {
    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: "Identificador de acesso inválido" }, 400);

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) return json({ error: "Não autorizado" }, 401);

    const url = Deno.env.get("SUPABASE_URL") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!url || !anonKey || !serviceKey) return json({ error: "Configuração indisponível" }, 500);

    const authClient = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser(token);
    if (authError || !user) return json({ error: "Sessão inválida" }, 401);

    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const [{ data: permission }, { data: profile }, { data: config }] = await Promise.all([
      admin.from("user_permissions").select("notificar_acesso_whatsapp").eq("user_id", user.id).maybeSingle(),
      admin.from("profiles").select("nome").eq("id", user.id).maybeSingle(),
      admin.from("admin_notificacoes_config").select("admin_phone").eq("id", 1).maybeSingle(),
    ]);

    if (!permission?.notificar_acesso_whatsapp) return json({ ok: true, skipped: "desativado" });

    const destinatario = String(config?.admin_phone || "").replace(/\D/g, "");
    if (destinatario.length < 10) return json({ error: "WhatsApp pessoal não configurado" }, 500);

    const nome = String(profile?.nome || user.user_metadata?.nome || user.email || "Usuário").trim().slice(0, 120);
    const horario = new Date().toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      dateStyle: "short",
      timeStyle: "medium",
    });
    const result = await enqueueAdminNotification(admin, {
      tipo: "acesso_usuario",
      destinatario,
      mensagem: `🔐 *Acesso ao sistema*\n\n👤 ${nome}\n🕐 ${horario}`,
      chaveIdempotencia: `${user.id}:${parsed.data.accessId}`,
    });

    if (result.error) return json({ error: result.error }, 500);
    return json({ ok: true, queued: result.queued, scheduledAt: result.scheduledAt });
  } catch (error) {
    console.error("[notificar-acesso-usuario] erro", error);
    return json({ error: "Não foi possível registrar o acesso" }, 500);
  }
});
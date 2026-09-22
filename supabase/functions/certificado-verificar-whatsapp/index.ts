import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { verificarLeadsCertificado } from "../_shared/certificado-whatsapp.ts";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const service = createClient(url, serviceKey);
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (token !== serviceKey) {
      const { data } = await service.auth.getUser(token);
      if (!data.user) return json({ error: "Não autorizado" }, 401);
      const { data: admin } = await service.rpc("has_role", { _user_id: data.user.id, _role: "admin" });
      if (admin !== true) return json({ error: "Acesso permitido apenas para administradores" }, 403);
    }
    const body = await req.json().catch(() => ({}));
    return json({ success: true, ...(await verificarLeadsCertificado(service, Number(body?.limite ?? 1000))) });
  } catch (error) { return json({ error: error instanceof Error ? error.message : "Falha ao verificar números" }, 500); }
});
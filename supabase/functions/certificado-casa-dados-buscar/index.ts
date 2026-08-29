import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { coletarJanela } from "../_shared/certificado-ingest.ts";

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

function resposta(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: jsonHeaders });
}

async function usuarioAdmin(req: Request, service: any) {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!token || !anon) return null;
  const asUser = createClient(Deno.env.get("SUPABASE_URL")!, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data } = await asUser.auth.getUser();
  const user = data.user;
  if (!user) return null;
  const { data: isAdmin } = await service.rpc("has_role", { _user_id: user.id, _role: "admin" });
  return isAdmin ? user : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return resposta({ error: "Método não permitido" }, 405);

  try {
    const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const user = await usuarioAdmin(req, service);
    if (!user) return resposta({ error: "Acesso permitido apenas para administradores" }, 403);

    const body = await req.json().catch(() => ({}));
    const janela = Number(body?.janela);
    if (!Number.isInteger(janela) || janela < 0 || janela > 30) {
      return resposta({ error: "A janela deve ser um número inteiro entre 0 e 30" }, 400);
    }

    const { data: cfg, error: cfgError } = await service
      .from("certificado_config")
      .select("id, motor_ativo, ufs, cnaes, janelas_dias, somente_mei, somente_celular")
      .limit(1)
      .maybeSingle();
    if (cfgError) throw cfgError;
    if (!cfg) return resposta({ error: "Configuração do Certificado Digital não encontrada" }, 500);
    if (!cfg.motor_ativo && body?.ignorar_motor !== true) {
      return resposta({ error: "Motor desligado. Ligue o motor antes de buscar." }, 409);
    }

    const resultado = await coletarJanela(service, cfg, janela, true);
    return resposta({ success: !resultado.erro, resultado });
  } catch (error) {
    console.error("certificado-casa-dados-buscar", error);
    return resposta({ error: error instanceof Error ? error.message : "Falha ao buscar leads" }, 500);
  }
});

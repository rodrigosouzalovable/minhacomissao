import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { CasaDosDadosError, cifrarChaveCasaDosDados, validarChaveCasaDosDados } from "../_shared/casa-dos-dados.ts";

const headers = { ...corsHeaders, "Content-Type": "application/json" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

async function obterAdmin(req: Request, service: any) {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const { data } = await service.auth.getUser(token);
  if (!data.user) return null;
  const { data: admin } = await service.rpc("has_role", { _user_id: data.user.id, _role: "admin" });
  return admin === true ? data.user : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);
  try {
    const service = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );
    const user = await obterAdmin(req, service);
    if (!user) return json({ error: "Acesso permitido apenas para administradores" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "status");
    const { data: atual, error: atualError } = await service
      .from("certificado_casa_dados_credencial")
      .select("sufixo,updated_at")
      .eq("id", 1)
      .maybeSingle();
    if (atualError) throw atualError;

    if (action === "status") {
      return json({
        configurada: !!atual || !!Deno.env.get("CASA_DOS_DADOS_API_KEY"),
        origem: atual ? "painel" : Deno.env.get("CASA_DOS_DADOS_API_KEY") ? "ambiente" : null,
        sufixo: atual?.sufixo ?? null,
        updated_at: atual?.updated_at ?? null,
      });
    }

    if (action === "remover") {
      const { error } = await service.from("certificado_casa_dados_credencial").delete().eq("id", 1);
      if (error) throw error;
      return json({ success: true, fallback: !!Deno.env.get("CASA_DOS_DADOS_API_KEY") });
    }

    if (action !== "salvar") return json({ error: "Ação inválida" }, 400);
    const chave = String(body?.chave ?? "").trim();
    if (chave.length < 20 || chave.length > 200 || /\s/.test(chave)) {
      return json({ error: "Informe uma chave válida, sem espaços, entre 20 e 200 caracteres" }, 400);
    }

    let validacao: { saldoTotal: number | null };
    try {
      validacao = await validarChaveCasaDosDados(chave);
    } catch (error) {
      const status = error instanceof CasaDosDadosError && error.status && error.status < 500 ? 400 : 503;
      return json({ error: error instanceof Error ? error.message : "Não foi possível validar a chave" }, status);
    }

    const protegida = await cifrarChaveCasaDosDados(chave);
    const { error } = await service.from("certificado_casa_dados_credencial").upsert({
      id: 1,
      chave_cifrada: protegida.chaveCifrada,
      iv: protegida.iv,
      sufixo: chave.slice(-4),
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
    return json({ success: true, sufixo: chave.slice(-4), saldo_total: validacao.saldoTotal });
  } catch (error) {
    console.error("certificado-casa-dados-chave", error);
    return json({ error: error instanceof Error ? error.message : "Falha ao configurar a chave" }, 500);
  }
});
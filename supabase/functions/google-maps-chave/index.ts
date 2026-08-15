import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function parseGooglePermissionError(status: number, rawBody: string) {
  if (status !== 403) return null;
  try {
    const parsed = JSON.parse(rawBody);
    const details: Array<{ reason?: string; metadata?: Record<string, string> }> = parsed?.error?.details ?? [];
    const info = details.find((i) => i.reason);
    const reason = info?.reason;
    const callerIp = info?.metadata?.callerIp;
    const apiName = info?.metadata?.apiName;

    if (reason === "API_KEY_IP_ADDRESS_BLOCKED") {
      return {
        reason,
        message: callerIp
          ? `A chave está com restrição de IP e bloqueou o IP de saída ${callerIp}. Troque "Restrições de aplicativo" para "Nenhuma" (recomendado para uso de backend) ou libere esse IP.`
          : 'A chave está com restrição de IP. Troque "Restrições de aplicativo" para "Nenhuma" ou libere o IP informado pelo Google.',
      };
    }
    if (reason === "API_KEY_HTTP_REFERRER_BLOCKED") {
      return {
        reason,
        message:
          'A chave está restrita por HTTP referrer. Para uso no backend, troque "Restrições de aplicativo" para "Nenhuma" ou "Endereços IP".',
      };
    }
    if (reason === "API_KEY_SERVICE_BLOCKED") {
      return {
        reason,
        message: `A chave não permite a Places API (New)${apiName ? ` (${apiName})` : ""}. Ative a API no projeto e permita ela em "Restrições de API".`,
      };
    }
  } catch (_e) {
    return null;
  }
  return { message: "O Google negou a chamada (403). Verifique as restrições da chave." };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autenticado" }, 401);

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Não autenticado" }, 401);

    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) return json({ error: "Apenas admin" }, 403);

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const action = String(body?.action ?? "status");

    async function lerChave(): Promise<string | null> {
      const { data } = await supabase.from("google_maps_config").select("api_key").eq("id", 1).maybeSingle();
      const k = (data?.api_key ?? "").trim();
      return k ? k : null;
    }

    if (action === "status") {
      const { data } = await supabase
        .from("google_maps_config")
        .select("api_key, updated_at")
        .eq("id", 1)
        .maybeSingle();
      const key = (data?.api_key ?? "").trim();
      return json({
        tem_chave: !!key,
        sufixo: key ? key.slice(-4) : null,
        atualizado_em: data?.updated_at ?? null,
      });
    }

    if (action === "salvar") {
      const chave = String(body?.api_key ?? "").trim();
      if (chave.length < 20 || chave.length > 200 || /\s/.test(chave)) {
        return json({ error: "Chave inválida. Cole a chave completa da Places API (New)." }, 400);
      }
      const { error } = await supabase
        .from("google_maps_config")
        .upsert({ id: 1, api_key: chave, updated_by: user.id, updated_at: new Date().toISOString() });
      if (error) throw error;
      return json({ ok: true, tem_chave: true, sufixo: chave.slice(-4) });
    }

    if (action === "remover") {
      const { error } = await supabase
        .from("google_maps_config")
        .upsert({ id: 1, api_key: null, updated_by: user.id, updated_at: new Date().toISOString() });
      if (error) throw error;
      return json({ ok: true, tem_chave: false, sufixo: null });
    }

    if (action === "testar") {
      const chave = String(body?.api_key ?? "").trim() || (await lerChave());
      if (!chave) return json({ error: "Nenhuma chave configurada para testar." }, 400);

      const resp = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": chave,
          "X-Goog-FieldMask": "places.id",
        },
        body: JSON.stringify({
          textQuery: "pizzaria em Goiânia GO",
          languageCode: "pt-BR",
          regionCode: "BR",
          pageSize: 1,
        }),
      });

      if (!resp.ok) {
        const raw = await resp.text();
        const parsed = parseGooglePermissionError(resp.status, raw);
        console.error(`teste chave falhou [${resp.status}]: ${raw}`);
        return json(
          {
            ok: false,
            status: resp.status,
            reason: parsed?.reason ?? null,
            message: parsed?.message ?? `O Google recusou a chave (${resp.status}).`,
            details: raw.slice(0, 500),
          },
          200,
        );
      }
      await resp.json().catch(() => ({}));
      // Consome 1 chamada Places — contabiliza no uso mensal
      await supabase.rpc("gm_incrementar_uso", { qtd: 1 });
      return json({ ok: true, message: "Chave válida: a Places API (New) respondeu com sucesso." });
    }

    return json({ error: "Ação inválida" }, 400);
  } catch (err) {
    console.error("google-maps-chave erro:", err);
    return json({ error: String((err as any)?.message ?? err) }, 500);
  }
});

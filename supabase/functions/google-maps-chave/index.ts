import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { chavePodeBuscar, listarChavesGoogleMaps, mascararEmail } from "../_shared/google-maps-keys.ts";

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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function chaveValida(chave: string) {
  return chave.length >= 20 && chave.length <= 200 && !/\s/.test(chave);
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
    if (!isAdmin) return json({ error: "Sem permissão para o Google Maps Leads" }, 403);

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const action = String(body?.action ?? "status");

    const chaveId = String(body?.chave_id ?? "").trim();

    async function lerChave(id: string): Promise<string | null> {
      if (!id) return null;
      const { data, error } = await supabase.from("google_maps_api_keys").select("api_key").eq("id", id).maybeSingle();
      if (error) throw error;
      const chave = String(data?.api_key ?? "").trim();
      return chave || null;
    }

    if (action === "status") {
      const chaves = await listarChavesGoogleMaps(supabase);
      const disponivel = chaves.find(chavePodeBuscar);
      return json({
        chaves: chaves.map((chave) => ({
          id: chave.id,
          email_conta: chave.email_conta,
          email_mascarado: mascararEmail(chave.email_conta),
          sufixo: chave.api_key ? chave.api_key.slice(-4) : null,
          ordem_prioridade: chave.ordem_prioridade,
          ativa: chave.ativa,
          em_uso: chave.id === disponivel?.id,
          total_consultas: chave.total_consultas,
          limite_maximo: chave.limite_maximo,
          limite_bloqueio: chave.limite_bloqueio,
          indisponivel_mes: chave.indisponivel_mes,
          atualizado_em: chave.updated_at,
        })),
      });
    }

    if (action === "criar") {
      const chave = String(body?.api_key ?? "").trim();
      const email = String(body?.email_conta ?? "").trim().toLowerCase();
      if (!EMAIL_RE.test(email) || email.length > 254) {
        return json({ error: "Informe um e-mail válido da conta Google Cloud." }, 400);
      }
      if (!chaveValida(chave)) {
        return json({ error: "Chave inválida. Cole a chave completa da Places API (New)." }, 400);
      }
      const { data: ultima } = await supabase
        .from("google_maps_api_keys")
        .select("ordem_prioridade")
        .order("ordem_prioridade", { ascending: false })
        .limit(1)
        .maybeSingle();
      const { data: criada, error } = await supabase
        .from("google_maps_api_keys")
        .insert({
          email_conta: email,
          api_key: chave,
          ordem_prioridade: Number(ultima?.ordem_prioridade ?? 0) + 1,
          limite_maximo: 1000,
          limite_bloqueio: 950,
          created_by: user.id,
          updated_by: user.id,
        })
        .select("id")
        .single();
      if (error) throw error;
      return json({ ok: true, id: criada.id, sufixo: chave.slice(-4) });
    }

    if (action === "atualizar") {
      if (!chaveId) return json({ error: "Conta não informada." }, 400);
      const atualizacoes: Record<string, unknown> = { updated_by: user.id, updated_at: new Date().toISOString() };
      if (body?.email_conta !== undefined) {
        const email = String(body.email_conta).trim().toLowerCase();
        if (!EMAIL_RE.test(email) || email.length > 254) return json({ error: "Informe um e-mail válido da conta Google Cloud." }, 400);
        atualizacoes.email_conta = email;
      }
      if (body?.api_key !== undefined && String(body.api_key).trim()) {
        const chave = String(body.api_key).trim();
        if (!chaveValida(chave)) return json({ error: "Chave inválida. Cole a chave completa da Places API (New)." }, 400);
        atualizacoes.api_key = chave;
        atualizacoes.indisponivel_mes = null;
      }
      if (typeof body?.ativa === "boolean") atualizacoes.ativa = body.ativa;
      if (Number.isInteger(body?.ordem_prioridade) && body.ordem_prioridade > 0) atualizacoes.ordem_prioridade = body.ordem_prioridade;
      const { error } = await supabase.from("google_maps_api_keys").update(atualizacoes).eq("id", chaveId);
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === "remover") {
      if (!chaveId) return json({ error: "Conta não informada." }, 400);
      const { error } = await supabase
        .from("google_maps_api_keys")
        .update({ ativa: false, api_key: null, indisponivel_mes: null, updated_by: user.id, updated_at: new Date().toISOString() })
        .eq("id", chaveId);
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === "reordenar") {
      const ids = Array.isArray(body?.chave_ids) ? body.chave_ids.map((id: unknown) => String(id)) : [];
      const chaves = await listarChavesGoogleMaps(supabase);
      if (ids.length !== chaves.length || new Set(ids).size !== ids.length || chaves.some((chave) => !ids.includes(chave.id))) {
        return json({ error: "Ordem de contas inválida." }, 400);
      }
      for (let indice = 0; indice < ids.length; indice++) {
        const { error } = await supabase
          .from("google_maps_api_keys")
          .update({ ordem_prioridade: indice + 1, updated_by: user.id, updated_at: new Date().toISOString() })
          .eq("id", ids[indice]);
        if (error) throw error;
      }
      return json({ ok: true });
    }

    if (action === "testar") {
      const chaveInformada = String(body?.api_key ?? "").trim();
      if (chaveInformada && !chaveValida(chaveInformada)) return json({ error: "Chave inválida. Cole a chave completa da Places API (New)." }, 400);
      const chave = chaveInformada || (await lerChave(chaveId));
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
      if (chaveId) await supabase.rpc("gm_incrementar_uso_chave", { p_chave_id: chaveId, p_qtd: 1 });
      await supabase.rpc("gm_incrementar_uso", { qtd: 1 });
      return json({ ok: true, message: "Chave válida: a Places API (New) respondeu com sucesso." });
    }

    return json({ error: "Ação inválida" }, 400);
  } catch (err) {
    console.error("google-maps-chave erro:", err);
    return json({ error: String((err as any)?.message ?? err) }, 500);
  }
});

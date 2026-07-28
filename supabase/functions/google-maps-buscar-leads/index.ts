import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

interface Body {
  categoria: string;
  localizacao: string;
  raio_metros?: number;
  max_resultados?: number; // padrão 60 (3 páginas x 20)
}

function getEnvOrThrow(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Configuração ausente: ${name}`);
  return value;
}

function parseGooglePermissionError(status: number, rawBody: string) {
  if (status !== 403) return null;

  try {
    const parsed = JSON.parse(rawBody);
    const details: Array<{ reason?: string; metadata?: Record<string, string> }> = parsed?.error?.details ?? [];
    const info = details.find((item) => item.reason);
    const reason = info?.reason;
    const callerIp = info?.metadata?.callerIp;

    if (reason === "API_KEY_IP_ADDRESS_BLOCKED") {
      return {
        error: "google_maps_ip_restrito",
        message: callerIp
          ? `A chave do Google Maps está bloqueando o IP de saída ${callerIp}. Adicione esse IP nas restrições da chave do servidor no Google Cloud ou remova a restrição por IP.`
          : "A chave do Google Maps está com restrição de IP e bloqueou a chamada. Libere o IP informado pelo Google na chave do servidor ou remova a restrição por IP.",
        reason,
        callerIp,
      };
    }

    if (reason === "API_KEY_HTTP_REFERRER_BLOCKED") {
      return {
        error: "google_maps_chave_referrer_restrita",
        message:
          'A chave do servidor do Google Maps está restrita por HTTP referrer. Para chamadas de backend, altere as restrições de aplicativo para "Nenhuma" ou "Endereços IP".',
        reason,
      };
    }

    if (reason === "API_KEY_SERVICE_BLOCKED") {
      return {
        error: "google_maps_api_nao_permitida",
        message:
          "A chave do Google Maps não permite a Places API (New). Ative/libere a Places API (New) nas restrições de API da chave do servidor.",
        reason,
      };
    }
  } catch (_error) {
    return null;
  }

  return {
    error: "google_maps_permissao_negada",
    message: "O Google Maps negou a chamada (403). Verifique as restrições da chave do servidor.",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY");
    if (!LOVABLE_API_KEY || !GOOGLE_MAPS_API_KEY) {
      return new Response(JSON.stringify({ error: "Google Maps não configurado" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = getEnvOrThrow("SUPABASE_URL");
    const serviceRoleKey = getEnvOrThrow("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = getEnvOrThrow("SUPABASE_ANON_KEY");

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(
      supabaseUrl,
      anonKey,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // check admin
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Apenas admin" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as Body;
    const categoria = (body.categoria || "").trim();
    const localizacao = (body.localizacao || "").trim();
    if (!categoria || !localizacao) {
      return new Response(JSON.stringify({ error: "categoria e localizacao são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const maxRes = Math.min(Math.max(body.max_resultados ?? 60, 1), 60);

    // Guardrail: verificar limite mensal antes de qualquer chamada à Places API
    {
      const { data: st, error: stErr } = await supabase.rpc("gm_status_uso");
      if (stErr) throw stErr;
      const s = Array.isArray(st) ? st[0] : st;
      if (s && !s.pode_buscar) {
        const resetBr = new Date(s.data_reset).toLocaleDateString("pt-BR");
        return new Response(
          JSON.stringify({
            error: "limite_atingido",
            message: `Não foi possível realizar a busca. O limite mensal de consultas foi atingido (${s.total_consultas}/${s.limite_bloqueio}). O contador reinicia em ${resetBr}.`,
            consumo_atual: s.total_consultas,
            limite_bloqueio: s.limite_bloqueio,
            data_reset: s.data_reset,
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // Cria registro de busca
    const { data: busca, error: buscaErr } = await supabase
      .from("google_maps_buscas")
      .insert({
        user_id: user.id,
        categoria,
        localizacao,
        raio_metros: body.raio_metros ?? null,
        status: "processando",
      })
      .select()
      .single();
    if (buscaErr || !busca) throw buscaErr || new Error("Falha ao criar busca");

    const textQuery = `${categoria} em ${localizacao}`;
    const collected: any[] = [];
    let pageToken: string | undefined;
    let pages = 0;

    while (collected.length < maxRes && pages < 3) {
      const reqBody: any = {
        textQuery,
        languageCode: "pt-BR",
        regionCode: "BR",
        pageSize: 20,
      };
      if (pageToken) reqBody.pageToken = pageToken;

      const resp = await fetch(`${GATEWAY_URL}/places/v1/places:searchText`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": GOOGLE_MAPS_API_KEY,
          "Content-Type": "application/json",
          // Só cobramos o que precisamos: id/nome/telefone/endereco/local + avaliação básica
          "X-Goog-FieldMask":
            "places.id,places.displayName,places.nationalPhoneNumber,places.internationalPhoneNumber,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.websiteUri,places.primaryTypeDisplayName,nextPageToken",
        },
        body: JSON.stringify(reqBody),
      });

      if (!resp.ok) {
        const errBody = await resp.text();
        const permissionError = parseGooglePermissionError(resp.status, errBody);
        await supabase
          .from("google_maps_buscas")
          .update({ status: "erro", erro: `[${resp.status}] ${permissionError?.message ?? errBody}`.slice(0, 500) })
          .eq("id", busca.id);
        return new Response(
          JSON.stringify({
            error: "Falha no Google Maps",
            status: resp.status,
            details: errBody,
            ...(permissionError ?? {}),
          }),
          { status: resp.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const data = await resp.json();
      const places: any[] = data.places || [];
      collected.push(...places);
      pageToken = data.nextPageToken;
      pages++;

      // Incrementa contador de uso mensal (1 chamada Places consumida)
      const { data: novoTotal } = await supabase.rpc("gm_incrementar_uso", { qtd: 1 });
      // Se atingiu o bloqueio no meio da busca, interrompe paginação
      const { data: st2 } = await supabase.rpc("gm_status_uso");
      const s2 = Array.isArray(st2) ? st2[0] : st2;
      if (s2 && !s2.pode_buscar) {
        await supabase
          .from("google_maps_buscas")
          .update({ status: "parcial_limite" })
          .eq("id", busca.id);
        break;
      }

      if (!pageToken) break;
      // Google requires ~2s delay between pageToken requests
      await new Promise((r) => setTimeout(r, 2000));
    }

    const trimmed = collected.slice(0, maxRes);

    // Insere leads (todos, mesmo sem telefone — deixa filtro pro frontend)
    const rows = trimmed.map((p) => ({
      busca_id: busca.id,
      user_id: user.id,
      place_id: p.id ?? null,
      nome: p.displayName?.text ?? "Sem nome",
      telefone: p.nationalPhoneNumber ?? null,
      telefone_internacional: p.internationalPhoneNumber ?? null,
      endereco: p.formattedAddress ?? null,
      categoria: p.primaryTypeDisplayName?.text ?? null,
      site: p.websiteUri ?? null,
      avaliacao: p.rating ?? null,
      total_avaliacoes: p.userRatingCount ?? null,
      latitude: p.location?.latitude ?? null,
      longitude: p.location?.longitude ?? null,
    }));

    if (rows.length > 0) {
      const { error: insErr } = await supabase.from("google_maps_leads").insert(rows);
      if (insErr) throw insErr;
    }

    // Estimativa de custo: Text Search (Pro/Enterprise SKU c/ phone) ~ US$0.032 por resultado retornado
    const custo = +(trimmed.length * 0.032).toFixed(4);

    await supabase
      .from("google_maps_buscas")
      .update({
        status: "concluida",
        total_resultados: rows.length,
        custo_estimado_usd: custo,
      })
      .eq("id", busca.id);

    return new Response(
      JSON.stringify({
        busca_id: busca.id,
        total: rows.length,
        com_telefone: rows.filter((r) => r.telefone).length,
        custo_estimado_usd: custo,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("google-maps-buscar-leads erro:", err);
    return new Response(JSON.stringify({ error: String(err?.message ?? err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

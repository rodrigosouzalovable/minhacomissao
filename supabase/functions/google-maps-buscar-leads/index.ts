import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

interface Body {
  categoria: string;
  localizacao: string;
  raio_metros?: number;
  max_resultados?: number; // padrão 60 (3 páginas x 20)
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
        await supabase
          .from("google_maps_buscas")
          .update({ status: "erro", erro: `[${resp.status}] ${errBody}`.slice(0, 500) })
          .eq("id", busca.id);
        return new Response(
          JSON.stringify({ error: "Falha no Google Maps", status: resp.status, details: errBody }),
          { status: resp.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const data = await resp.json();
      const places: any[] = data.places || [];
      collected.push(...places);
      pageToken = data.nextPageToken;
      pages++;
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

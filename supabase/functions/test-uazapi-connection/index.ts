const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { server_url, instance_token } = await req.json();

    if (!server_url || !instance_token) {
      return new Response(JSON.stringify({ error: 'server_url e instance_token são obrigatórios' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const cleanUrl = server_url.replace(/\/+$/, '');

    // Try v2 endpoint first: /instance/status with token header
    const endpoints = [
      `${cleanUrl}/instance/status`,
      `${cleanUrl}/status`,
    ];

    let lastResponse = null;
    let lastData = null;

    for (const endpoint of endpoints) {
      try {
        console.log(`Tentando endpoint: ${endpoint}`);
        const response = await fetch(endpoint, {
          method: 'GET',
          headers: {
            'token': instance_token,
            'Content-Type': 'application/json',
          },
        });

        const text = await response.text();
        let parsed;
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = { raw: text };
        }

        console.log(`Resposta de ${endpoint}: status=${response.status}, data=${JSON.stringify(parsed)}`);

        if (response.ok) {
          return new Response(JSON.stringify({ ok: true, status: response.status, data: parsed, endpoint }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        lastResponse = response;
        lastData = parsed;
      } catch (e) {
        console.log(`Erro ao tentar ${endpoint}: ${e.message}`);
        lastData = { error: e.message };
      }
    }

    // Also try legacy format: /status/${token} in URL
    try {
      const legacyEndpoint = `${cleanUrl}/status/${instance_token}`;
      console.log(`Tentando endpoint legado: ${legacyEndpoint}`);
      const response = await fetch(legacyEndpoint);
      const text = await response.text();
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = { raw: text };
      }

      console.log(`Resposta legada: status=${response.status}, data=${JSON.stringify(parsed)}`);

      return new Response(JSON.stringify({ ok: response.ok, status: response.status, data: parsed, endpoint: legacyEndpoint }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (e) {
      console.log(`Erro no endpoint legado: ${e.message}`);
    }

    return new Response(JSON.stringify({ ok: false, status: lastResponse?.status || 0, data: lastData, error: 'Nenhum endpoint respondeu com sucesso' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

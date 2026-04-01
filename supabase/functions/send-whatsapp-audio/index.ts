const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { telefone, audio_url, uazapi_server_url, uazapi_instance_token } = await req.json();

    if (!telefone) throw new Error('Telefone não informado');
    if (!audio_url) throw new Error('URL do áudio não informada');

    const serverUrl = uazapi_server_url || Deno.env.get('UAZAPI_SERVER_URL');
    const instanceToken = uazapi_instance_token || Deno.env.get('UAZAPI_INSTANCE_TOKEN');

    if (!serverUrl || !instanceToken) {
      throw new Error('Credenciais UAZAPI não configuradas');
    }

    const telefoneFormatado = telefone.replace(/\D/g, '');
    const telefoneCompleto = telefoneFormatado.startsWith('55')
      ? telefoneFormatado
      : `55${telefoneFormatado}`;

    const cleanUrl = serverUrl.replace(/\/+$/, '');
    const endpoint = `${cleanUrl}/send/media`;
    const body = { number: telefoneCompleto, type: 'ptt', file: audio_url };

    console.log(`Enviando áudio para ${telefoneCompleto} via ${endpoint}`);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', token: instanceToken },
      body: JSON.stringify(body),
    });

    const rawText = await response.text();
    let data: any;
    try { data = JSON.parse(rawText); } catch { data = { message: rawText }; }

    console.log(`Resposta (${response.status}):`, JSON.stringify(data));

    if (!response.ok) {
      throw new Error(data?.message || data?.error || `HTTP ${response.status}`);
    }

    return new Response(JSON.stringify({ success: true, data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Erro send-whatsapp-audio:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

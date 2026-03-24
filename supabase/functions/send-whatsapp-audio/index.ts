import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
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

    // Try multiple UAZAPI endpoints for sending audio
    const endpoints = [
      { url: `${cleanUrl}/message/sendAudio`, body: { number: telefoneCompleto, audioUrl: audio_url, ptt: true } },
      { url: `${cleanUrl}/sendAudio`, body: { number: telefoneCompleto, audioUrl: audio_url, ptt: true } },
      { url: `${cleanUrl}/send/audio`, body: { number: telefoneCompleto, url: audio_url, ptt: true } },
    ];

    let lastError = null;
    for (const ep of endpoints) {
      console.log(`Tentando endpoint: ${ep.url}`);
      try {
        const response = await fetch(ep.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': instanceToken },
          body: JSON.stringify(ep.body),
        });
        const data = await response.json();
        console.log(`Resposta de ${ep.url}:`, JSON.stringify(data));
        if (response.ok) {
          return new Response(JSON.stringify({ success: true, data }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        lastError = data;
      } catch (err) {
        lastError = err;
        console.log(`Endpoint ${ep.url} falhou:`, err);
      }
    }

    throw new Error(lastError?.message || lastError?.error || 'Nenhum endpoint UAZAPI de áudio funcionou');
  } catch (error) {
    console.error('Erro na função send-whatsapp-audio:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

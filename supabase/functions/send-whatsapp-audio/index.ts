import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

type AudioAsset = {
  bytes: Uint8Array;
  contentType: string;
  fileName: string;
};

const inferFileName = (audioUrl: string, contentType: string) => {
  try {
    const pathname = new URL(audioUrl).pathname;
    const nameFromUrl = pathname.split('/').pop();
    if (nameFromUrl && nameFromUrl.includes('.')) return nameFromUrl;
  } catch {
    // ignore URL parsing errors and fall back below
  }

  const extensionMap: Record<string, string> = {
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/mp4': 'm4a',
    'audio/x-m4a': 'm4a',
    'audio/aac': 'aac',
    'audio/ogg': 'ogg',
    'audio/wav': 'wav',
    'audio/webm': 'webm',
  };

  const extension = extensionMap[contentType] || 'ogg';
  return `audio.${extension}`;
};

const parseResponseBody = async (response: Response) => {
  const rawText = await response.text();
  try {
    return JSON.parse(rawText);
  } catch {
    return { message: rawText };
  }
};

const downloadAudioFile = async (audioUrl: string): Promise<AudioAsset> => {
  const response = await fetch(audioUrl);

  if (!response.ok) {
    throw new Error(`Não foi possível baixar o áudio (${response.status})`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const contentType = response.headers.get('content-type') || 'audio/ogg';
  const fileName = inferFileName(audioUrl, contentType);

  return {
    bytes: new Uint8Array(arrayBuffer),
    contentType,
    fileName,
  };
};

const buildFormData = (telefone: string, audio: AudioAsset, mediatype?: string) => {
  const formData = new FormData();
  formData.append('number', telefone);
  formData.append('file', new Blob([audio.bytes], { type: audio.contentType }), audio.fileName);

  if (mediatype) {
    formData.append('mediatype', mediatype);
  }

  return formData;
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

    // Try JSON-based endpoints first (send URL directly), then FormData fallback
    const jsonEndpoints = [
      { url: `${cleanUrl}/send/audio`, body: { number: telefoneCompleto, audio: audio_url, mediatype: 'ptt' } },
      { url: `${cleanUrl}/message/sendMedia`, body: { number: telefoneCompleto, mediaUrl: audio_url, mediatype: 'ptt', caption: '' } },
      { url: `${cleanUrl}/send/media`, body: { number: telefoneCompleto, url: audio_url, mediatype: 'ptt' } },
    ];

    let lastError: any = null;

    // Attempt JSON-based endpoints
    for (const endpoint of jsonEndpoints) {
      console.log(`Tentando endpoint JSON: ${endpoint.url}`);
      try {
        const response = await fetch(endpoint.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', token: instanceToken },
          body: JSON.stringify(endpoint.body),
        });

        const data = await parseResponseBody(response);
        console.log(`Resposta de ${endpoint.url}:`, JSON.stringify(data));

        if (response.ok && !data?.error) {
          return new Response(JSON.stringify({ success: true, data }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        lastError = data;
      } catch (err) {
        lastError = err;
        console.log(`Endpoint ${endpoint.url} falhou:`, err);
      }
    }

    // FormData fallback: download audio and upload
    console.log('Tentando fallback com FormData...');
    const audioFile = await downloadAudioFile(audio_url);
    const formEndpoints = [
      { url: `${cleanUrl}/send/media`, mediatype: 'ptt' },
      { url: `${cleanUrl}/send/media`, mediatype: 'audio' },
    ];

    for (const endpoint of formEndpoints) {
      console.log(`Tentando endpoint FormData: ${endpoint.url} (${endpoint.mediatype})`);
      try {
        const response = await fetch(endpoint.url, {
          method: 'POST',
          headers: { token: instanceToken },
          body: buildFormData(telefoneCompleto, audioFile, endpoint.mediatype),
        });

        const data = await parseResponseBody(response);
        console.log(`Resposta de ${endpoint.url}:`, JSON.stringify(data));

        if (response.ok && !data?.error) {
          return new Response(JSON.stringify({ success: true, data }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        lastError = data;
      } catch (err) {
        lastError = err;
        console.log(`Endpoint ${endpoint.url} falhou:`, err);
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
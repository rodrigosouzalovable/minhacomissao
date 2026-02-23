import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { cpf, nome, credor, totalDebitos } = await req.json();

    console.log('Notificação de consulta CPF:', { cpf, nome, credor, totalDebitos });

    const instanceId = Deno.env.get('ZAPI_INSTANCE_ID');
    const token = Deno.env.get('ZAPI_TOKEN');
    const clientToken = Deno.env.get('ZAPI_CLIENT_TOKEN');

    if (!instanceId || !token || !clientToken) {
      throw new Error('Credenciais Z-API não configuradas');
    }

    // Formatar CPF
    const cpfLimpo = (cpf || '').replace(/\D/g, '');
    const cpfFormatado = cpfLimpo.length === 11
      ? `${cpfLimpo.slice(0, 3)}.${cpfLimpo.slice(3, 6)}.${cpfLimpo.slice(6, 9)}-${cpfLimpo.slice(9)}`
      : cpf;

    // Data/hora no fuso de Brasília
    const agora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    const mensagem = `📋 *CONSULTA NO PORTAL*

📌 *CPF:* ${cpfFormatado}
👤 *Nome:* ${nome || 'Não identificado'}
🏢 *Credor:* ${credor || 'N/A'}
📊 *Débitos encontrados:* ${totalDebitos ?? 0}
🕐 *Data/Hora:* ${agora}

_Portal de Acordos - Souza e Ribeiro_`;

    const telefoneAdmin = '5562991672674';

    const zapiUrl = `https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`;

    const response = await fetch(zapiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': clientToken,
      },
      body: JSON.stringify({
        phone: telefoneAdmin,
        message: mensagem,
      }),
    });

    const data = await response.json();
    console.log('Resposta Z-API:', data);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Erro notify-cpf-consulta:', error);
    return new Response(JSON.stringify({ success: false, error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

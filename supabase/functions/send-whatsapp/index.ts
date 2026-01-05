import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { telefone, mensagem } = await req.json();
    
    console.log('Recebendo requisição para enviar WhatsApp:', { telefone });

    if (!telefone) {
      throw new Error('Telefone não informado');
    }

    // Formatar telefone (remover caracteres especiais, adicionar código do país)
    const telefoneFormatado = telefone.replace(/\D/g, '');
    const telefoneCompleto = telefoneFormatado.startsWith('55') 
      ? telefoneFormatado 
      : `55${telefoneFormatado}`;

    console.log('Telefone formatado:', telefoneCompleto);

    const instanceId = Deno.env.get('ZAPI_INSTANCE_ID');
    const token = Deno.env.get('ZAPI_TOKEN');
    const clientToken = Deno.env.get('ZAPI_CLIENT_TOKEN');

    if (!instanceId || !token || !clientToken) {
      console.error('Credenciais Z-API não configuradas');
      throw new Error('Credenciais Z-API não configuradas');
    }

    const zapiUrl = `https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`;
    
    console.log('Enviando mensagem para Z-API...');

    const response = await fetch(zapiUrl, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Client-Token': clientToken
      },
      body: JSON.stringify({
        phone: telefoneCompleto,
        message: mensagem
      })
    });

    const data = await response.json();
    
    console.log('Resposta da Z-API:', data);

    if (!response.ok) {
      throw new Error(data.message || 'Erro ao enviar mensagem via Z-API');
    }

    return new Response(JSON.stringify({ success: true, data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Erro na função send-whatsapp:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

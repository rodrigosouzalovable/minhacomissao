import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function sendViaUazapi(serverUrl: string, instanceToken: string, telefone: string, mensagem: string) {
  const cleanUrl = serverUrl.replace(/\/+$/, '');
  const endpoints = [
    `${cleanUrl}/message/sendText`,
    `${cleanUrl}/sendText`,
    `${cleanUrl}/send/text`,
  ];

  let lastError = null;
  for (const url of endpoints) {
    console.log(`Tentando endpoint: ${url}`);
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'token': instanceToken },
      body: JSON.stringify({ number: telefone, text: mensagem }),
    });
    const data = await response.json();
    console.log(`Resposta de ${url}:`, JSON.stringify(data));
    if (response.ok) return data;
    lastError = data;
    console.log(`Endpoint ${url} falhou com status ${response.status}`);
  }
  throw new Error(lastError?.message || lastError?.error || 'Nenhum endpoint UAZAPI funcionou');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { telefone, mensagem, uazapi_server_url, uazapi_instance_token, instancia_id } = await req.json();
    
    const tokenSuffix = uazapi_instance_token ? uazapi_instance_token.slice(-8) : 'global';
    console.log('Recebendo requisição para enviar WhatsApp:', { telefone, instance: tokenSuffix });

    if (!telefone) throw new Error('Telefone não informado');

    const telefoneFormatado = telefone.replace(/\D/g, '');
    const telefoneCompleto = telefoneFormatado.startsWith('55') 
      ? telefoneFormatado 
      : `55${telefoneFormatado}`;

    console.log('Telefone formatado:', telefoneCompleto);

    // Use provided credentials or fall back to global UAZAPI secrets
    const serverUrl = uazapi_server_url || Deno.env.get('UAZAPI_SERVER_URL');
    const instanceToken = uazapi_instance_token || Deno.env.get('UAZAPI_INSTANCE_TOKEN');

    if (!serverUrl || !instanceToken) {
      throw new Error('Credenciais UAZAPI não configuradas');
    }

    const data = await sendViaUazapi(serverUrl, instanceToken, telefoneCompleto, mensagem);

    // --- INBOX: Salvar mensagem enviada no histórico ---
    if (instancia_id) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);
        const agora = new Date().toISOString();

        await supabase.from('whatsapp_mensagens').insert({
          instancia_id,
          telefone_remoto: telefoneCompleto,
          conteudo: mensagem,
          direcao: 'saida',
          timestamp_msg: agora,
          lida: true,
        });

        // UPSERT contact
        const { data: existingContact } = await supabase
          .from('whatsapp_contatos')
          .select('id')
          .eq('instancia_id', instancia_id)
          .eq('telefone', telefoneCompleto)
          .maybeSingle();

        if (existingContact) {
          await supabase.from('whatsapp_contatos').update({
            ultima_mensagem: mensagem.slice(0, 200),
            ultima_mensagem_em: agora,
          }).eq('id', existingContact.id);
        } else {
          await supabase.from('whatsapp_contatos').insert({
            instancia_id,
            telefone: telefoneCompleto,
            ultima_mensagem: mensagem.slice(0, 200),
            ultima_mensagem_em: agora,
            nao_lido: 0,
          });
        }

        console.log(`[INBOX] Mensagem de saída salva para ${telefoneCompleto}`);
      } catch (inboxErr) {
        console.error('[INBOX] Erro ao salvar msg de saída:', inboxErr);
      }
    }

    return new Response(JSON.stringify({ success: true, data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Erro na função send-whatsapp:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

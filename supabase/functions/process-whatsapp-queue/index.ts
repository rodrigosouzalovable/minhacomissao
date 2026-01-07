import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Processando fila de WhatsApp...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verificar se está dentro do horário comercial (8h-18h Brasília)
    const agora = new Date();
    const horaAtualUTC = agora.getUTCHours();
    const horaAtualBrasilia = (horaAtualUTC - 3 + 24) % 24;

    if (horaAtualBrasilia < 8 || horaAtualBrasilia >= 18) {
      console.log(`Fora do horário comercial (${horaAtualBrasilia}h Brasília), pulando...`);
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Fora do horário comercial',
        enviado: false
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Buscar a próxima mensagem pendente que já pode ser enviada
    const { data: mensagensPendentes, error: buscaError } = await supabase
      .from('whatsapp_fila')
      .select('*')
      .eq('status', 'pendente')
      .lte('agendado_para', agora.toISOString())
      .order('agendado_para', { ascending: true })
      .limit(1);

    if (buscaError) {
      console.error('Erro ao buscar mensagens pendentes:', buscaError);
      throw buscaError;
    }

    if (!mensagensPendentes || mensagensPendentes.length === 0) {
      console.log('Nenhuma mensagem pendente para enviar');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Nenhuma mensagem pendente',
        enviado: false
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const mensagem = mensagensPendentes[0];
    console.log(`Processando mensagem ${mensagem.id} para ${mensagem.telefone}...`);

    // Enviar via Z-API
    try {
      const instanceId = Deno.env.get('ZAPI_INSTANCE_ID');
      const token = Deno.env.get('ZAPI_TOKEN');
      const clientToken = Deno.env.get('ZAPI_CLIENT_TOKEN');

      if (!instanceId || !token || !clientToken) {
        throw new Error('Credenciais Z-API não configuradas');
      }

      const zapiUrl = `https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`;

      const response = await fetch(zapiUrl, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Client-Token': clientToken
        },
        body: JSON.stringify({
          phone: mensagem.telefone,
          message: mensagem.mensagem
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Erro ao enviar mensagem via Z-API');
      }

      // Atualizar status para enviado
      await supabase
        .from('whatsapp_fila')
        .update({
          status: 'enviado',
          enviado_em: new Date().toISOString()
        })
        .eq('id', mensagem.id);

      // Registrar no log
      await supabase
        .from('whatsapp_lembretes_log')
        .insert({
          pagamento_id: mensagem.pagamento_id,
          tipo_lembrete: mensagem.tipo_lembrete,
          sucesso: true
        });

      console.log(`Mensagem ${mensagem.id} enviada com sucesso!`);

      return new Response(JSON.stringify({ 
        success: true, 
        enviado: true,
        mensagem_id: mensagem.id
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (sendError) {
      console.error(`Erro ao enviar mensagem ${mensagem.id}:`, sendError);
      
      const erroMsg = sendError instanceof Error ? sendError.message : 'Erro desconhecido';

      // Atualizar status para erro
      await supabase
        .from('whatsapp_fila')
        .update({
          status: 'erro',
          erro_mensagem: erroMsg
        })
        .eq('id', mensagem.id);

      // Registrar erro no log
      await supabase
        .from('whatsapp_lembretes_log')
        .insert({
          pagamento_id: mensagem.pagamento_id,
          tipo_lembrete: mensagem.tipo_lembrete,
          sucesso: false,
          erro_mensagem: erroMsg
        });

      return new Response(JSON.stringify({ 
        success: false, 
        error: erroMsg,
        mensagem_id: mensagem.id
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    console.error('Erro na função process-whatsapp-queue:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

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
    console.log('Iniciando verificação de lembretes de pagamento...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Buscar data atual e data de 5 dias no futuro
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const hojeStr = hoje.toISOString().split('T')[0];
    
    const cincoDias = new Date(hoje);
    cincoDias.setDate(cincoDias.getDate() + 5);
    const cincoDiasStr = cincoDias.toISOString().split('T')[0];

    console.log(`Verificando parcelas para hoje (${hojeStr}) e 5 dias (${cincoDiasStr})`);

    // Buscar parcelas pendentes que vencem hoje ou em 5 dias
    const { data: parcelas, error: parcelasError } = await supabase
      .from('pagamentos')
      .select(`
        id,
        numero_parcela,
        data_prevista,
        valor_parcela,
        acordo_id,
        acordos!inner (
          id,
          user_id,
          cliente_nome,
          cliente_telefone,
          status
        )
      `)
      .eq('status', 'pendente')
      .in('data_prevista', [hojeStr, cincoDiasStr]);

    if (parcelasError) {
      console.error('Erro ao buscar parcelas:', parcelasError);
      throw parcelasError;
    }

    console.log(`Encontradas ${parcelas?.length || 0} parcelas para verificar`);

    if (!parcelas || parcelas.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Nenhuma parcela para notificar',
        enviados: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let enviados = 0;
    let erros = 0;

    for (const parcela of parcelas) {
      const acordo = parcela.acordos as any;
      
      // Verificar se o acordo está ativo
      if (acordo.status !== 'ativo') {
        console.log(`Acordo ${acordo.id} não está ativo, pulando...`);
        continue;
      }

      // Verificar se tem telefone cadastrado
      if (!acordo.cliente_telefone) {
        console.log(`Acordo ${acordo.id} sem telefone, pulando...`);
        continue;
      }

      // Verificar se o usuário tem WhatsApp habilitado
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('whatsapp_lembretes_habilitado')
        .eq('id', acordo.user_id)
        .single();

      if (profileError || !profile?.whatsapp_lembretes_habilitado) {
        console.log(`Usuário ${acordo.user_id} não tem WhatsApp habilitado, pulando...`);
        continue;
      }

      // Verificar se o acordo tem pelo menos uma parcela paga
      const { data: parcelasPagas, error: parcelasPagasError } = await supabase
        .from('pagamentos')
        .select('id')
        .eq('acordo_id', acordo.id)
        .eq('status', 'pago')
        .limit(1);

      if (parcelasPagasError || !parcelasPagas || parcelasPagas.length === 0) {
        console.log(`Acordo ${acordo.id} sem parcelas pagas, pulando...`);
        continue;
      }

      // Determinar tipo de lembrete
      const tipoLembrete = parcela.data_prevista === hojeStr ? 'dia_vencimento' : '5_dias';

      // Verificar se já foi enviado
      const { data: logExistente, error: logError } = await supabase
        .from('whatsapp_lembretes_log')
        .select('id')
        .eq('pagamento_id', parcela.id)
        .eq('tipo_lembrete', tipoLembrete)
        .single();

      if (logExistente) {
        console.log(`Lembrete ${tipoLembrete} já enviado para parcela ${parcela.id}, pulando...`);
        continue;
      }

      // Formatar valor
      const valorFormatado = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).format(parcela.valor_parcela);

      // Formatar data
      const dataVencimento = new Date(parcela.data_prevista + 'T12:00:00');
      const dataFormatada = dataVencimento.toLocaleDateString('pt-BR');

      // Montar mensagem
      let mensagem: string;
      if (tipoLembrete === 'dia_vencimento') {
        mensagem = `Olá ${acordo.cliente_nome} tudo bem? Meu nome é Rodrigo, sou do departamento de acordos das Lojas Novo Mundo e estou passando para lembrar que o vencimento da sua parcela no de valor ${valorFormatado} vence *HOJE*. Gostaria que enviasse o boleto para pagamento?`;
      } else {
        mensagem = `Olá ${acordo.cliente_nome} tudo bem? Meu nome é Rodrigo, sou do departamento de acordos das Lojas Novo Mundo e estou passando para lembrar que o vencimento da sua parcela no valor de ${valorFormatado} vence dia ${dataFormatada}. Gostaria que enviasse o boleto para pagamento?`;
      }

      console.log(`Enviando lembrete ${tipoLembrete} para ${acordo.cliente_telefone}...`);

      // Enviar WhatsApp
      try {
        const instanceId = Deno.env.get('ZAPI_INSTANCE_ID');
        const token = Deno.env.get('ZAPI_TOKEN');
        const clientToken = Deno.env.get('ZAPI_CLIENT_TOKEN');

        if (!instanceId || !token || !clientToken) {
          throw new Error('Credenciais Z-API não configuradas');
        }

        // Formatar telefone
        const telefoneFormatado = acordo.cliente_telefone.replace(/\D/g, '');
        const telefoneCompleto = telefoneFormatado.startsWith('55') 
          ? telefoneFormatado 
          : `55${telefoneFormatado}`;

        const zapiUrl = `https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`;

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

        if (!response.ok) {
          throw new Error(data.message || 'Erro ao enviar mensagem via Z-API');
        }

        // Registrar sucesso no log
        await supabase
          .from('whatsapp_lembretes_log')
          .insert({
            pagamento_id: parcela.id,
            tipo_lembrete: tipoLembrete,
            sucesso: true
          });

        enviados++;
        console.log(`Lembrete enviado com sucesso para parcela ${parcela.id}`);

      } catch (sendError) {
        console.error(`Erro ao enviar lembrete para parcela ${parcela.id}:`, sendError);
        
        // Registrar erro no log
        await supabase
          .from('whatsapp_lembretes_log')
          .insert({
            pagamento_id: parcela.id,
            tipo_lembrete: tipoLembrete,
            sucesso: false,
            erro_mensagem: sendError instanceof Error ? sendError.message : 'Erro desconhecido'
          });

        erros++;
      }
    }

    console.log(`Processamento concluído: ${enviados} enviados, ${erros} erros`);

    return new Response(JSON.stringify({ 
      success: true, 
      enviados,
      erros,
      total: parcelas.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Erro na função check-payment-reminders:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

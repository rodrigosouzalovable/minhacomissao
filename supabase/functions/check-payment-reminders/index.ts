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

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const hojeStr = hoje.toISOString().split('T')[0];
    
    const tresDias = new Date(hoje);
    tresDias.setDate(tresDias.getDate() + 3);
    const tresDiasStr = tresDias.toISOString().split('T')[0];

    console.log(`Verificando parcelas para hoje (${hojeStr}) e 3 dias (${tresDiasStr})`);

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
      .in('data_prevista', [hojeStr, tresDiasStr]);

    if (parcelasError) {
      console.error('Erro ao buscar parcelas:', parcelasError);
      throw parcelasError;
    }

    console.log(`Encontradas ${parcelas?.length || 0} parcelas para verificar`);

    if (!parcelas || parcelas.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Nenhuma parcela para notificar',
        agendados: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Calcular horário base para agendamento (8h de Brasília = 11h UTC)
    const agora = new Date();
    const horaAtualUTC = agora.getUTCHours();
    const horaAtualBrasilia = (horaAtualUTC - 3 + 24) % 24;
    
    let proximoHorario: Date;
    
    if (horaAtualBrasilia >= 18 || horaAtualBrasilia < 8) {
      proximoHorario = new Date(agora);
      if (horaAtualBrasilia >= 18) {
        proximoHorario.setUTCDate(proximoHorario.getUTCDate() + 1);
      }
      proximoHorario.setUTCHours(11, 0, 0, 0);
    } else {
      proximoHorario = new Date(agora);
    }

    let agendados = 0;
    let pulados = 0;

    for (const parcela of parcelas) {
      const acordo = parcela.acordos as any;
      
      if (acordo.status !== 'ativo') {
        console.log(`Acordo ${acordo.id} não está ativo, pulando...`);
        pulados++;
        continue;
      }

      if (!acordo.cliente_telefone) {
        console.log(`Acordo ${acordo.id} sem telefone, pulando...`);
        pulados++;
        continue;
      }

      // Buscar perfil do usuário
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('nome, whatsapp_lembretes_habilitado, whatsapp_lembrete_server_url, whatsapp_lembrete_instance_token')
        .eq('id', acordo.user_id)
        .single();

      if (profileError || !profile?.whatsapp_lembretes_habilitado) {
        console.log(`Usuário ${acordo.user_id} não tem WhatsApp habilitado, pulando...`);
        pulados++;
        continue;
      }

      // Priorizar instância marcada como "apenas_lembretes" na tabela user_whatsapp_instances
      const { data: lembretesInstance } = await supabase
        .from('user_whatsapp_instances')
        .select('server_url, instance_token')
        .eq('user_id', acordo.user_id)
        .eq('apenas_lembretes', true)
        .eq('ativo', true)
        .limit(1)
        .single();

      const finalServerUrl = lembretesInstance?.server_url || profile.whatsapp_lembrete_server_url || null;
      const finalInstanceToken = lembretesInstance?.instance_token || profile.whatsapp_lembrete_instance_token || null;

      // Verificar se o acordo tem pelo menos uma parcela paga
      const { data: parcelasPagas } = await supabase
        .from('pagamentos')
        .select('id')
        .eq('acordo_id', acordo.id)
        .eq('status', 'pago')
        .limit(1);

      if (!parcelasPagas || parcelasPagas.length === 0) {
        console.log(`Acordo ${acordo.id} sem parcelas pagas, pulando...`);
        pulados++;
        continue;
      }

      const tipoLembrete = parcela.data_prevista === hojeStr ? 'dia_vencimento' : '3_dias';

      // Verificar duplicidade na fila
      const { data: filaExistente } = await supabase
        .from('whatsapp_fila')
        .select('id')
        .eq('pagamento_id', parcela.id)
        .eq('tipo_lembrete', tipoLembrete)
        .single();

      if (filaExistente) {
        pulados++;
        continue;
      }

      // Verificar duplicidade no log
      const { data: logExistente } = await supabase
        .from('whatsapp_lembretes_log')
        .select('id')
        .eq('pagamento_id', parcela.id)
        .eq('tipo_lembrete', tipoLembrete)
        .single();

      if (logExistente) {
        pulados++;
        continue;
      }

      const valorFormatado = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).format(parcela.valor_parcela);

      const dataVencimento = new Date(parcela.data_prevista + 'T12:00:00');
      const dataFormatada = dataVencimento.toLocaleDateString('pt-BR');

      const primeiroNome = (profile.nome || 'Rodrigo').split(' ')[0];

      let mensagem: string;
      if (tipoLembrete === 'dia_vencimento') {
        mensagem = `Olá ${acordo.cliente_nome} tudo bem? Meu nome é ${primeiroNome}, sou do departamento de acordos das Lojas Novo Mundo e estou passando para lembrar que o vencimento da sua parcela no de valor ${valorFormatado} vence HOJE. Gostaria que enviasse o boleto para pagamento?`;
      } else {
        mensagem = `Olá ${acordo.cliente_nome} tudo bem? Meu nome é ${primeiroNome}, sou do departamento de acordos das Lojas Novo Mundo e estou passando para lembrar que o vencimento da sua parcela no de valor ${valorFormatado} vence é dia ${dataFormatada}. Gostaria que enviasse o boleto para pagamento?`;
      }

      const telefoneFormatado = acordo.cliente_telefone.replace(/\D/g, '');
      const telefoneCompleto = telefoneFormatado.startsWith('55') 
        ? telefoneFormatado 
        : `55${telefoneFormatado}`;

      // Verificar horário agendado
      const horaAgendadaUTC = proximoHorario.getUTCHours();
      const horaAgendadaBrasilia = (horaAgendadaUTC - 3 + 24) % 24;
      
      if (horaAgendadaBrasilia >= 18) {
        proximoHorario.setUTCDate(proximoHorario.getUTCDate() + 1);
        proximoHorario.setUTCHours(11, 0, 0, 0);
      }

      // Inserir na fila com credenciais do usuário (ou null para fallback global)
      const { error: insertError } = await supabase
        .from('whatsapp_fila')
        .insert({
          pagamento_id: parcela.id,
          tipo_lembrete: tipoLembrete,
          telefone: telefoneCompleto,
          mensagem: mensagem,
          agendado_para: proximoHorario.toISOString(),
          status: 'pendente',
          server_url: profile.whatsapp_lembrete_server_url || null,
          instance_token: profile.whatsapp_lembrete_instance_token || null,
        });

      if (insertError) {
        console.error(`Erro ao inserir na fila parcela ${parcela.id}:`, insertError);
        continue;
      }

      console.log(`Mensagem agendada para ${proximoHorario.toISOString()} - Parcela ${parcela.id} (instância: ${profile.whatsapp_lembrete_server_url ? 'per-user' : 'global'})`);
      agendados++;

      const intervaloMs = (Math.floor(Math.random() * 3) + 5) * 60 * 1000; // 5, 6 ou 7 min
      proximoHorario = new Date(proximoHorario.getTime() + intervaloMs);
    }

    console.log(`Processamento concluído: ${agendados} agendados, ${pulados} pulados`);

    return new Response(JSON.stringify({ 
      success: true, 
      agendados,
      pulados,
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

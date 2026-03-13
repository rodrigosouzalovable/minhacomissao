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

    // Parse optional override from request body
    let overrideToken: string | null = null;
    let overrideServerUrl: string | null = null;
    try {
      const body = await req.json();
      if (body?.instance_token) overrideToken = body.instance_token;
      if (body?.server_url) overrideServerUrl = body.server_url;
      console.log(`Override recebido: token=${overrideToken ? 'sim' : 'não'}, server_url=${overrideServerUrl ? 'sim' : 'não'}`);
    } catch { /* no body */ }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const hojeStr = hoje.toISOString().split('T')[0];
    
    const tresDias = new Date(hoje);
    tresDias.setDate(tresDias.getDate() + 3);
    const tresDiasStr = tresDias.toISOString().split('T')[0];

    // Cadência de vencidas: D+1, D+2, D+10, D+11, D+20, D+30
    const vencidosDias = [1, 2, 10, 11, 20, 30];
    const vencidosDatas: { dias: number; dataStr: string; tipo: string }[] = vencidosDias.map(d => {
      const dt = new Date(hoje);
      dt.setDate(dt.getDate() - d);
      return { dias: d, dataStr: dt.toISOString().split('T')[0], tipo: `vencido_d${d}` };
    });

    const todasDatasVencidas = vencidosDatas.map(v => v.dataStr);
    console.log(`Verificando parcelas: hoje (${hojeStr}), 3 dias (${tresDiasStr}), vencidas em [${todasDatasVencidas.join(', ')}]`);

    // Query 1: Parcelas de hoje e 3 dias
    const { data: parcelasProximas, error: proximasError } = await supabase
      .from('pagamentos')
      .select(`
        id, numero_parcela, data_prevista, valor_parcela, acordo_id,
        acordos!inner ( id, user_id, cliente_nome, cliente_telefone, status )
      `)
      .eq('status', 'pendente')
      .in('data_prevista', [hojeStr, tresDiasStr]);

    if (proximasError) {
      console.error('Erro ao buscar parcelas próximas:', proximasError);
      throw proximasError;
    }

    // Query 2: Parcelas vencidas nas datas específicas da cadência
    const { data: parcelasVencidas, error: vencidasError } = await supabase
      .from('pagamentos')
      .select(`
        id, numero_parcela, data_prevista, valor_parcela, acordo_id,
        acordos!inner ( id, user_id, cliente_nome, cliente_telefone, status )
      `)
      .eq('status', 'pendente')
      .in('data_prevista', todasDatasVencidas);

    if (vencidasError) {
      console.error('Erro ao buscar parcelas vencidas:', vencidasError);
      throw vencidasError;
    }

    // Mapa data → tipo de lembrete
    const dataToTipo = new Map(vencidosDatas.map(v => [v.dataStr, v.tipo]));

    // Combinar todas as parcelas com seus tipos
    const todasParcelas: Array<{ parcela: any; tipoLembrete: string }> = [];

    for (const p of (parcelasProximas || [])) {
      const tipo = p.data_prevista === hojeStr ? 'dia_vencimento' : '3_dias';
      todasParcelas.push({ parcela: p, tipoLembrete: tipo });
    }
    for (const p of (parcelasVencidas || [])) {
      const tipo = dataToTipo.get(p.data_prevista) || 'vencido';
      todasParcelas.push({ parcela: p, tipoLembrete: tipo });
    }

    console.log(`Total: ${todasParcelas.length} parcelas (${parcelasProximas?.length || 0} próximas + ${parcelasVencidas?.length || 0} vencidas)`);

    if (todasParcelas.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, message: 'Nenhuma parcela para notificar', agendados: 0
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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

    for (const { parcela, tipoLembrete } of todasParcelas) {
      const acordo = parcela.acordos as any;
      
      if (acordo.status !== 'ativo') { pulados++; continue; }
      if (!acordo.cliente_telefone) { pulados++; continue; }

      // Buscar perfil do usuário
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('nome, whatsapp_lembretes_habilitado, whatsapp_lembrete_server_url, whatsapp_lembrete_instance_token')
        .eq('id', acordo.user_id)
        .single();

      if (profileError || !profile?.whatsapp_lembretes_habilitado) { pulados++; continue; }

      // Priorizar instância "apenas_lembretes"
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

      if (!parcelasPagas || parcelasPagas.length === 0) { pulados++; continue; }

      // Verificar duplicidade na fila
      const { data: filaExistente } = await supabase
        .from('whatsapp_fila')
        .select('id')
        .eq('pagamento_id', parcela.id)
        .eq('tipo_lembrete', tipoLembrete)
        .single();

      if (filaExistente) { pulados++; continue; }

      // Verificar duplicidade no log
      const { data: logExistente } = await supabase
        .from('whatsapp_lembretes_log')
        .select('id')
        .eq('pagamento_id', parcela.id)
        .eq('tipo_lembrete', tipoLembrete)
        .single();

      if (logExistente) { pulados++; continue; }

      const valorFormatado = new Intl.NumberFormat('pt-BR', {
        style: 'currency', currency: 'BRL'
      }).format(parcela.valor_parcela);

      const dataVencimento = new Date(parcela.data_prevista + 'T12:00:00');
      const dataFormatada = dataVencimento.toLocaleDateString('pt-BR');
      const primeiroNome = (profile.nome || 'Rodrigo').split(' ')[0];

      let mensagem: string;
      if (tipoLembrete === 'vencido_d1') {
        mensagem = `Olá ${acordo.cliente_nome}, aqui é ${primeiroNome}, do departamento de acordos das Lojas Novo Mundo. Sua parcela no valor de ${valorFormatado} venceu ontem (${dataFormatada}). Caso já tenha realizado o pagamento, poderia nos enviar o comprovante por gentileza?`;
      } else if (tipoLembrete === 'vencido_d2') {
        mensagem = `Olá ${acordo.cliente_nome}, aqui é ${primeiroNome}, do departamento de acordos das Lojas Novo Mundo. Notamos que a parcela no valor de ${valorFormatado} com vencimento em ${dataFormatada} ainda consta em aberto. Caso já tenha pago, pode nos enviar o comprovante? Caso contrário, consegue regularizar hoje?`;
      } else if (tipoLembrete === 'vencido_d10') {
        mensagem = `Olá ${acordo.cliente_nome}, aqui é ${primeiroNome}, do departamento de acordos das Lojas Novo Mundo. Identificamos que sua parcela no valor de ${valorFormatado}, vencida em ${dataFormatada}, continua em aberto há 10 dias. É muito importante manter o acordo em dia. Consegue efetuar o pagamento?`;
      } else if (tipoLembrete === 'vencido_d11') {
        mensagem = `Olá ${acordo.cliente_nome}, aqui é ${primeiroNome}, do departamento de acordos das Lojas Novo Mundo. Reforçamos que sua parcela de ${valorFormatado} (vencimento ${dataFormatada}) segue pendente há 11 dias. Por favor, regularize o quanto antes para evitar problemas com seu acordo.`;
      } else if (tipoLembrete === 'vencido_d20') {
        mensagem = `Olá ${acordo.cliente_nome}, aqui é ${primeiroNome}, do departamento de acordos das Lojas Novo Mundo. Sua parcela de ${valorFormatado} está em atraso há 20 dias (vencimento ${dataFormatada}). Pedimos que regularize a situação o mais breve possível para evitar o descumprimento do acordo.`;
      } else if (tipoLembrete === 'vencido_d30') {
        mensagem = `Olá ${acordo.cliente_nome}, aqui é ${primeiroNome}, do departamento de acordos das Lojas Novo Mundo. Este é o último aviso referente à parcela de ${valorFormatado} vencida em ${dataFormatada}, em atraso há 30 dias. Caso o pagamento não seja regularizado, o acordo poderá ser considerado descumprido. Por favor, entre em contato.`;
      } else if (tipoLembrete === 'dia_vencimento') {
        mensagem = `Olá ${acordo.cliente_nome} tudo bem? Meu nome é ${primeiroNome}, sou do departamento de acordos das Lojas Novo Mundo e estou passando para lembrar que o vencimento da sua parcela no de valor ${valorFormatado} vence HOJE. Gostaria que enviasse o boleto para pagamento?`;
      } else {
        mensagem = `Olá ${acordo.cliente_nome} tudo bem? Meu nome é ${primeiroNome}, sou do departamento de acordos das Lojas Novo Mundo e estou passando para lembrar que o vencimento da sua parcela no de valor ${valorFormatado} vence é dia ${dataFormatada}. Gostaria que enviasse o boleto para pagamento?`;
      }

      const telefoneFormatado = acordo.cliente_telefone.replace(/\D/g, '');
      const telefoneCompleto = telefoneFormatado.startsWith('55') ? telefoneFormatado : `55${telefoneFormatado}`;

      // Verificar horário agendado
      const horaAgendadaUTC = proximoHorario.getUTCHours();
      const horaAgendadaBrasilia = (horaAgendadaUTC - 3 + 24) % 24;
      if (horaAgendadaBrasilia >= 18) {
        proximoHorario.setUTCDate(proximoHorario.getUTCDate() + 1);
        proximoHorario.setUTCHours(11, 0, 0, 0);
      }

      const { error: insertError } = await supabase
        .from('whatsapp_fila')
        .insert({
          pagamento_id: parcela.id,
          tipo_lembrete: tipoLembrete,
          telefone: telefoneCompleto,
          mensagem,
          agendado_para: proximoHorario.toISOString(),
          status: 'pendente',
          server_url: finalServerUrl,
          instance_token: finalInstanceToken,
        });

      if (insertError) {
        console.error(`Erro ao inserir parcela ${parcela.id}:`, insertError);
        continue;
      }

      console.log(`Agendado [${tipoLembrete}] para ${proximoHorario.toISOString()} - ${acordo.cliente_nome}`);
      agendados++;

      const intervaloMs = (Math.floor(Math.random() * 3) + 5) * 60 * 1000;
      proximoHorario = new Date(proximoHorario.getTime() + intervaloMs);
    }

    console.log(`Concluído: ${agendados} agendados, ${pulados} pulados`);

    return new Response(JSON.stringify({ 
      success: true, agendados, pulados, total: todasParcelas.length
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Erro na função check-payment-reminders:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

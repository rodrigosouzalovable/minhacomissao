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
    console.log('Iniciando geração do relatório diário...');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Obter data de hoje no fuso de Brasília
    const now = new Date();
    const brasiliaOffset = -3 * 60; // UTC-3
    const brasiliaTime = new Date(now.getTime() + (brasiliaOffset + now.getTimezoneOffset()) * 60000);
    const hoje = brasiliaTime.toISOString().split('T')[0]; // YYYY-MM-DD

    console.log('Data do relatório:', hoje);

    // Buscar acordos lançados hoje com nome do funcionário
    const { data: acordosHoje, error: acordosError } = await supabase
      .from('acordos')
      .select(`
        id,
        user_id,
        profiles!acordos_user_id_fkey (nome)
      `)
      .gte('criado_em', `${hoje}T00:00:00-03:00`)
      .lte('criado_em', `${hoje}T23:59:59-03:00`);

    if (acordosError) {
      console.error('Erro ao buscar acordos:', acordosError);
      throw acordosError;
    }

    console.log('Acordos encontrados hoje:', acordosHoje?.length || 0);

    // Agrupar acordos por funcionário
    const acordosPorFuncionario: Record<string, number> = {};
    if (acordosHoje) {
      for (const acordo of acordosHoje) {
        const nome = (acordo.profiles as any)?.nome || 'Desconhecido';
        acordosPorFuncionario[nome] = (acordosPorFuncionario[nome] || 0) + 1;
      }
    }

    // Buscar parcelas pagas hoje
    const { data: pagamentosHoje, error: pagamentosError } = await supabase
      .from('pagamentos')
      .select(`
        valor_parcela,
        acordos!pagamentos_acordo_id_fkey (
          user_id,
          profiles!acordos_user_id_fkey (nome)
        )
      `)
      .eq('data_paga', hoje)
      .eq('status', 'pago');

    if (pagamentosError) {
      console.error('Erro ao buscar pagamentos:', pagamentosError);
      throw pagamentosError;
    }

    console.log('Pagamentos encontrados hoje:', pagamentosHoje?.length || 0);

    // Calcular valores por funcionário e total geral
    let totalGeral = 0;
    const valoresPorFuncionario: Record<string, number> = {};
    
    if (pagamentosHoje) {
      for (const pagamento of pagamentosHoje) {
        const acordo = pagamento.acordos as any;
        const nome = acordo?.profiles?.nome || 'Desconhecido';
        const valor = Number(pagamento.valor_parcela) || 0;
        
        valoresPorFuncionario[nome] = (valoresPorFuncionario[nome] || 0) + valor;
        totalGeral += valor;
      }
    }

    // Formatar data para exibição
    const dataFormatada = brasiliaTime.toLocaleDateString('pt-BR');

    // Montar mensagem
    let mensagem = `📊 *RELATÓRIO DIÁRIO - ${dataFormatada}*\n\n`;

    // Seção de acordos lançados
    mensagem += `📝 *ACORDOS LANÇADOS HOJE:*\n`;
    const funcionariosAcordos = Object.entries(acordosPorFuncionario).sort((a, b) => b[1] - a[1]);
    
    if (funcionariosAcordos.length === 0) {
      mensagem += `• Nenhum acordo lançado hoje\n`;
    } else {
      for (const [nome, quantidade] of funcionariosAcordos) {
        const plural = quantidade === 1 ? 'acordo' : 'acordos';
        mensagem += `• ${nome}: ${quantidade} ${plural}\n`;
      }
    }

    mensagem += `\n💰 *PARCELAS PAGAS HOJE:*\n`;
    const funcionariosPagamentos = Object.entries(valoresPorFuncionario).sort((a, b) => b[1] - a[1]);
    
    if (funcionariosPagamentos.length === 0) {
      mensagem += `• Nenhuma parcela paga hoje\n`;
    } else {
      for (const [nome, valor] of funcionariosPagamentos) {
        const valorFormatado = valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        mensagem += `• ${nome}: ${valorFormatado}\n`;
      }
    }

    mensagem += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    const totalFormatado = totalGeral.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    mensagem += `💵 *TOTAL RECEBIDO NO DIA: ${totalFormatado}*\n`;
    mensagem += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

    console.log('Mensagem gerada:', mensagem);

    // Enviar via Z-API
    const instanceId = Deno.env.get('ZAPI_INSTANCE_ID');
    const token = Deno.env.get('ZAPI_TOKEN');
    const clientToken = Deno.env.get('ZAPI_CLIENT_TOKEN');

    if (!instanceId || !token || !clientToken) {
      console.error('Credenciais Z-API não configuradas');
      throw new Error('Credenciais Z-API não configuradas');
    }

    const telefoneDestino = '5562991672674'; // 62 99167-2674

    const zapiUrl = `https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`;

    console.log('Enviando relatório para:', telefoneDestino);

    const response = await fetch(zapiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': clientToken
      },
      body: JSON.stringify({
        phone: telefoneDestino,
        message: mensagem
      })
    });

    const data = await response.json();
    console.log('Resposta da Z-API:', data);

    if (!response.ok) {
      throw new Error(data.message || 'Erro ao enviar mensagem via Z-API');
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Relatório enviado com sucesso',
        data: {
          acordosLancados: acordosPorFuncionario,
          parcelasPagas: valoresPorFuncionario,
          totalGeral
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro ao gerar/enviar relatório:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

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

    // Ler user_id do body (enviado pelo frontend)
    const { user_id } = await req.json().catch(() => ({}));
    console.log('user_id recebido:', user_id);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Obter data de hoje no fuso de Brasília
    const now = new Date();
    const brasiliaOffset = -3 * 60;
    const brasiliaTime = new Date(now.getTime() + (brasiliaOffset + now.getTimezoneOffset()) * 60000);
    const hoje = brasiliaTime.toISOString().split('T')[0];

    console.log('Data do relatório:', hoje);

    // Buscar acordos lançados hoje
    const { data: acordosHoje, error: acordosError } = await supabase
      .from('acordos')
      .select('id, user_id')
      .gte('criado_em', `${hoje}T00:00:00-03:00`)
      .lte('criado_em', `${hoje}T23:59:59-03:00`);

    if (acordosError) throw acordosError;

    console.log('Acordos encontrados hoje:', acordosHoje?.length || 0);

    // Buscar todos os profiles para mapear user_id -> nome
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, nome');

    const profileMap: Record<string, string> = {};
    if (profiles) {
      for (const profile of profiles) {
        profileMap[profile.id] = profile.nome;
      }
    }

    // Agrupar acordos por funcionário
    const acordosPorFuncionario: Record<string, number> = {};
    if (acordosHoje) {
      for (const acordo of acordosHoje) {
        const nome = profileMap[acordo.user_id] || 'Desconhecido';
        acordosPorFuncionario[nome] = (acordosPorFuncionario[nome] || 0) + 1;
      }
    }

    // Buscar parcelas pagas hoje
    const { data: pagamentosHoje, error: pagamentosError } = await supabase
      .from('pagamentos')
      .select('valor_parcela, acordo_id')
      .eq('data_paga', hoje)
      .eq('status', 'pago');

    if (pagamentosError) throw pagamentosError;

    console.log('Pagamentos encontrados hoje:', pagamentosHoje?.length || 0);

    // Buscar acordos dos pagamentos para obter user_id
    const acordoIds = pagamentosHoje?.map(p => p.acordo_id) || [];
    let acordosDosPagamentos: { id: string; user_id: string }[] = [];
    
    if (acordoIds.length > 0) {
      const { data: acordosData } = await supabase
        .from('acordos')
        .select('id, user_id')
        .in('id', acordoIds);
      acordosDosPagamentos = acordosData || [];
    }

    const acordoUserMap: Record<string, string> = {};
    for (const acordo of acordosDosPagamentos) {
      acordoUserMap[acordo.id] = acordo.user_id;
    }

    let totalGeral = 0;
    const valoresPorFuncionario: Record<string, number> = {};
    
    if (pagamentosHoje) {
      for (const pagamento of pagamentosHoje) {
        const userId = acordoUserMap[pagamento.acordo_id];
        const nome = userId ? (profileMap[userId] || 'Desconhecido') : 'Desconhecido';
        const valor = Number(pagamento.valor_parcela) || 0;
        valoresPorFuncionario[nome] = (valoresPorFuncionario[nome] || 0) + valor;
        totalGeral += valor;
      }
    }

    const dataFormatada = brasiliaTime.toLocaleDateString('pt-BR');

    let mensagem = `📊 *RELATÓRIO DIÁRIO - ${dataFormatada}*\n\n`;
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

    // === BUSCAR CREDENCIAIS UAZAPI ===
    // 1. Prioridade: perfil do usuário que disparou (user_id do frontend)
    let serverUrl: string | null = null;
    let instanceToken: string | null = null;
    let fonte = '';

    if (user_id) {
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('whatsapp_lembrete_server_url, whatsapp_lembrete_instance_token')
        .eq('id', user_id)
        .single();

      if (userProfile?.whatsapp_lembrete_server_url && userProfile?.whatsapp_lembrete_instance_token) {
        serverUrl = userProfile.whatsapp_lembrete_server_url;
        instanceToken = userProfile.whatsapp_lembrete_instance_token;
        fonte = 'perfil do usuário logado';
      }
    }

    // 2. Fallback: qualquer perfil com credenciais configuradas
    if (!serverUrl || !instanceToken) {
      const { data: adminProfiles } = await supabase
        .from('profiles')
        .select('whatsapp_lembrete_server_url, whatsapp_lembrete_instance_token')
        .not('whatsapp_lembrete_server_url', 'is', null)
        .not('whatsapp_lembrete_instance_token', 'is', null)
        .limit(1);

      const adminProfile = adminProfiles?.[0];
      if (adminProfile?.whatsapp_lembrete_server_url && adminProfile?.whatsapp_lembrete_instance_token) {
        serverUrl = adminProfile.whatsapp_lembrete_server_url;
        instanceToken = adminProfile.whatsapp_lembrete_instance_token;
        fonte = 'perfil admin genérico';
      }
    }

    // 3. Último fallback: variáveis de ambiente
    if (!serverUrl || !instanceToken) {
      serverUrl = Deno.env.get('UAZAPI_SERVER_URL') || null;
      instanceToken = Deno.env.get('UAZAPI_INSTANCE_TOKEN') || null;
      fonte = 'variáveis de ambiente';
    }

    if (!serverUrl || !instanceToken) {
      throw new Error('Credenciais UAZAPI não configuradas');
    }

    console.log('Usando credenciais de:', fonte);

    const telefoneDestino = '5562991672674';
    const cleanUrl = serverUrl.replace(/\/+$/, '');
    const endpoints = [
      `${cleanUrl}/message/sendText`,
      `${cleanUrl}/sendText`,
      `${cleanUrl}/send/text`,
    ];

    console.log('Enviando relatório para:', telefoneDestino);

    let data: any;
    let sent = false;
    for (const url of endpoints) {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'token': instanceToken },
        body: JSON.stringify({ number: telefoneDestino, text: mensagem }),
      });
      data = await response.json();
      console.log(`Resposta UAZAPI (${url}):`, data);
      if (response.ok) { sent = true; break; }
    }

    if (!sent) {
      throw new Error(data?.message || 'Erro ao enviar mensagem via UAZAPI');
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Relatório enviado com sucesso',
        fonte,
        data: { acordosLancados: acordosPorFuncionario, parcelasPagas: valoresPorFuncionario, totalGeral }
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

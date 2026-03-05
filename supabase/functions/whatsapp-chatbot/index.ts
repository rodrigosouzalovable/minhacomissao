import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const VALOR_MINIMO_PARCELA = 90;

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function extractCpf(text: string): string | null {
  const cleaned = text.replace(/\D/g, '');
  if (cleaned.length === 11) return cleaned;
  // Try to find 11 consecutive digits in the text
  const match = text.match(/\d{11}/);
  if (match) return match[0];
  // Try formatted CPF pattern
  const formatted = text.match(/(\d{3})[.\s-]?(\d{3})[.\s-]?(\d{3})[.\s-]?(\d{2})/);
  if (formatted) return formatted[1] + formatted[2] + formatted[3] + formatted[4];
  return null;
}

function formatCpf(cpf: string): string {
  const c = cpf.replace(/\D/g, '');
  return `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}`;
}

async function sendMessage(serverUrl: string, instanceToken: string, telefone: string, mensagem: string) {
  const cleanUrl = serverUrl.replace(/\/+$/, '');
  const endpoints = [
    `${cleanUrl}/message/sendText`,
    `${cleanUrl}/sendText`,
    `${cleanUrl}/send/text`,
  ];
  let lastError = null;
  for (const url of endpoints) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'token': instanceToken },
        body: JSON.stringify({ number: telefone, text: mensagem }),
      });
      const data = await response.json();
      if (response.ok) return data;
      lastError = data;
    } catch (e) {
      lastError = e;
    }
  }
  throw new Error(lastError?.message || 'Falha ao enviar mensagem UAZAPI');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    console.log('Webhook recebido:', JSON.stringify(payload).substring(0, 500));

    // Extract message info from UAZAPI webhook payload
    const message = payload?.message || payload;
    const isFromMe = message?.fromMe || message?.key?.fromMe || false;
    const isGroup = message?.isGroup || (message?.key?.remoteJid || '').includes('@g.us') || false;

    // Ignore messages sent by the bot itself or from groups
    if (isFromMe || isGroup) {
      return new Response(JSON.stringify({ success: true, ignored: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extract phone number and text
    const remoteJid = message?.key?.remoteJid || message?.from || '';
    const telefone = remoteJid.replace('@s.whatsapp.net', '').replace('@c.us', '').replace(/\D/g, '');
    const texto = (message?.message?.conversation || 
                   message?.message?.extendedTextMessage?.text || 
                   message?.body || 
                   message?.text || '').trim();

    if (!telefone || !texto) {
      return new Response(JSON.stringify({ success: true, ignored: true, reason: 'no phone or text' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Mensagem de ${telefone}: "${texto}"`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get UAZAPI credentials from secrets (global config)
    const serverUrl = Deno.env.get('UAZAPI_SERVER_URL');
    const instanceToken = Deno.env.get('UAZAPI_INSTANCE_TOKEN');

    if (!serverUrl || !instanceToken) {
      console.error('Credenciais UAZAPI não configuradas');
      return new Response(JSON.stringify({ success: false, error: 'Credenciais não configuradas' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get or create conversation state
    const { data: conversa } = await supabase
      .from('chatbot_conversas')
      .select('*')
      .eq('telefone', telefone)
      .single();

    let etapaAtual = conversa?.etapa || 'novo';
    let dados = conversa?.dados || {};

    // Check if user wants to restart
    const textoLower = texto.toLowerCase().trim();
    if (['menu', 'inicio', 'início', 'voltar', 'reiniciar', 'oi', 'olá', 'ola', 'bom dia', 'boa tarde', 'boa noite'].includes(textoLower) && etapaAtual !== 'novo') {
      etapaAtual = 'novo';
      dados = {};
    }

    let resposta = '';

    switch (etapaAtual) {
      case 'novo':
      case 'aguardando_cpf': {
        if (etapaAtual === 'novo') {
          // First message - greet and ask for CPF
          resposta = `Olá! 👋 Sou o assistente virtual da *Souza e Ribeiro Negociações*.

Para consultar sua situação financeira, por favor informe seu *CPF* (apenas números ou formatado).`;

          // Save conversation state
          await supabase.from('chatbot_conversas').upsert({
            telefone,
            etapa: 'aguardando_cpf',
            dados: {},
            server_url: serverUrl,
            instance_token: instanceToken,
            atualizado_em: new Date().toISOString(),
          }, { onConflict: 'telefone' });

          break;
        }

        // Try to extract CPF from message
        const cpf = extractCpf(texto);
        if (!cpf) {
          resposta = `⚠️ Não consegui identificar um CPF válido na sua mensagem.

Por favor, envie seu CPF com *11 dígitos*. Exemplo: 123.456.789-00`;
          break;
        }

        console.log(`CPF extraído: ${cpf}`);

        // Query debts
        const { data: debitos, error: debitosError } = await supabase
          .rpc('consultar_debitos_por_cpf', { p_cpf: cpf });

        if (debitosError) {
          console.error('Erro ao consultar débitos:', debitosError);
          resposta = `❌ Ocorreu um erro ao consultar seus dados. Por favor, tente novamente mais tarde ou entre em contato pelo telefone (62) 98218-3144.`;
          break;
        }

        if (!debitos || debitos.length === 0) {
          resposta = `✅ *Parabéns!* Não encontramos pendências para o CPF ${formatCpf(cpf)}.

Se você acredita que há algum erro, entre em contato pelo telefone *(62) 98218-3144*.

Digite *menu* para reiniciar.`;

          await supabase.from('chatbot_conversas').upsert({
            telefone,
            etapa: 'sem_debitos',
            dados: { cpf },
            atualizado_em: new Date().toISOString(),
          }, { onConflict: 'telefone' });
          break;
        }

        // Calculate totals
        const nomeDevedor = debitos[0].nome;
        const totalContratos = debitos.length;
        const valorTotal = debitos.reduce((sum: number, d: any) => sum + Number(d.valor_atualizado), 0);

        // À vista: 50% OFF
        const valorAvista = valorTotal * 0.5;

        // Parcelado: 30% OFF
        const valorParcelado = valorTotal * 0.7;
        
        // Calculate max installments (min R$90 per installment, max 24)
        let maxParcelas = Math.floor(valorParcelado / VALOR_MINIMO_PARCELA);
        if (maxParcelas > 24) maxParcelas = 24;
        if (maxParcelas < 2) maxParcelas = 2;
        const valorParcelaMin = valorParcelado / maxParcelas;

        // Check if agreement already exists
        const { data: acordoExistente } = await supabase
          .rpc('consultar_acordo_ativo_por_cpf', { p_cpf: cpf });

        let avisoAcordo = '';
        if (acordoExistente && acordoExistente.length > 0) {
          const acordo = acordoExistente[0];
          avisoAcordo = `\n\n⚠️ *Atenção:* Já existe um acordo ${acordo.acordo_status} em seu nome, registrado por ${acordo.funcionario_nome}.`;
        }

        resposta = `Olá, *${nomeDevedor}*! 📋

Encontrei *${totalContratos} contrato(s)* em seu nome (CPF: ${formatCpf(cpf)}), totalizando *${formatCurrency(valorTotal)}*.

━━━━━━━━━━━━━━━━━━━━
💰 *QUITAÇÃO À VISTA (50% OFF)*
Valor: *${formatCurrency(valorAvista)}* em parcela única
Economia de ${formatCurrency(valorTotal - valorAvista)}!
━━━━━━━━━━━━━━━━━━━━

📋 *PARCELADO (30% OFF)*
Valor: *${formatCurrency(valorParcelado)}*
Em até *${maxParcelas}x* de *${formatCurrency(valorParcelaMin)}*
(mínimo de 2x, parcela mínima R$ 90,00)
━━━━━━━━━━━━━━━━━━━━${avisoAcordo}

📞 Para fechar o acordo, entre em contato:
*(62) 98218-3144*

Digite *menu* para reiniciar a consulta.`;

        await supabase.from('chatbot_conversas').upsert({
          telefone,
          etapa: 'proposta_enviada',
          dados: { 
            cpf, 
            nome: nomeDevedor,
            valor_total: valorTotal,
            total_contratos: totalContratos,
          },
          atualizado_em: new Date().toISOString(),
        }, { onConflict: 'telefone' });

        break;
      }

      case 'proposta_enviada':
      case 'sem_debitos': {
        resposta = `Para fazer uma nova consulta, digite *menu*.

📞 Para falar com um negociador: *(62) 98218-3144*`;
        break;
      }

      default: {
        // Reset to initial state
        resposta = `Olá! 👋 Sou o assistente virtual da *Souza e Ribeiro Negociações*.

Para consultar sua situação financeira, por favor informe seu *CPF*.`;

        await supabase.from('chatbot_conversas').upsert({
          telefone,
          etapa: 'aguardando_cpf',
          dados: {},
          atualizado_em: new Date().toISOString(),
        }, { onConflict: 'telefone' });
      }
    }

    // Send response via UAZAPI
    if (resposta) {
      console.log(`Enviando resposta para ${telefone}...`);
      await sendMessage(serverUrl, instanceToken, telefone, resposta);
      console.log('Resposta enviada com sucesso!');
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Erro no whatsapp-chatbot:', error);
    return new Response(JSON.stringify({ success: true }), {
      // Return 200 to avoid UAZAPI retrying
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

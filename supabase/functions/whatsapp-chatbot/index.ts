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
  const match = text.match(/\d{11}/);
  if (match) return match[0];
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

async function triggerCobMaisRobot(supabase: any, cpf: string, valorFinal: number, tipoPagamento: string, parcelas: number) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Call automacao-cobmais edge function internally
  const res = await fetch(`${supabaseUrl}/functions/v1/automacao-cobmais`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseServiceKey}`,
    },
    body: JSON.stringify({
      _internal: true,
      action: 'execute',
      acao: 'gerar_boleto',
      parametros: { cpf, valor_final: valorFinal, tipo_pagamento: tipoPagamento, parcelas },
    }),
  });

  const result = await res.json();
  console.log('Resultado gerar_boleto:', JSON.stringify(result));
  return result;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    console.log('Webhook recebido (FULL):', JSON.stringify(payload));

    const isFromMe = payload?.message?.fromMe ?? payload?.fromMe ?? payload?.key?.fromMe ?? false;
    const remoteJid = payload?.message?.chatid
      || payload?.chat?.wa_chatid
      || payload?.message?.sender_pn
      || payload?.key?.remoteJid
      || payload?.from
      || '';
    const isGroup = payload?.message?.isGroup ?? payload?.chat?.wa_isGroup ?? remoteJid.includes('@g.us') ?? false;

    if (isFromMe || isGroup) {
      return new Response(JSON.stringify({ success: true, ignored: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const telefone = remoteJid.replace('@s.whatsapp.net', '').replace('@c.us', '').replace(/\D/g, '');
    const texto = (payload?.message?.text
                   || payload?.body 
                   || payload?.text 
                   || payload?.message?.body
                   || payload?.message?.conversation 
                   || payload?.message?.extendedTextMessage?.text 
                   || payload?.message?.content?.text
                   || '').trim();

    if (!telefone || !texto) {
      return new Response(JSON.stringify({ success: true, ignored: true, reason: 'no phone or text' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Mensagem de ${telefone}: "${texto}"`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if chatbot is globally enabled
    const { data: chatbotConfig } = await supabase
      .from('chatbot_config')
      .select('ativo')
      .limit(1)
      .single();

    if (!chatbotConfig?.ativo) {
      console.log('Chatbot desativado globalmente. Ignorando mensagem.');
      return new Response(JSON.stringify({ success: true, ignored: true, reason: 'chatbot_disabled' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const serverUrl = payload?.BaseUrl?.replace(/\/+$/, '') || Deno.env.get('UAZAPI_SERVER_URL');
    const instanceToken = payload?.token || Deno.env.get('UAZAPI_INSTANCE_TOKEN');

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
          resposta = `Olá! 👋 Sou o assistente virtual da *Souza e Ribeiro Negociações*.

Para consultar sua situação financeira, por favor informe seu *CPF* (apenas números ou formatado).`;

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

        const cpf = extractCpf(texto);
        if (!cpf) {
          resposta = `⚠️ Não consegui identificar um CPF válido na sua mensagem.

Por favor, envie seu CPF com *11 dígitos*. Exemplo: 123.456.789-00`;
          break;
        }

        console.log(`CPF extraído: ${cpf}`);

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

        const valorAvista = valorTotal * 0.5;
        const valorParcelado = valorTotal * 0.7;
        
        let maxParcelas = Math.floor(valorParcelado / VALOR_MINIMO_PARCELA);
        if (maxParcelas > 24) maxParcelas = 24;
        if (maxParcelas < 2) maxParcelas = 2;
        const valorParcelaMin = valorParcelado / maxParcelas;

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
💰 *OPÇÃO 1 — QUITAÇÃO À VISTA (50% OFF)*
Valor: *${formatCurrency(valorAvista)}* em parcela única
Economia de ${formatCurrency(valorTotal - valorAvista)}!
━━━━━━━━━━━━━━━━━━━━

📋 *OPÇÃO 2 — PARCELADO (30% OFF)*
Valor: *${formatCurrency(valorParcelado)}*
Em até *${maxParcelas}x* de *${formatCurrency(valorParcelaMin)}*
(mínimo de 2x, parcela mínima R$ 90,00)
━━━━━━━━━━━━━━━━━━━━${avisoAcordo}

Para prosseguir, responda:
*1* — Quero pagar *à vista*
*2* — Quero *parcelar*

📞 Ou fale com um negociador: *(62) 98218-3144*
Digite *menu* para reiniciar.`;

        await supabase.from('chatbot_conversas').upsert({
          telefone,
          etapa: 'proposta_enviada',
          dados: { 
            cpf, 
            nome: nomeDevedor,
            valor_total: valorTotal,
            valor_avista: valorAvista,
            valor_parcelado: valorParcelado,
            max_parcelas: maxParcelas,
            total_contratos: totalContratos,
          },
          server_url: serverUrl,
          instance_token: instanceToken,
          atualizado_em: new Date().toISOString(),
        }, { onConflict: 'telefone' });

        break;
      }

      case 'proposta_enviada': {
        if (textoLower === '1') {
          // À vista — trigger robot
          const cpf = dados.cpf;
          const valorFinal = dados.valor_avista;

          resposta = `✅ Ótima escolha! Você optou pela *quitação à vista* no valor de *${formatCurrency(valorFinal)}*.

⏳ Estou gerando seu boleto agora... Aguarde um momento, por favor.`;

          await supabase.from('chatbot_conversas').upsert({
            telefone,
            etapa: 'gerando_boleto',
            dados: { ...dados, tipo_pagamento: 'avista', parcelas: 1, valor_final: valorFinal },
            atualizado_em: new Date().toISOString(),
          }, { onConflict: 'telefone' });

          // Send waiting message first
          await sendMessage(serverUrl, instanceToken, telefone, resposta);

          // Trigger robot
          try {
            const result = await triggerCobMaisRobot(supabase, cpf, valorFinal, 'avista', 1);

            if (result.success && result.resultado?.boleto_url) {
              resposta = `🎉 *Boleto gerado com sucesso!*

📄 Acesse seu boleto:
${result.resultado.boleto_url}

💰 Valor: *${formatCurrency(valorFinal)}*

Após o pagamento, sua situação será regularizada automaticamente.

📞 Dúvidas? *(62) 98218-3144*
Digite *menu* para nova consulta.`;
            } else {
              resposta = `⚠️ Não foi possível gerar o boleto automaticamente.

Por favor, entre em contato com nosso negociador para finalizar:
📞 *(62) 98218-3144*

Seu acordo de *${formatCurrency(valorFinal)}* à vista já está pré-aprovado!

Digite *menu* para nova consulta.`;
            }
          } catch (err) {
            console.error('Erro ao gerar boleto:', err);
            resposta = `⚠️ Não foi possível gerar o boleto automaticamente.

Por favor, entre em contato com nosso negociador:
📞 *(62) 98218-3144*

Digite *menu* para nova consulta.`;
          }

          await supabase.from('chatbot_conversas').upsert({
            telefone,
            etapa: 'acordo_finalizado',
            dados: { ...dados, tipo_pagamento: 'avista', parcelas: 1, valor_final: valorFinal },
            atualizado_em: new Date().toISOString(),
          }, { onConflict: 'telefone' });

          break;

        } else if (textoLower === '2') {
          // Parcelado — ask number of installments
          const maxParcelas = dados.max_parcelas || 12;
          const valorParcelado = dados.valor_parcelado;

          resposta = `📋 Você escolheu *parcelar*.

Valor total: *${formatCurrency(valorParcelado)}*

Em quantas parcelas deseja pagar? (de *2* a *${maxParcelas}*)
Parcela mínima: R$ 90,00

Responda com o *número de parcelas* desejado.`;

          await supabase.from('chatbot_conversas').upsert({
            telefone,
            etapa: 'aguardando_parcelas',
            dados: { ...dados, tipo_pagamento: 'parcelado' },
            atualizado_em: new Date().toISOString(),
          }, { onConflict: 'telefone' });

          break;

        } else {
          resposta = `Por favor, responda com:
*1* — Pagar *à vista*
*2* — *Parcelar*

Ou digite *menu* para reiniciar.`;
          break;
        }
      }

      case 'aguardando_parcelas': {
        const numParcelas = parseInt(texto.trim());
        const maxParcelas = dados.max_parcelas || 12;
        const valorParcelado = dados.valor_parcelado;

        if (isNaN(numParcelas) || numParcelas < 2 || numParcelas > maxParcelas) {
          resposta = `⚠️ Número de parcelas inválido.

Escolha entre *2* e *${maxParcelas}* parcelas.
Parcela mínima: R$ 90,00

Responda com o *número de parcelas*.`;
          break;
        }

        const valorParcela = valorParcelado / numParcelas;
        if (valorParcela < VALOR_MINIMO_PARCELA) {
          const maxPossivel = Math.floor(valorParcelado / VALOR_MINIMO_PARCELA);
          resposta = `⚠️ Com ${numParcelas}x a parcela ficaria *${formatCurrency(valorParcela)}*, abaixo do mínimo de R$ 90,00.

O máximo de parcelas é *${maxPossivel}x* de *${formatCurrency(valorParcelado / maxPossivel)}*.

Responda com o *número de parcelas*.`;
          break;
        }

        const valorFinal = valorParcelado;
        const cpf = dados.cpf;

        resposta = `✅ Perfeito! Acordo em *${numParcelas}x* de *${formatCurrency(valorParcela)}*.

⏳ Estou gerando seu boleto agora... Aguarde um momento.`;

        await supabase.from('chatbot_conversas').upsert({
          telefone,
          etapa: 'gerando_boleto',
          dados: { ...dados, parcelas: numParcelas, valor_final: valorFinal, valor_parcela: valorParcela },
          atualizado_em: new Date().toISOString(),
        }, { onConflict: 'telefone' });

        // Send waiting message
        await sendMessage(serverUrl, instanceToken, telefone, resposta);

        // Trigger robot
        try {
          const result = await triggerCobMaisRobot(supabase, cpf, valorFinal, 'parcelado', numParcelas);

          if (result.success && result.resultado?.boleto_url) {
            resposta = `🎉 *Acordo gerado com sucesso!*

📄 Boleto da 1ª parcela:
${result.resultado.boleto_url}

💰 *${numParcelas}x* de *${formatCurrency(valorParcela)}*
Total: *${formatCurrency(valorFinal)}*

Os próximos boletos serão enviados mensalmente.

📞 Dúvidas? *(62) 98218-3144*
Digite *menu* para nova consulta.`;
          } else {
            resposta = `⚠️ Não foi possível gerar o boleto automaticamente.

Por favor, entre em contato com nosso negociador:
📞 *(62) 98218-3144*

Seu acordo de *${numParcelas}x de ${formatCurrency(valorParcela)}* já está pré-aprovado!

Digite *menu* para nova consulta.`;
          }
        } catch (err) {
          console.error('Erro ao gerar boleto parcelado:', err);
          resposta = `⚠️ Não foi possível gerar o boleto automaticamente.

Por favor, entre em contato com nosso negociador:
📞 *(62) 98218-3144*

Digite *menu* para nova consulta.`;
        }

        await supabase.from('chatbot_conversas').upsert({
          telefone,
          etapa: 'acordo_finalizado',
          dados: { ...dados, parcelas: numParcelas, valor_final: valorFinal, valor_parcela: valorParcela },
          atualizado_em: new Date().toISOString(),
        }, { onConflict: 'telefone' });

        break;
      }

      case 'gerando_boleto': {
        resposta = `⏳ Seu boleto ainda está sendo gerado. Por favor, aguarde...

Se já faz mais de 3 minutos, entre em contato:
📞 *(62) 98218-3144*`;
        break;
      }

      case 'acordo_finalizado':
      case 'sem_debitos': {
        resposta = `Para fazer uma nova consulta, digite *menu*.

📞 Para falar com um negociador: *(62) 98218-3144*`;
        break;
      }

      default: {
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
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

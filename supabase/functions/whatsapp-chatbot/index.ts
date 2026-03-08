import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const VALOR_MINIMO_PARCELA = 90;

const SYSTEM_PROMPT = `Você é um negociador humano da empresa "Souza e Ribeiro Negociações". Seu nome é Ana.

REGRAS ABSOLUTAS:
- Você NUNCA inventa valores, nomes, CPFs ou qualquer dado. Use APENAS os dados fornecidos no contexto.
- Mantenha respostas CURTAS (máximo 3-4 parágrafos). Isso é WhatsApp, não email.
- Use no máximo 2-3 emojis por mensagem. Nada de exagero.
- Tom: empático, acolhedor, profissional. Como uma pessoa real que entende a situação financeira do cliente.
- Sempre que relevante, ofereça o contato humano: (62) 98218-3144
- Use *negrito* para valores e informações importantes (formatação WhatsApp).
- NUNCA diga que é uma IA, chatbot ou assistente virtual.
- Interprete variações de linguagem: "quero pagar", "aceito", "pode ser", "tô querendo" = aceitação.
- "à vista", "de uma vez", "pagar tudo" = opção à vista.
- "parcelar", "dividir", "em vezes" = opção parcelada.
- Quando o cliente disser algo fora do contexto, redirecione gentilmente para a negociação.
- Adapte a saudação ao horário: bom dia (6-12h), boa tarde (12-18h), boa noite (18-6h) no fuso de Brasília.
- Se o cliente demonstrar dificuldade financeira, seja ainda mais empático e destaque os descontos.
- NUNCA pressione o cliente. Seja sempre gentil e paciente.`;

async function simulateTyping(serverUrl: string, instanceToken: string, telefone: string, durationMs: number) {
  const cleanUrl = serverUrl.replace(/\/+$/, '');
  const endpoints = [
    `${cleanUrl}/chat/presence`,
    `${cleanUrl}/chatState`,
  ];
  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'token': instanceToken },
        body: JSON.stringify({ number: telefone, state: 'composing' }),
      });
      if (res.ok) break;
    } catch (e) {
      console.log(`Endpoint de presença ${url} falhou:`, e);
    }
  }
  await new Promise(r => setTimeout(r, durationMs));
}

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

async function gerarRespostaHumana(contexto: string, historico: Array<{role: string, content: string}>, fallback: string): Promise<string> {
  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.warn('[IA] LOVABLE_API_KEY não configurada, usando fallback');
      return fallback;
    }

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...historico.slice(-10),
      { role: 'user', content: contexto },
    ];

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages,
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      console.error('[IA] Erro gateway:', response.status, await response.text());
      return fallback;
    }

    const data = await response.json();
    const resposta = data.choices?.[0]?.message?.content?.trim();
    
    if (!resposta) {
      console.warn('[IA] Resposta vazia, usando fallback');
      return fallback;
    }

    console.log('[IA] Resposta gerada com sucesso');
    return resposta;
  } catch (err) {
    console.error('[IA] Erro ao gerar resposta:', err);
    return fallback;
  }
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
  console.log('[triggerCobMaisRobot] Status:', res.status, 'Resultado:', JSON.stringify(result));
  return result;
}

function addToHistorico(dados: any, role: string, content: string): any {
  const historico = dados?.mensagens_historico || [];
  historico.push({ role, content, ts: new Date().toISOString() });
  const trimmed = historico.slice(-20);
  return { ...dados, mensagens_historico: trimmed };
}

function getHistorico(dados: any): Array<{role: string, content: string}> {
  return (dados?.mensagens_historico || []).map((m: any) => ({
    role: m.role === 'cliente' ? 'user' : 'assistant',
    content: m.content,
  }));
}

// Template system: fetch from DB and replace variables
async function fetchTemplates(supabase: any): Promise<Record<string, string>> {
  try {
    const { data } = await supabase
      .from('chatbot_templates')
      .select('etapa, template')
      .eq('ativo', true);
    const map: Record<string, string> = {};
    if (data) {
      for (const t of data) {
        map[t.etapa] = t.template;
      }
    }
    return map;
  } catch (err) {
    console.error('[Templates] Erro ao buscar templates:', err);
    return {};
  }
}

function applyTemplate(templates: Record<string, string>, etapa: string, vars: Record<string, string>, fallback: string): string {
  const tpl = templates[etapa];
  if (!tpl) return fallback;
  let result = tpl;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }
  return result;
}

// Tool-calling to interpret user intent
async function interpretarIntencao(texto: string, opcoes: string[]): Promise<string | null> {
  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) return null;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [
          { role: 'system', content: 'Você interpreta a intenção do cliente em uma negociação de dívida.' },
          { role: 'user', content: `O cliente disse: "${texto}"\n\nQual dessas opções melhor corresponde à intenção?\nOpções: ${opcoes.join(', ')}\n\nResponda APENAS com uma das opções listadas, ou "nenhuma" se não corresponder.` },
        ],
        max_tokens: 50,
        temperature: 0,
      }),
    });

    if (!response.ok) return null;
    const data = await response.json();
    const result = data.choices?.[0]?.message?.content?.trim()?.toLowerCase();
    return result || null;
  } catch {
    return null;
  }
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
      console.log('Chatbot desativado globalmente.');
      return new Response(JSON.stringify({ success: true, ignored: true, reason: 'chatbot_disabled' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch all active templates from DB
    const templates = await fetchTemplates(supabase);
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const serverUrl = payload?.BaseUrl?.replace(/\/+$/, '') || Deno.env.get('UAZAPI_SERVER_URL');
    const instanceToken = payload?.token || Deno.env.get('UAZAPI_INSTANCE_TOKEN');

    // Check instance owner's WhatsApp setting
    if (instanceToken) {
      const { data: instanceOwner } = await supabase
        .from('user_whatsapp_instances')
        .select('user_id')
        .eq('instance_token', instanceToken)
        .eq('ativo', true)
        .limit(1)
        .maybeSingle();

      if (instanceOwner?.user_id) {
        const { data: ownerProfile } = await supabase
          .from('profiles')
          .select('whatsapp_lembretes_habilitado')
          .eq('id', instanceOwner.user_id)
          .single();

        if (ownerProfile && !ownerProfile.whatsapp_lembretes_habilitado) {
          console.log(`WhatsApp desabilitado para o dono da instância (${instanceOwner.user_id}).`);
          return new Response(JSON.stringify({ success: true, ignored: true, reason: 'owner_whatsapp_disabled' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
    }

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

    // Save incoming message to history
    dados = addToHistorico(dados, 'cliente', texto);

    // Check if user wants to restart
    const textoLower = texto.toLowerCase().trim();
    if (['menu', 'inicio', 'início', 'voltar', 'reiniciar'].includes(textoLower) && etapaAtual !== 'novo') {
      etapaAtual = 'novo';
      dados = { mensagens_historico: dados.mensagens_historico || [] };
    }

    // For greetings, only reset if not in middle of negotiation
    if (['oi', 'olá', 'ola', 'bom dia', 'boa tarde', 'boa noite', 'sim'].includes(textoLower) && etapaAtual !== 'novo' && !['proposta_enviada', 'aguardando_parcelas', 'aguardando_confirmacao_identidade'].includes(etapaAtual)) {
      etapaAtual = 'novo';
      dados = { mensagens_historico: dados.mensagens_historico || [] };
    }

    let resposta = '';
    const historico = getHistorico(dados);

    switch (etapaAtual) {
      case 'novo':
      case 'aguardando_cpf': {
        if (etapaAtual === 'novo') {
          // Try to identify client by phone number first
          const phoneSuffix = telefone.slice(-10); // last 10 digits
          const phoneSuffix11 = telefone.slice(-11); // last 11 digits
          
          // Search in devedores.telefone
          const { data: devedoresPorTelefone } = await supabase
            .from('devedores')
            .select('nome, cpf, telefone, valor_atualizado')
            .eq('ativo', true)
            .or(`telefone.ilike.%${phoneSuffix},telefone.ilike.%${phoneSuffix11}`);

          // Also search in devedor_telefones table
          let devedoresEncontrados = devedoresPorTelefone || [];
          
          if (devedoresEncontrados.length === 0) {
            const { data: telefonesAdicionais } = await supabase
              .from('devedor_telefones')
              .select('devedor_cpf, numero')
              .eq('ativo', true)
              .or(`numero.ilike.%${phoneSuffix},numero.ilike.%${phoneSuffix11}`);

            if (telefonesAdicionais && telefonesAdicionais.length > 0) {
              const cpfsUnicos = [...new Set(telefonesAdicionais.map((t: any) => t.devedor_cpf))];
              console.log(`[AUTO-ID] Telefone encontrado em devedor_telefones, CPFs: ${cpfsUnicos.join(', ')}`);
              
              const { data: devedoresPorCpf } = await supabase
                .from('devedores')
                .select('nome, cpf, telefone, valor_atualizado')
                .eq('ativo', true)
                .in('cpf', cpfsUnicos);
              
              if (devedoresPorCpf && devedoresPorCpf.length > 0) {
                devedoresEncontrados = devedoresPorCpf;
              }
            }
          }

          if (devedoresEncontrados.length > 0) {
            const cpfsUnicos = [...new Set(devedoresEncontrados.map((d: any) => d.cpf.replace(/\D/g, '')))];
            
            if (cpfsUnicos.length === 1) {
              // Single person — ask CPF confirmation before proposal
              const cpfLimpo = cpfsUnicos[0];
              const nomeDevedor = devedoresEncontrados[0].nome;
              console.log(`[AUTO-ID] Devedor único: ${nomeDevedor}, CPF: ${cpfLimpo} — pedindo confirmação de CPF`);

              const cpfFormatado = formatCpf(cpfLimpo);
              const fallbackConfirma = `Só pra confirmar, seu CPF é ${cpfFormatado}?`;
              resposta = applyTemplate(templates, 'confirmacao_cpf', { cpf_formatado: cpfFormatado }, fallbackConfirma);

              dados = { ...dados, cpf_candidato: cpfLimpo, nome_candidato: nomeDevedor };
              dados = addToHistorico(dados, 'assistente', resposta);
              await supabase.from('chatbot_conversas').upsert({
                telefone, etapa: 'aguardando_confirmacao_identidade', dados,
                server_url: serverUrl, instance_token: instanceToken,
                atualizado_em: new Date().toISOString(),
              }, { onConflict: 'telefone' });
              break;
            } else {
              // Multiple CPFs — ask for confirmation
              const devedor = devedoresEncontrados[0];
              const cpfLimpo = devedor.cpf.replace(/\D/g, '');
              const cpfFinal = cpfLimpo.slice(-3);
              console.log(`[AUTO-ID] Múltiplos CPFs (${cpfsUnicos.length}), pedindo confirmação`);

              const fallbackConfirma = `Olá! 👋 Sou a Ana, da Souza e Ribeiro Negociações. Estou falando com *${devedor.nome}*, CPF final *${cpfFinal}*?`;
              resposta = await gerarRespostaHumana(
                `CONTEXTO: Pelo telefone encontrei múltiplas pessoas. Perguntando se é ${devedor.nome}, CPF final ${cpfFinal}. Seja breve.`,
                historico,
                fallbackConfirma
              );

              dados = { ...dados, cpf_candidato: cpfLimpo, nome_candidato: devedor.nome };
              dados = addToHistorico(dados, 'assistente', resposta);
              await supabase.from('chatbot_conversas').upsert({
                telefone, etapa: 'aguardando_confirmacao_identidade', dados,
                server_url: serverUrl, instance_token: instanceToken,
                atualizado_em: new Date().toISOString(),
              }, { onConflict: 'telefone' });
              break;
            }
          }

          // No match by phone — standard flow: ask for CPF
          const fallbackSaudacao = `Olá! 👋 Sou a Ana, da Souza e Ribeiro Negociações. Para consultar sua situação financeira, por favor me informe seu CPF.`;
          resposta = applyTemplate(templates, 'saudacao', {}, fallbackSaudacao);

          dados = addToHistorico(dados, 'assistente', resposta);
          await supabase.from('chatbot_conversas').upsert({
            telefone, etapa: 'aguardando_cpf', dados,
            server_url: serverUrl, instance_token: instanceToken,
            atualizado_em: new Date().toISOString(),
          }, { onConflict: 'telefone' });
          break;
        }

        const cpf = extractCpf(texto);
        if (!cpf) {
          const fallbackCpfInv = `Não consegui identificar um CPF válido. Por favor, envie seu CPF com 11 dígitos. Exemplo: 123.456.789-00`;
          resposta = applyTemplate(templates, 'cpf_invalido', {}, fallbackCpfInv);
          dados = addToHistorico(dados, 'assistente', resposta);
          await supabase.from('chatbot_conversas').upsert({
            telefone, etapa: 'aguardando_cpf', dados,
            atualizado_em: new Date().toISOString(),
          }, { onConflict: 'telefone' });
          break;
        }

        console.log(`CPF extraído: ${cpf}`);

        const { data: debitos, error: debitosError } = await supabase
          .rpc('consultar_debitos_por_cpf', { p_cpf: cpf });

        if (debitosError) {
          console.error('Erro ao consultar débitos:', debitosError);
          const fallbackErro = `Desculpe, tive um problema ao consultar seus dados. Tente novamente mais tarde ou ligue para (62) 98218-3144.`;
          resposta = applyTemplate(templates, 'erro_consulta', { telefone_contato: '(62) 98218-3144' }, fallbackErro);
          dados = addToHistorico(dados, 'assistente', resposta);
          break;
        }

        if (!debitos || debitos.length === 0) {
          const primeiroNomeSemDeb = nomeDevedor ? nomeDevedor.split(' ')[0] : '';
          const primeiroNomeSemDebCap = primeiroNomeSemDeb ? primeiroNomeSemDeb.charAt(0).toUpperCase() + primeiroNomeSemDeb.slice(1).toLowerCase() : '';
          const fallbackSemDeb = `Ótima notícia! Não encontramos pendências para o CPF ${formatCpf(cpf)}. Se acredita que há algum erro, entre em contato: (62) 98218-3144.`;
          resposta = applyTemplate(templates, 'sem_debitos', { primeiro_nome: primeiroNomeSemDebCap || 'cliente', cpf_formatado: formatCpf(cpf), telefone_contato: '(62) 98218-3144' }, fallbackSemDeb);

          dados = addToHistorico(dados, 'assistente', resposta);
          await supabase.from('chatbot_conversas').upsert({
            telefone, etapa: 'sem_debitos', dados: { ...dados, cpf },
            atualizado_em: new Date().toISOString(),
          }, { onConflict: 'telefone' });
          break;
        }

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
          avisoAcordo = ` ATENÇÃO: Já existe um acordo ${acordo.acordo_status} em nome deste cliente, registrado por ${acordo.funcionario_nome}. Mencione isso.`;
        }

        const primeiroNomeCpf = nomeDevedor.split(' ')[0];
        const primeiroNomeCpfCap = primeiroNomeCpf.charAt(0).toUpperCase() + primeiroNomeCpf.slice(1).toLowerCase();
        
        // Fetch credor name
        const { data: devedorInfoCpf } = await supabase
          .from('devedores')
          .select('credor')
          .eq('cpf', cpf)
          .eq('ativo', true)
          .limit(1)
          .single();
        
        let credorNomeCpf = 'a empresa credora';
        const credorSlugCpf = devedorInfoCpf?.credor || '';
        if (credorSlugCpf.includes('novo_mundo') || credorSlugCpf.includes('ume')) {
          credorNomeCpf = 'as Lojas Novo Mundo';
        } else if (credorSlugCpf) {
          credorNomeCpf = credorSlugCpf.replace(/_/g, ' ');
        }

        const fallbackPropCpf = `Perfeito, ${primeiroNomeCpfCap}! A proposta disponível para *pagamento à vista é ${formatCurrency(valorAvista)}*, pagando esse valor, você quita todas as parcelas em aberto com ${credorNomeCpf}. Ou podemos parcelar para você da seguinte forma: *${maxParcelas}x de ${formatCurrency(valorParcelaMin)}*. Como fica melhor para você?`;
        resposta = applyTemplate(templates, 'proposta', { primeiro_nome: primeiroNomeCpfCap, valor_avista: formatCurrency(valorAvista), valor_parcela: formatCurrency(valorParcelaMin), max_parcelas: String(maxParcelas), credor: credorNomeCpf, valor_parcelado: formatCurrency(valorParcelado), telefone_contato: '(62) 98218-3144' }, fallbackPropCpf);

        dados = { 
          ...dados, cpf, nome: nomeDevedor, valor_total: valorTotal,
          valor_avista: valorAvista, valor_parcelado: valorParcelado,
          max_parcelas: maxParcelas, total_contratos: totalContratos,
        };
        dados = addToHistorico(dados, 'assistente', resposta);

        await supabase.from('chatbot_conversas').upsert({
          telefone, etapa: 'proposta_enviada', dados,
          server_url: serverUrl, instance_token: instanceToken,
          atualizado_em: new Date().toISOString(),
        }, { onConflict: 'telefone' });
        break;
      }

      case 'aguardando_confirmacao_identidade': {
        // Check if the client confirmed their identity
        const confirmou = await interpretarIntencao(texto, ['sim', 'nao', 'nenhuma']);
        const isConfirmacao = confirmou?.includes('sim') || 
          ['sim', 'sou', 'sou eu', 'isso', 'correto', 'sou sim', 'eu mesmo', 'eu mesma', 'isso mesmo', 'exato', 'sou eu mesmo', 'sou eu mesma'].includes(textoLower);
        const isNegacao = confirmou?.includes('nao') ||
          ['não', 'nao', 'não sou', 'nao sou', 'errado', 'não é', 'nao e'].includes(textoLower);

        if (isConfirmacao) {
          // Confirmed! Use the candidate CPF to fetch debts directly
          const cpf = dados.cpf_candidato;
          console.log(`[AUTO-ID] Identidade confirmada: ${dados.nome_candidato}, CPF: ${cpf}`);

          const { data: debitos, error: debitosError } = await supabase
            .rpc('consultar_debitos_por_cpf', { p_cpf: cpf });

          if (debitosError || !debitos || debitos.length === 0) {
            const fallback = debitos?.length === 0
              ? `Ótima notícia, ${dados.nome_candidato}! Não encontramos pendências no seu CPF. Se acredita que há algum erro, ligue para (62) 98218-3144.`
              : `Desculpe, tive um problema ao consultar. Tente novamente ou ligue para (62) 98218-3144.`;
            resposta = await gerarRespostaHumana(
              debitosError
                ? `CONTEXTO: Erro ao consultar débitos do cliente ${dados.nome_candidato}. Peça desculpas e ofereça (62) 98218-3144.`
                : `CONTEXTO: O cliente ${dados.nome_candidato} confirmou identidade mas NÃO tem débitos. Dê a boa notícia.`,
              historico, fallback
            );
            dados = addToHistorico(dados, 'assistente', resposta);
            await supabase.from('chatbot_conversas').upsert({
              telefone, etapa: 'sem_debitos', dados: { ...dados, cpf },
              atualizado_em: new Date().toISOString(),
            }, { onConflict: 'telefone' });
            break;
          }

          const nomeDevedor = debitos[0].nome;
          const primeiroNome = nomeDevedor.split(' ')[0];
          const primeiroNomeCapitalizado = primeiroNome.charAt(0).toUpperCase() + primeiroNome.slice(1).toLowerCase();
          const totalContratos = debitos.length;
          const valorTotal = debitos.reduce((sum: number, d: any) => sum + Number(d.valor_atualizado), 0);
          const valorAvista = valorTotal * 0.5;
          const valorParcelado = valorTotal * 0.7;
          let maxParcelas = Math.floor(valorParcelado / VALOR_MINIMO_PARCELA);
          if (maxParcelas > 24) maxParcelas = 24;
          if (maxParcelas < 2) maxParcelas = 2;
          const valorParcelaMin = valorParcelado / maxParcelas;

          // Fetch credor name from devedores table
          const { data: devedorInfo } = await supabase
            .from('devedores')
            .select('credor')
            .eq('cpf', cpf)
            .eq('ativo', true)
            .limit(1)
            .single();
          
          // Map credor slug to display name
          let credorNome = 'a empresa credora';
          const credorSlug = devedorInfo?.credor || '';
          if (credorSlug.includes('novo_mundo') || credorSlug.includes('ume')) {
            credorNome = 'as Lojas Novo Mundo';
          } else if (credorSlug) {
            credorNome = credorSlug.replace(/_/g, ' ');
          }

          const { data: acordoExistente } = await supabase
            .rpc('consultar_acordo_ativo_por_cpf', { p_cpf: cpf });

          let avisoAcordo = '';
          if (acordoExistente && acordoExistente.length > 0) {
            const acordo = acordoExistente[0];
            avisoAcordo = ` ATENÇÃO: Já existe um acordo ${acordo.acordo_status} registrado por ${acordo.funcionario_nome}. Mencione brevemente.`;
          }

          const fallbackPropConf = `Perfeito, ${primeiroNomeCapitalizado}! A proposta disponível para *pagamento à vista é ${formatCurrency(valorAvista)}*, pagando esse valor, você quita todas as parcelas em aberto com ${credorNome}. Ou podemos parcelar para você da seguinte forma: *${maxParcelas}x de ${formatCurrency(valorParcelaMin)}*. Como fica melhor para você?`;
          resposta = applyTemplate(templates, 'proposta', { primeiro_nome: primeiroNomeCapitalizado, valor_avista: formatCurrency(valorAvista), valor_parcela: formatCurrency(valorParcelaMin), max_parcelas: String(maxParcelas), credor: credorNome, valor_parcelado: formatCurrency(valorParcelado), telefone_contato: '(62) 98218-3144' }, fallbackPropConf);

          dados = {
            ...dados, cpf, nome: nomeDevedor, valor_total: valorTotal,
            valor_avista: valorAvista, valor_parcelado: valorParcelado,
            max_parcelas: maxParcelas, total_contratos: totalContratos,
          };
          dados = addToHistorico(dados, 'assistente', resposta);

          await supabase.from('chatbot_conversas').upsert({
            telefone, etapa: 'proposta_enviada', dados,
            server_url: serverUrl, instance_token: instanceToken,
            atualizado_em: new Date().toISOString(),
          }, { onConflict: 'telefone' });
          break;

        } else if (isNegacao) {
          // Not the right person — fall back to CPF request
          const fallbackNeg = `Desculpe pelo engano! 😊 Me informe seu CPF para que eu possa consultar sua situação.`;
          resposta = applyTemplate(templates, 'negacao_identidade', {}, fallbackNeg);
          dados = { mensagens_historico: dados.mensagens_historico || [] };
          dados = addToHistorico(dados, 'assistente', resposta);
          await supabase.from('chatbot_conversas').upsert({
            telefone, etapa: 'aguardando_cpf', dados,
            server_url: serverUrl, instance_token: instanceToken,
            atualizado_em: new Date().toISOString(),
          }, { onConflict: 'telefone' });
          break;

        } else {
          // Unclear response
          const fallback = `Desculpe, não entendi. Você é *${dados.nome_candidato}*? Responda *sim* ou *não*.`;
          resposta = await gerarRespostaHumana(
            `CONTEXTO: Perguntei se o cliente é ${dados.nome_candidato} mas a resposta "${texto}" não ficou clara. Pergunte novamente de forma gentil se é ele(a) mesmo(a).`,
            historico, fallback
          );
          dados = addToHistorico(dados, 'assistente', resposta);
          await supabase.from('chatbot_conversas').upsert({
            telefone, etapa: 'aguardando_confirmacao_identidade', dados,
            atualizado_em: new Date().toISOString(),
          }, { onConflict: 'telefone' });
          break;
        }
      }

      case 'proposta_enviada': {
        // Use AI to interpret intent instead of strict "1" or "2"
        let escolha = textoLower === '1' ? 'avista' : textoLower === '2' ? 'parcelado' : null;
        
        if (!escolha) {
          const intencao = await interpretarIntencao(texto, ['avista', 'parcelado', 'nenhuma']);
          if (intencao?.includes('avista')) escolha = 'avista';
          else if (intencao?.includes('parcelado')) escolha = 'parcelado';
        }

        if (escolha === 'avista') {
          const cpf = dados.cpf;
          const valorFinal = dados.valor_avista;

          const fallbackEspera = `Ótima escolha! Vou preparar seu boleto de ${formatCurrency(valorFinal)} à vista. Um momento, por favor...`;
          resposta = await gerarRespostaHumana(
            `CONTEXTO: O cliente ${dados.nome} escolheu pagar À VISTA. Valor: ${formatCurrency(valorFinal)}. Confirme a escolha com entusiasmo e diga que está preparando o boleto. Peça para aguardar.`,
            historico, fallbackEspera
          );

          dados = addToHistorico(dados, 'assistente', resposta);
          await supabase.from('chatbot_conversas').upsert({
            telefone, etapa: 'gerando_boleto',
            dados: { ...dados, tipo_pagamento: 'avista', parcelas: 1, valor_final: valorFinal },
            atualizado_em: new Date().toISOString(),
          }, { onConflict: 'telefone' });

          await sendMessage(serverUrl, instanceToken, telefone, resposta);

          // Trigger robot
          try {
            const result = await triggerCobMaisRobot(supabase, cpf, valorFinal, 'avista', 1);

            if (result.success && result.resultado?.boleto_url) {
              const fallbackSucesso = `Boleto gerado! Acesse: ${result.resultado.boleto_url}\nValor: ${formatCurrency(valorFinal)}\nApós o pagamento, sua situação será regularizada. Dúvidas: (62) 98218-3144`;
              resposta = await gerarRespostaHumana(
                `CONTEXTO: Boleto gerado com SUCESSO para ${dados.nome}! Link do boleto: ${result.resultado.boleto_url}. Valor: ${formatCurrency(valorFinal)} à vista. Informe o link, parabenize pela decisão, diga que após pagamento a situação será regularizada. Ofereça (62) 98218-3144 para dúvidas. Diga que pode digitar "menu" para nova consulta.`,
                historico, fallbackSucesso
              );
            } else {
              const fallbackErro = `Não consegui gerar o boleto automaticamente. Por favor, ligue para (62) 98218-3144 — seu acordo de ${formatCurrency(valorFinal)} à vista já está pré-aprovado!`;
              resposta = await gerarRespostaHumana(
                `CONTEXTO: Não foi possível gerar o boleto automaticamente para ${dados.nome}. Valor: ${formatCurrency(valorFinal)} à vista. Oriente o cliente a ligar para (62) 98218-3144 para finalizar. Tranquilize que o acordo já está pré-aprovado. Diga que pode digitar "menu" para nova consulta.`,
                historico, fallbackErro
              );
            }
          } catch (err) {
            console.error('Erro ao gerar boleto:', err);
            resposta = `Tive um probleminha técnico para gerar o boleto. Mas não se preocupe! Ligue para (62) 98218-3144 que nosso time finaliza rapidinho pra você. 😊`;
          }

          dados = addToHistorico(dados, 'assistente', resposta);
          await supabase.from('chatbot_conversas').upsert({
            telefone, etapa: 'acordo_finalizado',
            dados: { ...dados, tipo_pagamento: 'avista', parcelas: 1, valor_final: valorFinal },
            atualizado_em: new Date().toISOString(),
          }, { onConflict: 'telefone' });
          break;

        } else if (escolha === 'parcelado') {
          const maxParcelas = dados.max_parcelas || 12;
          const valorParcelado = dados.valor_parcelado;

          const fallbackParcelas = `Você escolheu parcelar! Total: ${formatCurrency(valorParcelado)}. Em quantas vezes quer pagar? De 2 a ${maxParcelas}x (parcela mínima R$ 90,00).`;
          resposta = await gerarRespostaHumana(
            `CONTEXTO: O cliente ${dados.nome} escolheu PARCELAR. Valor total parcelado: ${formatCurrency(valorParcelado)}. Pergunte em quantas parcelas deseja (de 2 a ${maxParcelas}). Parcela mínima: R$ 90,00. Seja conversacional.`,
            historico, fallbackParcelas
          );

          dados = addToHistorico(dados, 'assistente', resposta);
          await supabase.from('chatbot_conversas').upsert({
            telefone, etapa: 'aguardando_parcelas',
            dados: { ...dados, tipo_pagamento: 'parcelado' },
            atualizado_em: new Date().toISOString(),
          }, { onConflict: 'telefone' });
          break;

        } else {
          // AI couldn't determine intent — ask again naturally
          const fallbackDuvida = `Desculpe, não entendi. Responda com 1 para pagar à vista ou 2 para parcelar. Ou digite "menu" para reiniciar.`;
          resposta = await gerarRespostaHumana(
            `CONTEXTO: O cliente ${dados.nome} respondeu "${texto}" mas não ficou claro se quer pagar à vista ou parcelar. As opções são:
- Opção 1 - À vista: ${formatCurrency(dados.valor_avista)}
- Opção 2 - Parcelado: ${formatCurrency(dados.valor_parcelado)} em até ${dados.max_parcelas}x
Peça gentilmente que escolha uma opção, reforçando os valores. Pode digitar "menu" para reiniciar.`,
            historico, fallbackDuvida
          );
          dados = addToHistorico(dados, 'assistente', resposta);
          await supabase.from('chatbot_conversas').upsert({
            telefone, etapa: 'proposta_enviada', dados,
            atualizado_em: new Date().toISOString(),
          }, { onConflict: 'telefone' });
          break;
        }
      }

      case 'aguardando_parcelas': {
        const numParcelas = parseInt(texto.trim());
        const maxParcelas = dados.max_parcelas || 12;
        const valorParcelado = dados.valor_parcelado;

        if (isNaN(numParcelas) || numParcelas < 2 || numParcelas > maxParcelas) {
          const fallbackInvalido = `Número de parcelas inválido. Escolha entre 2 e ${maxParcelas}x (parcela mínima R$ 90,00).`;
          resposta = await gerarRespostaHumana(
            `CONTEXTO: O cliente respondeu "${texto}" mas não é um número válido de parcelas. Aceito entre 2 e ${maxParcelas}. Valor total: ${formatCurrency(valorParcelado)}. Parcela mínima R$ 90,00. Oriente gentilmente.`,
            historico, fallbackInvalido
          );
          dados = addToHistorico(dados, 'assistente', resposta);
          await supabase.from('chatbot_conversas').upsert({
            telefone, etapa: 'aguardando_parcelas', dados,
            atualizado_em: new Date().toISOString(),
          }, { onConflict: 'telefone' });
          break;
        }

        const valorParcela = valorParcelado / numParcelas;
        if (valorParcela < VALOR_MINIMO_PARCELA) {
          const maxPossivel = Math.floor(valorParcelado / VALOR_MINIMO_PARCELA);
          const fallbackMin = `Com ${numParcelas}x a parcela ficaria ${formatCurrency(valorParcela)}, abaixo do mínimo. O máximo é ${maxPossivel}x de ${formatCurrency(valorParcelado / maxPossivel)}.`;
          resposta = await gerarRespostaHumana(
            `CONTEXTO: O cliente pediu ${numParcelas}x mas a parcela ficaria ${formatCurrency(valorParcela)}, abaixo do mínimo de R$ 90,00. O máximo possível é ${maxPossivel}x de ${formatCurrency(valorParcelado / maxPossivel)}. Explique de forma gentil e sugira o máximo.`,
            historico, fallbackMin
          );
          dados = addToHistorico(dados, 'assistente', resposta);
          await supabase.from('chatbot_conversas').upsert({
            telefone, etapa: 'aguardando_parcelas', dados,
            atualizado_em: new Date().toISOString(),
          }, { onConflict: 'telefone' });
          break;
        }

        const valorFinal = valorParcelado;
        const cpf = dados.cpf;

        const fallbackConfirma = `Perfeito! Acordo em ${numParcelas}x de ${formatCurrency(valorParcela)}. Estou gerando seu boleto, aguarde...`;
        resposta = await gerarRespostaHumana(
          `CONTEXTO: O cliente ${dados.nome} confirmou ${numParcelas}x de ${formatCurrency(valorParcela)} (total ${formatCurrency(valorFinal)}). Confirme com entusiasmo e diga que está preparando o boleto. Peça para aguardar.`,
          historico, fallbackConfirma
        );

        dados = { ...dados, parcelas: numParcelas, valor_final: valorFinal, valor_parcela: valorParcela };
        dados = addToHistorico(dados, 'assistente', resposta);
        await supabase.from('chatbot_conversas').upsert({
          telefone, etapa: 'gerando_boleto', dados,
          atualizado_em: new Date().toISOString(),
        }, { onConflict: 'telefone' });

        await sendMessage(serverUrl, instanceToken, telefone, resposta);

        try {
          const result = await triggerCobMaisRobot(supabase, cpf, valorFinal, 'parcelado', numParcelas);

          if (result.success && result.resultado?.boleto_url) {
            const fallbackBoleto = `Acordo gerado! Boleto da 1ª parcela: ${result.resultado.boleto_url}\n${numParcelas}x de ${formatCurrency(valorParcela)}. Próximos boletos serão enviados mensalmente. Dúvidas: (62) 98218-3144`;
            resposta = await gerarRespostaHumana(
              `CONTEXTO: Boleto da 1ª parcela gerado com sucesso para ${dados.nome}! Link: ${result.resultado.boleto_url}. Acordo: ${numParcelas}x de ${formatCurrency(valorParcela)}, total ${formatCurrency(valorFinal)}. Informe o link, diga que os próximos boletos virão mensalmente. Parabenize e ofereça (62) 98218-3144. Diga que pode digitar "menu" para nova consulta.`,
              historico, fallbackBoleto
            );
          } else {
            const fallbackErro = `Não consegui gerar o boleto automaticamente. Ligue para (62) 98218-3144 — seu acordo de ${numParcelas}x de ${formatCurrency(valorParcela)} já está pré-aprovado!`;
            resposta = await gerarRespostaHumana(
              `CONTEXTO: Não foi possível gerar o boleto automaticamente para ${dados.nome}. Acordo: ${numParcelas}x de ${formatCurrency(valorParcela)}. Oriente a ligar para (62) 98218-3144. O acordo já está pré-aprovado. Diga que pode digitar "menu" para nova consulta.`,
              historico, fallbackErro
            );
          }
        } catch (err) {
          console.error('Erro ao gerar boleto parcelado:', err);
          resposta = `Tive um probleminha técnico, mas seu acordo está garantido! Ligue para (62) 98218-3144 que finalizamos rapidinho. 😊`;
        }

        dados = addToHistorico(dados, 'assistente', resposta);
        await supabase.from('chatbot_conversas').upsert({
          telefone, etapa: 'acordo_finalizado', dados,
          atualizado_em: new Date().toISOString(),
        }, { onConflict: 'telefone' });
        break;
      }

      case 'gerando_boleto': {
        const fallback = `Seu boleto ainda está sendo gerado, por favor aguarde mais um pouquinho. Se demorar muito, ligue para (62) 98218-3144.`;
        resposta = await gerarRespostaHumana(
          `CONTEXTO: O cliente mandou mensagem enquanto o boleto ainda está sendo gerado. Peça paciência gentilmente. Se já faz mais de 3 minutos, sugira ligar para (62) 98218-3144.`,
          historico, fallback
        );
        dados = addToHistorico(dados, 'assistente', resposta);
        await supabase.from('chatbot_conversas').upsert({
          telefone, etapa: 'gerando_boleto', dados,
          atualizado_em: new Date().toISOString(),
        }, { onConflict: 'telefone' });
        break;
      }

      case 'acordo_finalizado':
      case 'sem_debitos': {
        const fallback = `Para uma nova consulta, digite "menu". Para falar com um negociador: (62) 98218-3144.`;
        resposta = await gerarRespostaHumana(
          `CONTEXTO: O cliente já finalizou a negociação ou não tinha débitos, e está mandando uma nova mensagem ("${texto}"). Responda de forma amigável. Se quiser recomeçar, pode digitar "menu". Para falar com humano: (62) 98218-3144.`,
          historico, fallback
        );
        dados = addToHistorico(dados, 'assistente', resposta);
        await supabase.from('chatbot_conversas').upsert({
          telefone, etapa: etapaAtual, dados,
          atualizado_em: new Date().toISOString(),
        }, { onConflict: 'telefone' });
        break;
      }

      default: {
        const fallback = `Olá! Sou a Ana, da Souza e Ribeiro Negociações. Para consultar sua situação financeira, me informe seu CPF.`;
        resposta = await gerarRespostaHumana(
          `CONTEXTO: Nova conversa ou estado desconhecido. Cumprimente e peça o CPF para consulta.`,
          historico, fallback
        );
        dados = addToHistorico(dados, 'assistente', resposta);
        await supabase.from('chatbot_conversas').upsert({
          telefone, etapa: 'aguardando_cpf', dados: {},
          atualizado_em: new Date().toISOString(),
        }, { onConflict: 'telefone' });
      }
    }

    // Send response
    if (resposta) {
      const delayMs = (Math.floor(Math.random() * 16) + 15) * 1000; // 15-30 seg
      console.log(`Simulando digitação por ${delayMs / 1000}s antes de responder ${telefone}...`);
      await simulateTyping(serverUrl, instanceToken, telefone, delayMs);
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

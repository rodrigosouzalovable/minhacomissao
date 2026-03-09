import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const VALOR_MINIMO_PARCELA = 100;

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function gerarListaParcelamento(valorParcelado: number): string {
  const linhas: string[] = [];
  for (let i = 2; i <= 24; i++) {
    const valorParcela = valorParcelado / i;
    if (valorParcela < VALOR_MINIMO_PARCELA) break;
    linhas.push(`${i}x de *${formatCurrency(Math.ceil(valorParcela * 100) / 100)}*`);
  }
  return linhas.join('\n');
}

function gerarMensagemProposta(valorAvista: number, valorParcelado: number): string {
  const listaParcelamento = gerarListaParcelamento(valorParcelado);
  let msg = `Que ótimo! 🎉\n\nEstamos com uma super oportunidade para você quitar todo débito em aberto pelo valor de *${formatCurrency(valorAvista)}* à vista.`;
  if (listaParcelamento) {
    msg += `\n\nOu podemos parcelar para você da seguinte forma:\n\n${listaParcelamento}`;
  }
  msg += `\n\nComo prefere pagar? Responda com o número de parcelas desejado (ex: *3x*) ou *à vista*.`;
  return msg;
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

async function simulateTyping(serverUrl: string, instanceToken: string, telefone: string, durationMs: number) {
  const cleanUrl = serverUrl.replace(/\/+$/, '');
  const endpoints = [`${cleanUrl}/chat/presence`, `${cleanUrl}/chatState`];
  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'token': instanceToken },
        body: JSON.stringify({ number: telefone, state: 'composing' }),
      });
      if (res.ok) break;
    } catch (e) { console.log(`Presença falhou: ${url}`, e); }
  }
  await new Promise(r => setTimeout(r, durationMs));
}

async function sendMessage(serverUrl: string, instanceToken: string, telefone: string, mensagem: string) {
  const cleanUrl = serverUrl.replace(/\/+$/, '');
  const endpoints = [`${cleanUrl}/message/sendText`, `${cleanUrl}/sendText`, `${cleanUrl}/send/text`];
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
    } catch (e) { lastError = e; }
  }
  throw new Error(lastError?.message || 'Falha ao enviar mensagem UAZAPI');
}

async function transcreverAudio(audioUrl: string): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY não configurada');

  console.log('[AUDIO] Baixando áudio de:', audioUrl);
  const audioResponse = await fetch(audioUrl);
  if (!audioResponse.ok) throw new Error(`Falha ao baixar áudio: ${audioResponse.status}`);

  const audioBuffer = await audioResponse.arrayBuffer();
  const audioBytes = new Uint8Array(audioBuffer);
  
  // Converter para base64
  let binary = '';
  for (let i = 0; i < audioBytes.length; i++) {
    binary += String.fromCharCode(audioBytes[i]);
  }
  const audioBase64 = btoa(binary);
  console.log('[AUDIO] Áudio convertido para base64, tamanho:', audioBase64.length);

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        {
          role: 'system',
          content: 'Você é um transcritor de áudio. Transcreva o áudio fornecido em texto. Retorne APENAS o texto transcrito, sem explicações ou formatação adicional. Se o áudio estiver em português, mantenha em português.',
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Transcreva o seguinte áudio para texto:' },
            { type: 'input_audio', input_audio: { data: audioBase64, format: 'wav' } },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[AUDIO] Erro AI Gateway:', response.status, errorText);
    throw new Error(`AI gateway error: ${response.status}`);
  }

  const result = await response.json();
  const transcribed = (result.choices?.[0]?.message?.content || '').trim();
  
  if (!transcribed) throw new Error('Transcrição vazia');
  
  console.log('[AUDIO] Transcrição concluída:', transcribed);
  return transcribed;
}

const ADMIN_NUMERO = '5562991672674';

function isAdminNumber(tel: string): boolean {
  const normalized = tel.replace(/\D/g, '');
  return normalized === '5562991672674' || normalized === '62991672674';
}

function parseAdminInstruction(texto: string): { literal: boolean; conteudo: string } {
  // Check for text wrapped in quotes (both regular and smart quotes)
  const match = texto.match(/^[""\u201C](.+)[""\u201D]$/s);
  if (match) return { literal: true, conteudo: match[1].trim() };
  return { literal: false, conteudo: texto.trim() };
}

async function gerarRespostaComInstrucaoAdmin(instrucao: string, contextoConversa: any): Promise<string> {
  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) return instrucao;

    const historico = contextoConversa?.mensagens_historico || [];
    const historicoTexto = historico.slice(-10).map((m: any) => `${m.role}: ${m.content}`).join('\n');
    const nomeCliente = contextoConversa?.nome || 'cliente';
    const primeiroNome = nomeCliente.split(' ')[0];

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [
          {
            role: 'system',
            content: `Você é um assistente de cobrança amigável e profissional. O administrador Rodrigo está instruindo como responder ao cliente ${primeiroNome}. 
Gere uma resposta natural e amigável para o cliente baseada na instrução do administrador.
Mantenha o tom informal e cordial. Não mencione o administrador. Responda APENAS com a mensagem para o cliente, sem explicações.`
          },
          {
            role: 'user',
            content: `Contexto da conversa:\n${historicoTexto}\n\nInstrução do administrador: "${instrucao}"\n\nGere a resposta para o cliente:`
          },
        ],
        max_tokens: 300,
        temperature: 0.7,
      }),
    });
    if (!response.ok) return instrucao;
    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || instrucao;
  } catch {
    return instrucao;
  }
}

async function notificarAdmin(serverUrl: string, instanceToken: string, telefoneCliente: string, telefoneInstancia: string, textoCliente: string) {
  try {
    const msg = `Olá Rodrigo, na mensagem enviada pelo número ${telefoneInstancia} para o número ${telefoneCliente}, o cliente respondeu algo que eu não soube informar: "${textoCliente}". Você poderia analisar por favor?`;
    console.log(`[ADMIN] Notificando admin: ${msg}`);
    await sendMessage(serverUrl, instanceToken, ADMIN_NUMERO, msg);
  } catch (e) {
    console.error('[ADMIN] Falha ao notificar admin:', e);
  }
}

async function notificarAcordoFechado(serverUrl: string, instanceToken: string, telefoneCliente: string, dados: any) {
  try {
    const nomeCliente = dados.nome || 'cliente';
    const primeiroNome = nomeCliente.split(' ')[0];
    const tipo = dados.tipo_pagamento;
    const dataPgto = dados.data_pagamento || 'hoje';

    let detalhes = '';
    if (tipo === 'avista') {
      const valor = Number(dados.valor_final || dados.valor_avista);
      detalhes = `à vista por ${formatCurrency(valor)}`;
    } else {
      const parcelas = Number(dados.parcelas || dados.max_parcelas);
      const valorTotal = Number(dados.valor_final || dados.valor_parcelado);
      const valorParcela = valorTotal / parcelas;
      detalhes = `em ${parcelas}x de ${formatCurrency(valorParcela)}`;
    }

    const telefoneFormatado = telefoneCliente.replace(/^55/, '');
    const msg = `Rodrigo, acabei de fechar um acordo com o cliente ${primeiroNome}, número ${telefoneFormatado}, ${detalhes}, para pagamento ${dataPgto}.`;
    console.log(`[ACORDO] Notificando admin: ${msg}`);
    await sendMessage(serverUrl, instanceToken, ADMIN_NUMERO, msg);
  } catch (e) {
    console.error('[ACORDO] Falha ao notificar admin sobre acordo:', e);
  }
}

// AI only for INTENT interpretation — never for composing responses
async function extrairGatilho(mensagemCliente: string): Promise<string> {
  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) return mensagemCliente.toLowerCase().slice(0, 50);
    
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [
          { 
            role: 'system', 
            content: `Você extrai palavras-chave (gatilho) de mensagens de clientes. Responda APENAS com 1-4 palavras-chave em minúsculas, sem pontuação.
Exemplos:
"Vou ver aqui" -> "vou ver"
"Não sei se consigo" -> "não sei se consigo"
"Preciso pensar melhor" -> "preciso pensar"`
          },
          { role: 'user', content: `Extraia o gatilho: "${mensagemCliente}"` },
        ],
        max_tokens: 30,
        temperature: 0,
      }),
    });
    
    if (!response.ok) return mensagemCliente.toLowerCase().slice(0, 50);
    const data = await response.json();
    return (data.choices?.[0]?.message?.content?.trim()?.toLowerCase() || mensagemCliente.toLowerCase()).slice(0, 50);
  } catch {
    return mensagemCliente.toLowerCase().slice(0, 50);
  }
}

async function registrarAprendizado(
  supabase: any,
  mensagemCliente: string,
  respostaConfirmada: string,
  contexto: any
): Promise<string> {
  try {
    // Extrair gatilho usando IA
    const gatilho = await extrairGatilho(mensagemCliente);
    
    // Criar template com variáveis
    let respostaTemplate = respostaConfirmada;
    
    // Substituir nome do cliente por variável
    if (contexto?.nome) {
      const primeiroNome = contexto.nome.split(' ')[0];
      const regex = new RegExp(`\\b${primeiroNome}\\b`, 'gi');
      respostaTemplate = respostaTemplate.replace(regex, '{primeiro_nome}');
    }
    
    // Substituir valores monetários por variáveis se existirem no contexto
    if (contexto?.valor_avista) {
      const valorFormatado = formatCurrency(contexto.valor_avista);
      respostaTemplate = respostaTemplate.replace(valorFormatado, '{valor_avista}');
    }
    if (contexto?.valor_parcelado) {
      const valorFormatado = formatCurrency(contexto.valor_parcelado);
      respostaTemplate = respostaTemplate.replace(valorFormatado, '{valor_parcelado}');
    }
    
    // Inserir regra no banco de dados
    const { error } = await supabase
      .from('chatbot_regras')
      .insert({
        gatilho: gatilho,
        resposta: respostaTemplate,
        ativo: true
      });
    
    if (error) {
      console.error('[APRENDIZADO] Erro ao criar regra:', error);
      return gatilho;
    }
    
    console.log(`[APRENDIZADO] Nova regra criada: gatilho="${gatilho}" -> resposta="${respostaTemplate}"`);
    return gatilho;
  } catch (e) {
    console.error('[APRENDIZADO] Erro:', e);
    return mensagemCliente.slice(0, 30);
  }
}

async function interpretarIntencao(texto: string, opcoes: string[]): Promise<string | null> {
  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) return null;
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [
          { role: 'system', content: `Hoje é ${new Date().toLocaleDateString('pt-BR')}. Você interpreta a intenção do cliente em uma negociação de dívida. Responda APENAS com uma das opções listadas.` },
          { role: 'user', content: `O cliente disse: "${texto}"\n\nOpções: ${opcoes.join(', ')}\n\nResponda APENAS com uma das opções, ou "nenhuma".` },
        ],
        max_tokens: 30,
        temperature: 0,
      }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim()?.toLowerCase() || null;
  } catch { return null; }
}

// Extract a date from text like "dia 15", "15/03", "amanha", "segunda"
function extrairData(texto: string): Date | null {
  const hoje = new Date();
  const textoLower = texto.toLowerCase().trim();

  // "hoje"
  if (textoLower.includes('hoje')) return hoje;

  // "amanhã" / "amanha"
  if (textoLower.includes('amanh')) {
    const d = new Date(hoje);
    d.setDate(d.getDate() + 1);
    return d;
  }

  // Days of week
  const diasSemana: Record<string, number> = {
    'domingo': 0, 'segunda': 1, 'terça': 2, 'terca': 2, 'quarta': 3,
    'quinta': 4, 'sexta': 5, 'sábado': 6, 'sabado': 6,
  };
  for (const [nome, dow] of Object.entries(diasSemana)) {
    if (textoLower.includes(nome)) {
      const d = new Date(hoje);
      let diff = dow - d.getDay();
      if (diff <= 0) diff += 7;
      d.setDate(d.getDate() + diff);
      return d;
    }
  }

  // "dia X" or just a number 1-31
  const diaMatch = textoLower.match(/dia\s*(\d{1,2})/);
  if (diaMatch) {
    const dia = parseInt(diaMatch[1]);
    if (dia >= 1 && dia <= 31) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth(), dia);
      if (d < hoje) d.setMonth(d.getMonth() + 1);
      return d;
    }
  }

  // DD/MM or DD/MM/YYYY
  const dataMatch = textoLower.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/);
  if (dataMatch) {
    const dia = parseInt(dataMatch[1]);
    const mes = parseInt(dataMatch[2]) - 1;
    const ano = dataMatch[3] ? (dataMatch[3].length === 2 ? 2000 + parseInt(dataMatch[3]) : parseInt(dataMatch[3])) : hoje.getFullYear();
    const d = new Date(ano, mes, dia);
    if (!isNaN(d.getTime())) return d;
  }

  return null;
}

function diffDias(a: Date, b: Date): number {
  const msPerDay = 86400000;
  const aStart = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const bStart = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((bStart.getTime() - aStart.getTime()) / msPerDay);
}

function formatDataBR(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function addToHistorico(dados: any, role: string, content: string): any {
  const historico = dados?.mensagens_historico || [];
  historico.push({ role, content, ts: new Date().toISOString() });
  return { ...dados, mensagens_historico: historico.slice(-20) };
}

function getCredorNome(credorSlug: string): string {
  if (!credorSlug) return 'a empresa credora';
  if (credorSlug.includes('novo_mundo') || credorSlug.includes('ume')) return 'a Loja Novo Mundo';
  return credorSlug.replace(/_/g, ' ');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    console.log('Webhook recebido:', JSON.stringify(payload));

    // --- Deduplicação ---
    const messageId = payload?.message?.id || payload?.key?.id || payload?.messageId || '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (messageId) {
      const { data: existente } = await supabase
        .from('chatbot_conversas')
        .select('dados')
        .eq('telefone', '__dedup_' + messageId)
        .maybeSingle();
      if (existente) {
        console.log(`[DEDUP] ${messageId} já processada.`);
        return new Response(JSON.stringify({ success: true, ignored: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      await supabase.from('chatbot_conversas').upsert({
        telefone: '__dedup_' + messageId, etapa: 'dedup',
        dados: { processed_at: new Date().toISOString() },
        atualizado_em: new Date().toISOString(),
      }, { onConflict: 'telefone' });
    }

    // --- Filtros básicos ---
    const isFromMe = payload?.message?.fromMe ?? payload?.fromMe ?? payload?.key?.fromMe ?? false;
    const remoteJid = payload?.message?.chatid || payload?.chat?.wa_chatid || payload?.message?.sender_pn || payload?.key?.remoteJid || payload?.from || '';
    const isGroup = payload?.message?.isGroup ?? payload?.chat?.wa_isGroup ?? remoteJid.includes('@g.us') ?? false;

    if (isGroup) {
      return new Response(JSON.stringify({ success: true, ignored: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // --- Track fromMe messages (outbound proposals) ---
    if (isFromMe) {
      const textoFromMe = (payload?.message?.text || payload?.body || payload?.text || payload?.message?.body || payload?.message?.conversation || payload?.message?.extendedTextMessage?.text || payload?.message?.content?.text || '').trim();
      const textoFromMeLower = textoFromMe.toLowerCase();
      const destinoTelefone = remoteJid.replace('@s.whatsapp.net', '').replace('@c.us', '').replace(/\D/g, '');

      // --- DESBLOQUEIO + ATENDIMENTO HUMANO ---
      if (destinoTelefone) {
        const supabaseUrlFm = Deno.env.get('SUPABASE_URL')!;
        const supabaseKeyFm = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabaseFm = createClient(supabaseUrlFm, supabaseKeyFm);

        const { data: convAguardando } = await supabaseFm
          .from('chatbot_conversas')
          .select('etapa, dados')
          .eq('telefone', destinoTelefone)
          .maybeSingle();

        if (convAguardando?.etapa === 'aguardando_humano') {
          const etapaAnterior = convAguardando.dados?.etapa_antes_humano || 'novo';
          console.log(`[UNLOCK] Admin respondeu para ${destinoTelefone}, desbloqueando de aguardando_humano -> ${etapaAnterior}`);
          const dadosDesbloq = { ...convAguardando.dados };
          delete dadosDesbloq.etapa_antes_humano;
          await supabaseFm.from('chatbot_conversas').upsert({
            telefone: destinoTelefone,
            etapa: etapaAnterior,
            dados: dadosDesbloq,
            atualizado_em: new Date().toISOString(),
          }, { onConflict: 'telefone' });
        }

        // --- ATENDIMENTO HUMANO: Qualquer mensagem manual pausa o bot por 30 min ---
        const etapaAtualConv = convAguardando?.etapa || 'novo';
        const dadosAtuais = convAguardando?.dados || {};
        // Só marca atendimento_humano se NÃO for proposta (proposta tem lógica própria abaixo)
        if (!textoFromMeLower.includes('50% de desconto') && !textoFromMeLower.includes('parcelas em aberto')) {
          console.log(`[HUMAN] Mensagem manual detectada para ${destinoTelefone}, pausando bot por 30min`);
          const etapaParaSalvar = etapaAtualConv === 'atendimento_humano' 
            ? 'atendimento_humano' 
            : 'atendimento_humano';
          const etapaAnteriorParaSalvar = etapaAtualConv === 'atendimento_humano'
            ? (dadosAtuais.etapa_antes_humano || 'novo')
            : etapaAtualConv;
          
          await supabaseFm.from('chatbot_conversas').upsert({
            telefone: destinoTelefone,
            etapa: 'atendimento_humano',
            dados: {
              ...dadosAtuais,
              atendimento_humano_em: new Date().toISOString(),
              etapa_antes_humano: etapaAnteriorParaSalvar,
            },
            atualizado_em: new Date().toISOString(),
          }, { onConflict: 'telefone' });
        }

        // --- Proposta detection (existing logic) ---
        if (textoFromMeLower.includes('50% de desconto') || textoFromMeLower.includes('parcelas em aberto')) {
          console.log(`[fromMe] Proposta detectada para ${destinoTelefone}, atualizando estado...`);

          const serverUrlFm = payload?.BaseUrl?.replace(/\/+$/, '') || Deno.env.get('UAZAPI_SERVER_URL');
          const instanceTokenFm = payload?.token || Deno.env.get('UAZAPI_INSTANCE_TOKEN');

          const phoneSuffix = destinoTelefone.slice(-10);
          const phoneSuffix11 = destinoTelefone.slice(-11);

          // Find debtor by phone
          let devedoresEncontrados: any[] = [];
          const { data: devPorTel } = await supabaseFm
            .from('devedores')
            .select('nome, cpf, telefone, valor_atualizado, credor')
            .eq('ativo', true)
            .or(`telefone.ilike.%${phoneSuffix},telefone.ilike.%${phoneSuffix11}`);
          devedoresEncontrados = devPorTel || [];

          if (devedoresEncontrados.length === 0) {
            const { data: telsAdicionais } = await supabaseFm
              .from('devedor_telefones')
              .select('devedor_cpf, numero')
              .eq('ativo', true)
              .or(`numero.ilike.%${phoneSuffix},numero.ilike.%${phoneSuffix11}`);
            if (telsAdicionais && telsAdicionais.length > 0) {
              const cpfsUnicos = [...new Set(telsAdicionais.map((t: any) => t.devedor_cpf))];
              const { data: devPorCpf } = await supabaseFm
                .from('devedores')
                .select('nome, cpf, telefone, valor_atualizado, credor')
                .eq('ativo', true)
                .in('cpf', cpfsUnicos);
              if (devPorCpf) devedoresEncontrados = devPorCpf;
            }
          }

          // Check if pre-hydrated data exists BEFORE deciding to use DB values
          const { data: existingPreHydrated } = await supabaseFm
            .from('chatbot_conversas')
            .select('dados')
            .eq('telefone', destinoTelefone)
            .maybeSingle();

          const preHydrated = existingPreHydrated?.dados;
          const hasPreHydration = preHydrated?.valor_total && preHydrated?.valor_avista;

          if (hasPreHydration) {
            console.log(`[fromMe] Pre-hydrated data found for ${destinoTelefone}: valor_total=${preHydrated.valor_total}, preserving spreadsheet values`);
            await supabaseFm.from('chatbot_conversas').upsert({
              telefone: destinoTelefone,
              etapa: 'proposta_enviada',
              dados: {
                ...preHydrated,
                mensagens_historico: [{ role: 'assistente', content: textoFromMe, ts: new Date().toISOString() }],
              },
              server_url: serverUrlFm, instance_token: instanceTokenFm,
              atualizado_em: new Date().toISOString(),
            }, { onConflict: 'telefone' });
            console.log(`[fromMe] Estado definido como proposta_enviada para ${destinoTelefone} (dados da planilha preservados)`);
          } else if (devedoresEncontrados.length > 0) {
            const devedor = devedoresEncontrados[0];
            const cpf = devedor.cpf.replace(/\D/g, '');
            const valorTotal = devedoresEncontrados
              .filter((d: any) => d.cpf.replace(/\D/g, '') === cpf)
              .reduce((sum: number, d: any) => sum + Number(d.valor_atualizado), 0);
            const valorAvista = valorTotal * 0.5;
            const valorParcelado = valorTotal * 0.7;
            let maxParcelas = Math.floor(valorParcelado / VALOR_MINIMO_PARCELA);
            if (maxParcelas > 24) maxParcelas = 24;
            if (maxParcelas < 2) maxParcelas = 2;
            const credorNome = getCredorNome(devedor.credor || '');

            await supabaseFm.from('chatbot_conversas').upsert({
              telefone: destinoTelefone,
              etapa: 'proposta_enviada',
              dados: {
                cpf, nome: devedor.nome, valor_total: valorTotal,
                valor_avista: valorAvista, valor_parcelado: valorParcelado,
                max_parcelas: maxParcelas, credor: credorNome,
                mensagens_historico: [{ role: 'assistente', content: textoFromMe, ts: new Date().toISOString() }],
              },
              server_url: serverUrlFm, instance_token: instanceTokenFm,
              atualizado_em: new Date().toISOString(),
            }, { onConflict: 'telefone' });
            console.log(`[fromMe] Estado definido como proposta_enviada para ${destinoTelefone} (CPF: ${cpf})`);
          } else {
            const { data: existingConv } = await supabaseFm
              .from('chatbot_conversas')
              .select('dados')
              .eq('telefone', destinoTelefone)
              .maybeSingle();

            const existingDados = existingConv?.dados || {};
            const newDados = {
              ...existingDados,
              mensagens_historico: [{ role: 'assistente', content: textoFromMe, ts: new Date().toISOString() }],
            };

            await supabaseFm.from('chatbot_conversas').upsert({
              telefone: destinoTelefone,
              etapa: 'proposta_enviada',
              dados: newDados,
              server_url: serverUrlFm, instance_token: instanceTokenFm,
              atualizado_em: new Date().toISOString(),
            }, { onConflict: 'telefone' });
            console.log(`[fromMe] Proposta detectada para ${destinoTelefone} (devedor não no banco) - estado resetado para proposta_enviada`);
          }
        }
      }

      return new Response(JSON.stringify({ success: true, ignored: true, tracked: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const telefone = remoteJid.replace('@s.whatsapp.net', '').replace('@c.us', '').replace(/\D/g, '');
    let texto = (payload?.message?.text || payload?.body || payload?.text || payload?.message?.body || payload?.message?.conversation || payload?.message?.extendedTextMessage?.text || payload?.message?.content?.text || '').trim();

    // Se não tem texto, verificar se é áudio e transcrever
    if (!texto) {
      const audioUrl = payload?.message?.mediaUrl 
        || payload?.message?.audioMessage?.url 
        || payload?.message?.audio?.url
        || payload?.mediaUrl
        || payload?.message?.audioMessage?.mediaUrl;

      if (audioUrl) {
        console.log(`Áudio detectado de ${telefone}, URL: ${audioUrl}`);
        try {
          texto = await transcreverAudio(audioUrl);
          console.log(`Transcrição do áudio de ${telefone}: "${texto}"`);
        } catch (err) {
          console.error(`Erro ao transcrever áudio de ${telefone}:`, err);
          // Responder pedindo texto
          const sUrl = payload?.BaseUrl?.replace(/\/+$/, '') || Deno.env.get('UAZAPI_SERVER_URL');
          const iTok = payload?.token || Deno.env.get('UAZAPI_INSTANCE_TOKEN');
          if (sUrl && iTok) {
            await sendMessage(sUrl, iTok, telefone, 'Desculpe, não consegui ouvir seu áudio. Pode digitar sua resposta, por favor?');
          }
          return new Response(JSON.stringify({ success: true, audio_error: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
    }

    if (!telefone || !texto) {
      return new Response(JSON.stringify({ success: true, ignored: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Mensagem de ${telefone}: "${texto}"`);

    // --- INTERCEPTAÇÃO: Admin respondendo instrução para cliente pendente ---
    if (isAdminNumber(telefone)) {
      const instanceTokenAdmin = payload?.token || Deno.env.get('UAZAPI_INSTANCE_TOKEN');
      const serverUrlAdmin = payload?.BaseUrl?.replace(/\/+$/, '') || Deno.env.get('UAZAPI_SERVER_URL');

      if (instanceTokenAdmin) {
        const pendingKey = `admin_pending_${instanceTokenAdmin}`;
        const { data: pendingRecord } = await supabase
          .from('chatbot_conversas')
          .select('dados')
          .eq('telefone', pendingKey)
          .eq('etapa', 'admin_pending')
          .maybeSingle();

        if (pendingRecord?.dados) {
          const dados = pendingRecord.dados as any;
          
          // CASO 1: Aguardando confirmação
          if (dados.aguardando_confirmacao) {
            const confirmacoes = ['sim', 'ok', 'confirmo', 'confirmar', 'pode enviar', 'tudo certo', 'perfeito', 'pode'];
            const negacoes = ['não', 'nao', 'cancela', 'cancelar', 'espera', 'aguarda', 'refaz', 'muda'];
            const textoLower = texto.toLowerCase();
            
            // Confirmação positiva
            if (confirmacoes.some(c => textoLower.includes(c))) {
              const clienteTelefone = dados.cliente_telefone;
              const clienteServerUrl = dados.server_url || serverUrlAdmin;
              const clienteInstanceToken = dados.instance_token || instanceTokenAdmin;
              const respostaProposta = dados.resposta_proposta;
              
              console.log(`[ADMIN-CONFIRM] Admin confirmou envio para ${clienteTelefone}: "${respostaProposta}"`);
              
              // Enviar mensagem ao cliente com simulação de digitação
              const delay = Math.floor(Math.random() * 10000) + 5000;
              await simulateTyping(clienteServerUrl, clienteInstanceToken, clienteTelefone, delay);
              await sendMessage(clienteServerUrl, clienteInstanceToken, clienteTelefone, respostaProposta);
              
              // Registrar aprendizado
              const mensagemOriginalCliente = dados.mensagem_original_cliente || '';
              const gatilhoAprendido = await registrarAprendizado(
                supabase,
                mensagemOriginalCliente,
                respostaProposta,
                dados.contexto || {}
              );
              
              // Desbloquear conversa do cliente
              const { data: clienteConv } = await supabase
                .from('chatbot_conversas')
                .select('etapa, dados')
                .eq('telefone', clienteTelefone)
                .maybeSingle();

              if (clienteConv?.etapa === 'aguardando_humano') {
                const etapaAnterior = (clienteConv.dados as any)?.etapa_antes_humano || 'proposta_enviada';
                const dadosCliente = clienteConv.dados || {};
                const dadosDesbloq = { ...(dadosCliente as any) };
                delete dadosDesbloq.etapa_antes_humano;
                const historico = dadosDesbloq.mensagens_historico || [];
                historico.push({ role: 'assistente', content: respostaProposta, ts: new Date().toISOString() });
                dadosDesbloq.mensagens_historico = historico.slice(-20);

                await supabase.from('chatbot_conversas').upsert({
                  telefone: clienteTelefone,
                  etapa: etapaAnterior,
                  dados: dadosDesbloq,
                  atualizado_em: new Date().toISOString(),
                }, { onConflict: 'telefone' });
                console.log(`[ADMIN-CONFIRM] Cliente ${clienteTelefone} desbloqueado: aguardando_humano -> ${etapaAnterior}`);
              }
              
              // Limpar registro pendente
              await supabase.from('chatbot_conversas').delete().eq('telefone', pendingKey);
              
              // Confirmar ao admin com informação do aprendizado
              const telefoneFormatado = clienteTelefone.replace(/^55/, '');
              const msgConfirmacao = `✅ Mensagem enviada para ${telefoneFormatado}.\n\n` +
                `📚 Ensinamento registrado! Quando alguém disser algo similar a "${mensagemOriginalCliente}", responderei automaticamente com base no gatilho "${gatilhoAprendido}".`;
              await sendMessage(serverUrlAdmin!, instanceTokenAdmin, ADMIN_NUMERO, msgConfirmacao);
              
              return new Response(JSON.stringify({ success: true, admin_confirmed: true, cliente: clienteTelefone }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              });
            }
            
            // Negação
            if (negacoes.some(n => textoLower.includes(n))) {
              console.log(`[ADMIN-CANCEL] Admin cancelou envio`);
              await supabase.from('chatbot_conversas').delete().eq('telefone', pendingKey);
              await sendMessage(serverUrlAdmin!, instanceTokenAdmin, ADMIN_NUMERO, '❌ Cancelado. Envie nova instrução quando quiser.');
              
              return new Response(JSON.stringify({ success: true, admin_cancelled: true }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              });
            }
            
            // Resposta ambígua
            console.log(`[ADMIN-AMBIGUOUS] Resposta ambígua do admin: "${texto}"`);
            await sendMessage(serverUrlAdmin!, instanceTokenAdmin, ADMIN_NUMERO, 'Por favor responda "sim" para confirmar ou "não" para cancelar.');
            
            return new Response(JSON.stringify({ success: true, admin_ambiguous: true }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          
          // CASO 2: Primeira instrução do admin (gerar proposta)
          const clienteTelefone = dados.cliente_telefone;
          const clienteServerUrl = dados.server_url || serverUrlAdmin;
          const clienteInstanceToken = dados.instance_token || instanceTokenAdmin;
          const contextoCliente = dados.contexto || {};
          
          console.log(`[ADMIN-INSTRUCTION] Admin enviou instrução para ${clienteTelefone}: "${texto}"`);
          
          // Parse instrução
          const instrucao = parseAdminInstruction(texto);
          let respostaProposta: string;
          
          if (instrucao.literal) {
            respostaProposta = instrucao.conteudo;
            console.log(`[ADMIN-INSTRUCTION] Modo literal: "${respostaProposta}"`);
          } else {
            respostaProposta = await gerarRespostaComInstrucaoAdmin(instrucao.conteudo, contextoCliente);
            console.log(`[ADMIN-INSTRUCTION] Modo IA: instrução="${instrucao.conteudo}" -> resposta="${respostaProposta}"`);
          }
          
          // Obter mensagem original do cliente do histórico
          const mensagemOriginalCliente = contextoCliente?.mensagens_historico?.slice(-1)[0]?.content || texto;
          
          // Enviar proposta ao admin para confirmação
          const msgConfirmacao = `Ok entendido, irei responder o seguinte:\n\n"${respostaProposta}"\n\nVocê confirma?`;
          await sendMessage(serverUrlAdmin!, instanceTokenAdmin, ADMIN_NUMERO, msgConfirmacao);
          
          // Atualizar registro pendente com proposta e flag de aguardando confirmação
          await supabase.from('chatbot_conversas').upsert({
            telefone: pendingKey,
            etapa: 'admin_pending',
            dados: {
              ...dados,
              instrucao_admin: texto,
              resposta_proposta: respostaProposta,
              mensagem_original_cliente: mensagemOriginalCliente,
              aguardando_confirmacao: true
            },
            atualizado_em: new Date().toISOString()
          }, { onConflict: 'telefone' });
          
          console.log(`[ADMIN-INSTRUCTION] Proposta enviada ao admin, aguardando confirmação`);
          
          return new Response(JSON.stringify({ success: true, admin_proposal_sent: true, cliente: clienteTelefone }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      // Se não há cliente pendente, ignorar mensagem do admin
      console.log(`[ADMIN] Mensagem do admin sem cliente pendente, ignorando.`);
      return new Response(JSON.stringify({ success: true, ignored: true, reason: 'admin_no_pending' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // --- DEBOUNCE: buffer de mensagens para evitar respostas duplicadas ---
    const debounceTimestamp = new Date().toISOString();

    // Append mensagem ao buffer e registrar timestamp
    await supabase.rpc('chatbot_append_buffer', {
      p_telefone: telefone,
      p_texto: texto,
      p_timestamp: debounceTimestamp,
    });

    // Esperar 4 segundos para mensagens seguidas chegarem
    await new Promise(r => setTimeout(r, 4000));

    // Re-ler conversa para verificar se somos o webhook mais recente
    const { data: convDebounce } = await supabase
      .from('chatbot_conversas')
      .select('ultimo_webhook_em, mensagens_pendentes')
      .eq('telefone', telefone)
      .maybeSingle();

    if (convDebounce?.ultimo_webhook_em && convDebounce.ultimo_webhook_em > debounceTimestamp) {
      console.log(`[DEBOUNCE] Webhook mais recente detectado para ${telefone}, abortando este.`);
      return new Response(JSON.stringify({ success: true, deferred: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Somos o mais recente — pegar todas as mensagens pendentes e limpar buffer
    const mensagensPendentes = convDebounce?.mensagens_pendentes || [texto];
    if (mensagensPendentes.length > 1) {
      console.log(`[DEBOUNCE] Combinando ${mensagensPendentes.length} mensagens de ${telefone}: ${JSON.stringify(mensagensPendentes)}`);
      texto = mensagensPendentes.join('\n');
    }
    // Limpar buffer atomicamente
    await supabase
      .from('chatbot_conversas')
      .update({ mensagens_pendentes: [], ultimo_webhook_em: null })
      .eq('telefone', telefone);

    // --- FIM DEBOUNCE ---

    // Chatbot ativo?
    const { data: chatbotConfig } = await supabase.from('chatbot_config').select('ativo').limit(1).single();
    if (!chatbotConfig?.ativo) {
      return new Response(JSON.stringify({ success: true, ignored: true, reason: 'disabled' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // --- CARREGAR REGRAS CUSTOMIZADAS E TEMPLATES ---
    const { data: regrasCustomizadas } = await supabase
      .from('chatbot_regras')
      .select('gatilho, resposta')
      .eq('ativo', true);

    const { data: templatesAtivos } = await supabase
      .from('chatbot_templates')
      .select('etapa, template')
      .eq('ativo', true);

    const templateMap = new Map<string, string>((templatesAtivos || []).map((t: any) => [t.etapa, t.template]));

    // Helper para substituir variáveis nos templates
    function aplicarVariaveisTemplate(tmpl: string, dadosCtx: any): string {
      const primeiroNome = dadosCtx.nome ? dadosCtx.nome.split(' ')[0] : '';
      const primeiroNomeCap = primeiroNome ? primeiroNome.charAt(0).toUpperCase() + primeiroNome.slice(1).toLowerCase() : '';
      const cpfFormatadoTmpl = dadosCtx.cpf ? formatCpf(dadosCtx.cpf) : '';
      return tmpl
        .replace(/\{primeiro_nome\}/g, primeiroNomeCap)
        .replace(/\{nome_completo\}/g, dadosCtx.nome || '')
        .replace(/\{cpf_formatado\}/g, cpfFormatadoTmpl)
        .replace(/\{valor_avista\}/g, dadosCtx.valor_avista ? formatCurrency(Number(dadosCtx.valor_avista)) : '')
        .replace(/\{valor_parcela\}/g, dadosCtx.valor_parcela_calc ? formatCurrency(Number(dadosCtx.valor_parcela_calc)) : '')
        .replace(/\{valor_parcelado\}/g, dadosCtx.valor_parcelado ? formatCurrency(Number(dadosCtx.valor_parcelado)) : '')
        .replace(/\{max_parcelas\}/g, String(dadosCtx.max_parcelas || ''))
        .replace(/\{credor\}/g, dadosCtx.credor || '')
        .replace(/\{telefone_contato\}/g, '(62) 98218-3144');
    }

    const serverUrl = payload?.BaseUrl?.replace(/\/+$/, '') || Deno.env.get('UAZAPI_SERVER_URL');
    const instanceToken = payload?.token || Deno.env.get('UAZAPI_INSTANCE_TOKEN');

    // Check instance owner
    if (instanceToken) {
      const { data: instanceRecord } = await supabase
        .from('user_whatsapp_instances')
        .select('user_id, ativo')
        .eq('instance_token', instanceToken)
        .limit(1)
        .maybeSingle();

      // If instance exists but is deactivated, silently ignore
      if (instanceRecord && !instanceRecord.ativo) {
        console.log(`[CHATBOT] Instance ${instanceToken} is deactivated, ignoring.`);
        return new Response(JSON.stringify({ success: true, ignored: true, reason: 'instance_deactivated' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (instanceRecord?.user_id) {
        // Check if owner is admin - chatbot only works for admin instances
        const { data: ownerRole } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', instanceRecord.user_id)
          .eq('role', 'admin')
          .maybeSingle();

        if (!ownerRole) {
          console.log(`[CHATBOT] Instance owner ${instanceRecord.user_id} is not admin, ignoring.`);
          return new Response(JSON.stringify({ success: true, ignored: true, reason: 'owner_not_admin' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const { data: ownerProfile } = await supabase
          .from('profiles')
          .select('whatsapp_lembretes_habilitado')
          .eq('id', instanceRecord.user_id)
          .single();
        if (ownerProfile && !ownerProfile.whatsapp_lembretes_habilitado) {
          return new Response(JSON.stringify({ success: true, ignored: true, reason: 'owner_disabled' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
    }

    if (!serverUrl || !instanceToken) {
      return new Response(JSON.stringify({ success: false, error: 'Credenciais não configuradas' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // --- Estado da conversa ---
    const { data: conversa } = await supabase.from('chatbot_conversas').select('*').eq('telefone', telefone).single();
    let etapaAtual = conversa?.etapa || 'novo';
    let dados = conversa?.dados || {};

    // --- ATENDIMENTO HUMANO: Se operador está atendendo, ignorar mensagem ---
    if (etapaAtual === 'atendimento_humano' && dados.atendimento_humano_em) {
      const inicioAtendimento = new Date(dados.atendimento_humano_em);
      const minutosDecorridos = (Date.now() - inicioAtendimento.getTime()) / 60000;
      
      if (minutosDecorridos < 30) {
        console.log(`[SILENCED] Bot pausado para ${telefone} (atendimento humano há ${Math.round(minutosDecorridos)}min)`);
        // Apenas bufferar no histórico sem responder
        dados = addToHistorico(dados, 'cliente', texto);
        await supabase.from('chatbot_conversas').upsert({
          telefone,
          etapa: 'atendimento_humano',
          dados,
          atualizado_em: new Date().toISOString(),
        }, { onConflict: 'telefone' });
        return new Response(JSON.stringify({ success: true, silenced: true, reason: 'atendimento_humano' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      // Expirou → restaurar etapa anterior
      const etapaAnterior = dados.etapa_antes_humano || 'novo';
      console.log(`[HUMAN-EXPIRED] Atendimento humano expirou para ${telefone} (${Math.round(minutosDecorridos)}min), restaurando etapa: ${etapaAnterior}`);
      etapaAtual = etapaAnterior;
      delete dados.atendimento_humano_em;
      delete dados.etapa_antes_humano;
    }

    dados = addToHistorico(dados, 'cliente', texto);

    const textoLower = texto.toLowerCase().trim();

    // Reset commands
    if (['menu', 'inicio', 'início', 'voltar', 'reiniciar'].includes(textoLower) && etapaAtual !== 'novo') {
      etapaAtual = 'novo';
      dados = { mensagens_historico: dados.mensagens_historico || [] };
    }

    // Greetings reset only if not in active negotiation
    const etapasAtivas = ['proposta_enviada', 'oferta_valores', 'aguardando_parcelas', 'aguardando_confirmacao_identidade', 'aguardando_pagamento_hoje', 'aguardando_data', 'aguardando_humano', 'atendimento_humano'];
    if (['oi', 'olá', 'ola', 'bom dia', 'boa tarde', 'boa noite'].includes(textoLower) && etapaAtual !== 'novo' && !etapasAtivas.includes(etapaAtual)) {
      etapaAtual = 'novo';
      dados = { mensagens_historico: dados.mensagens_historico || [] };
    }

    let resposta = '';

    // Extract instance phone number from payload or database
    let telefoneInstancia = (payload?.phone || payload?.instance?.wuid || payload?.wuid || payload?.instanceId || '').replace(/\D/g, '') || '';
    
    // Fallback: buscar número da instância no banco usando o token
    if (!telefoneInstancia && instanceToken) {
      try {
        const { data: instData } = await supabase
          .from('user_whatsapp_instances')
          .select('nome')
          .eq('instance_token', instanceToken)
          .eq('ativo', true)
          .limit(1)
          .single();
        if (instData?.nome) {
          telefoneInstancia = instData.nome.replace(/\D/g, '') || '';
        }
      } catch (e) {
        console.log('[INSTANCE] Falha ao buscar número da instância no banco:', e);
      }
    }
    
    // Fallback: extrair do server_url se possível
    if (!telefoneInstancia && serverUrl) {
      const match = serverUrl.match(/(\d{10,13})/);
      if (match) telefoneInstancia = match[1];
    }
    
    if (!telefoneInstancia) telefoneInstancia = 'desconhecido';

    // Helper to save state and respond
    async function salvarEResponder(novaEtapa: string, dadosExtra?: any) {
      dados = addToHistorico(dados, 'assistente', resposta);
      await supabase.from('chatbot_conversas').upsert({
        telefone, etapa: novaEtapa, dados: { ...dados, ...dadosExtra },
        server_url: serverUrl, instance_token: instanceToken,
        atualizado_em: new Date().toISOString(),
      }, { onConflict: 'telefone' });

      const delay = Math.floor(Math.random() * 16000) + 15000;
      await simulateTyping(serverUrl!, instanceToken!, telefone, delay);
      await sendMessage(serverUrl!, instanceToken!, telefone, resposta);
    }

    // Helper to save state WITHOUT responding (silence mode)
    async function salvarSilenciosoENotificar(etapaOriginal: string, textoCliente: string) {
      await supabase.from('chatbot_conversas').upsert({
        telefone, etapa: 'aguardando_humano',
        dados: { ...dados, etapa_antes_humano: etapaOriginal },
        server_url: serverUrl, instance_token: instanceToken,
        atualizado_em: new Date().toISOString(),
      }, { onConflict: 'telefone' });

      // Save admin_pending record so admin can reply via WhatsApp
      const pendingKey = `admin_pending_${instanceToken}`;
      await supabase.from('chatbot_conversas').upsert({
        telefone: pendingKey,
        etapa: 'admin_pending',
        dados: { cliente_telefone: telefone, instance_token: instanceToken, server_url: serverUrl, contexto: dados },
        atualizado_em: new Date().toISOString(),
      }, { onConflict: 'telefone' });

      await notificarAdmin(serverUrl!, instanceToken!, telefone, telefoneInstancia, textoCliente);
    }

    // =============================================
    // VERIFICAR REGRAS CUSTOMIZADAS (chatbot_regras)
    // =============================================
    // Regras só se aplicam em etapas ativas de negociação (não no fluxo inicial de identificação)
    const etapasRegraPermitida = ['proposta_enviada', 'oferta_valores', 'aguardando_pagamento_hoje', 'aguardando_data', 'aguardando_humano'];
    if (regrasCustomizadas && regrasCustomizadas.length > 0 && etapasRegraPermitida.includes(etapaAtual)) {
      let regraAplicada = false;
      for (const regra of regrasCustomizadas) {
        if (textoLower.includes(regra.gatilho.toLowerCase())) {
          console.log(`[REGRA] Gatilho "${regra.gatilho}" detectado em "${textoLower}" — aplicando resposta customizada`);
          resposta = aplicarVariaveisTemplate(regra.resposta, dados);
          await salvarEResponder(etapaAtual);
          regraAplicada = true;
          break;
        }
      }
      if (regraAplicada) {
        return new Response(JSON.stringify({ success: true, regra_aplicada: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // =============================================
    // FLUXO PRINCIPAL — RESPOSTAS FIXAS/EXATAS
    // =============================================

    switch (etapaAtual) {
      // -------- NOVO / AGUARDANDO CPF --------
      case 'novo':
      case 'aguardando_cpf': {
        if (etapaAtual === 'novo') {
          // Try to find client by phone
          const phoneSuffix = telefone.slice(-10);
          const phoneSuffix11 = telefone.slice(-11);

          const { data: devedoresPorTelefone } = await supabase
            .from('devedores')
            .select('nome, cpf, telefone, valor_atualizado, credor')
            .eq('ativo', true)
            .or(`telefone.ilike.%${phoneSuffix},telefone.ilike.%${phoneSuffix11}`);

          let devedoresEncontrados = devedoresPorTelefone || [];

          if (devedoresEncontrados.length === 0) {
            const { data: telefonesAdicionais } = await supabase
              .from('devedor_telefones')
              .select('devedor_cpf, numero')
              .eq('ativo', true)
              .or(`numero.ilike.%${phoneSuffix},numero.ilike.%${phoneSuffix11}`);

            if (telefonesAdicionais && telefonesAdicionais.length > 0) {
              const cpfsUnicos = [...new Set(telefonesAdicionais.map((t: any) => t.devedor_cpf))];
              const { data: devedoresPorCpf } = await supabase
                .from('devedores')
                .select('nome, cpf, telefone, valor_atualizado, credor')
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
              const cpfLimpo = cpfsUnicos[0];
              const devedor = devedoresEncontrados[0];
              const cpfFormatado = formatCpf(cpfLimpo);
              resposta = `Só pra confirmar, seu CPF é ${cpfFormatado}?`;
              dados = { ...dados, cpf_candidato: cpfLimpo, nome_candidato: devedor.nome, credor_candidato: devedor.credor };
              await salvarEResponder('aguardando_confirmacao_identidade');
              break;
            } else {
              // Multiple CPFs — ask confirmation of first
              const devedor = devedoresEncontrados[0];
              const cpfLimpo = devedor.cpf.replace(/\D/g, '');
              const cpfFormatado = formatCpf(cpfLimpo);
              resposta = `Só pra confirmar, seu CPF é ${cpfFormatado}?`;
              dados = { ...dados, cpf_candidato: cpfLimpo, nome_candidato: devedor.nome, credor_candidato: devedor.credor };
              await salvarEResponder('aguardando_confirmacao_identidade');
              break;
            }
          }

          // No match — ask CPF
          const tmplSaudacao = templateMap.get('saudacao');
          resposta = tmplSaudacao
            ? aplicarVariaveisTemplate(tmplSaudacao, dados)
            : `Olá! Para consultar sua situação, por favor me informe seu CPF.`;
          await salvarEResponder('aguardando_cpf');
          break;
        }

        // Waiting for CPF input
        const cpf = extractCpf(texto);
        if (!cpf) {
          const tentativasCpf = ((dados as any).tentativas_cpf || 0) + 1;
          dados = { ...dados, tentativas_cpf: tentativasCpf };
          
          if (tentativasCpf <= 1) {
            resposta = `Não consegui identificar um CPF válido. Por favor, envie seu CPF com 11 dígitos. Exemplo: 123.456.789-00`;
            await salvarEResponder('aguardando_cpf');
          } else {
            await salvarSilenciosoENotificar('aguardando_cpf', texto);
          }
          break;
        }

        // Look up debts
        const { data: debitos, error: debitosError } = await supabase.rpc('consultar_debitos_por_cpf', { p_cpf: cpf });

        if (debitosError || !debitos || debitos.length === 0) {
          resposta = debitos?.length === 0
            ? `Não encontramos pendências para o CPF ${formatCpf(cpf)}. Se acredita que há algum erro, entre em contato: (62) 98218-3144.`
            : `Desculpe, tive um problema ao consultar seus dados. Tente novamente mais tarde ou ligue para (62) 98218-3144.`;
          await salvarEResponder('sem_debitos', { cpf });
          break;
        }

        // Found debts — go to proposal
        const nomeDevedor = debitos[0].nome;
        const primeiroNome = nomeDevedor.split(' ')[0];
        const primeiroNomeCap = primeiroNome.charAt(0).toUpperCase() + primeiroNome.slice(1).toLowerCase();
        const valorTotal = debitos.reduce((sum: number, d: any) => sum + Number(d.valor_atualizado), 0);

        // Fetch credor
        const { data: devedorInfo } = await supabase.from('devedores').select('credor').eq('cpf', cpf).eq('ativo', true).limit(1).single();
        const credorNome = getCredorNome(devedorInfo?.credor || '');

        const dadosParaTemplate = { ...dados, cpf, nome: nomeDevedor, valor_avista: valorTotal * 0.5, valor_parcelado: valorTotal * 0.7, credor: credorNome };
        const tmplProposta = templateMap.get('proposta');
        resposta = tmplProposta
          ? aplicarVariaveisTemplate(tmplProposta, dadosParaTemplate)
          : `Olá ${primeiroNomeCap}, você consegue voltar a pagar suas parcelas em aberto com ${credorNome} com 50% de desconto?`;

        const valorAvista = valorTotal * 0.5;
        const valorParcelado = valorTotal * 0.7;
        let maxParcelas = Math.floor(valorParcelado / VALOR_MINIMO_PARCELA);
        if (maxParcelas > 24) maxParcelas = 24;
        if (maxParcelas < 2) maxParcelas = 2;

        dados = {
          ...dados, cpf, nome: nomeDevedor, valor_total: valorTotal,
          valor_avista: valorAvista, valor_parcelado: valorParcelado,
          max_parcelas: maxParcelas, credor: credorNome,
        };
        await salvarEResponder('proposta_enviada');
        break;
      }

      // -------- CONFIRMAÇÃO DE IDENTIDADE --------
      case 'aguardando_confirmacao_identidade': {
        const confirmou = await interpretarIntencao(texto, ['sim', 'nao']);
        const isConfirmacao = confirmou?.includes('sim') ||
          ['sim', 'sou', 'sou eu', 'isso', 'correto', 'sou sim', 'eu mesmo', 'eu mesma', 'isso mesmo', 'exato'].includes(textoLower);
        const isNegacao = confirmou?.includes('nao') ||
          ['não', 'nao', 'não sou', 'nao sou', 'errado', 'não é', 'nao e'].includes(textoLower);

        if (isConfirmacao) {
          const cpf = dados.cpf_candidato;
          const { data: debitos, error: debitosError } = await supabase.rpc('consultar_debitos_por_cpf', { p_cpf: cpf });

          if (debitosError || !debitos || debitos.length === 0) {
            resposta = debitos?.length === 0
              ? `Não encontramos pendências no seu CPF. Se acredita que há algum erro, ligue para (62) 98218-3144.`
              : `Desculpe, tive um problema ao consultar. Tente novamente ou ligue para (62) 98218-3144.`;
            await salvarEResponder('sem_debitos', { cpf });
            break;
          }

          const nomeDevedor = debitos[0].nome;
          const primeiroNome = nomeDevedor.split(' ')[0];
          const primeiroNomeCap = primeiroNome.charAt(0).toUpperCase() + primeiroNome.slice(1).toLowerCase();
          const valorTotal = debitos.reduce((sum: number, d: any) => sum + Number(d.valor_atualizado), 0);

          const { data: devedorInfo } = await supabase.from('devedores').select('credor').eq('cpf', cpf).eq('ativo', true).limit(1).single();
          const credorNome = getCredorNome(devedorInfo?.credor || dados.credor_candidato || '');

          const valorAvista = valorTotal * 0.5;
          const valorParcelado = valorTotal * 0.7;
          let maxParcelas = Math.floor(valorParcelado / VALOR_MINIMO_PARCELA);
          if (maxParcelas > 24) maxParcelas = 24;
          if (maxParcelas < 2) maxParcelas = 2;

          const dadosParaTemplate2 = { ...dados, cpf, nome: nomeDevedor, valor_avista: valorAvista, valor_parcelado: valorParcelado, max_parcelas: maxParcelas, credor: credorNome };
          const tmplProposta2 = templateMap.get('proposta');
          resposta = tmplProposta2
            ? aplicarVariaveisTemplate(tmplProposta2, dadosParaTemplate2)
            : `Olá ${primeiroNomeCap}, você consegue voltar a pagar suas parcelas em aberto com ${credorNome} com 50% de desconto?`;

          dados = {
            ...dados, cpf, nome: nomeDevedor, valor_total: valorTotal,
            valor_avista: valorAvista, valor_parcelado: valorParcelado,
            max_parcelas: maxParcelas, credor: credorNome,
          };
          await salvarEResponder('proposta_enviada');
          break;

        } else if (isNegacao) {
          resposta = `Desculpe pelo engano! Me informe seu CPF para que eu possa consultar sua situação.`;
          dados = { mensagens_historico: dados.mensagens_historico || [] };
          await salvarEResponder('aguardando_cpf');
          break;

        } else {
          resposta = `Desculpe, não entendi. Você é *${dados.nome_candidato}*? Responda *sim* ou *não*.`;
          await salvarEResponder('aguardando_confirmacao_identidade');
          break;
        }
      }

      // -------- PROPOSTA ENVIADA (50% desconto?) --------
      case 'proposta_enviada': {
        // Check if client is asking about specific installments (e.g. "como fica em 12x?")
        const matchParcelasProposta = texto.match(/(\d+)\s*(?:x|vezes|parcelas?)/i) || texto.match(/em\s+(\d+)\b/i);
        
        if (matchParcelasProposta) {
          const parcelasPedidas = parseInt(matchParcelasProposta[1]);
          
          // Recalculate values if needed
          let vaP = Number(dados.valor_avista);
          let vpP = Number(dados.valor_parcelado);
          let mpP = Number(dados.max_parcelas);
          if (!vaP || isNaN(vaP)) {
            let vt = Number(dados.valor_total);
            if (!vt || isNaN(vt)) {
              const cpfF = dados.cpf;
              if (cpfF) {
                const { data: df } = await supabase.rpc('consultar_debitos_por_cpf', { p_cpf: cpfF });
                if (df && df.length > 0) vt = df.reduce((s: number, d: any) => s + Number(d.valor_atualizado), 0);
              }
            }
            if (vt && !isNaN(vt)) {
              vaP = vt * 0.5;
              vpP = vt * 0.7;
              mpP = Math.min(24, Math.floor(vpP / VALOR_MINIMO_PARCELA));
              if (mpP < 2) mpP = 2;
              dados = { ...dados, valor_total: vt, valor_avista: vaP, valor_parcelado: vpP, max_parcelas: mpP };
            }
          }

          if (parcelasPedidas === 1) {
            dados = { ...dados, tipo_pagamento: 'avista', parcelas: 1, valor_final: vaP };
            resposta = `À vista fica *${formatCurrency(vaP)}*. Você consegue fazer o pagamento hoje?`;
            await salvarEResponder('aguardando_pagamento_hoje');
            break;
          } else if (parcelasPedidas >= 2 && parcelasPedidas <= 24 && vpP / parcelasPedidas >= VALOR_MINIMO_PARCELA) {
            const valorParcCalc = vpP / parcelasPedidas;
            dados = { ...dados, tipo_pagamento: 'parcelado', parcelas: parcelasPedidas, valor_final: vpP };
            resposta = `Em ${parcelasPedidas}x fica *${formatCurrency(valorParcCalc)}* cada parcela. Você consegue fazer o pagamento hoje?`;
            await salvarEResponder('aguardando_pagamento_hoje');
            break;
          } else {
            const maxParc = mpP || 24;
            resposta = `O parcelamento pode ser de 2x a ${maxParc}x com parcela mínima de R$ 100,00. Como prefere?`;
            await salvarEResponder('oferta_valores');
            break;
          }
        }

        // Detect greetings and interest expressions as positive signals
        const isSaudacao = /^(ol[aá]|oi|bom dia|boa tarde|boa noite|e a[ií]|tudo bem|boa noite)/i.test(textoLower);
        const isInteresse = /(como fica|qual.?valor|quanto|me fala|explica|fala mais|me interessa|tenho interesse|quero saber|quero ver|quero negociar|pode me explicar|como funciona|como que|qual proposta|qual a proposta)/i.test(textoLower);

        // Client responds to "consegue voltar a pagar com 50% de desconto?"
        const intencao = await interpretarIntencao(texto, ['sim', 'nao']);
        const isSim = intencao?.includes('sim') ||
          ['sim', 'consigo', 'sim consigo', 'quero', 'pode ser', 'sim como fica', 'aceito', 'quero sim', 'como fica', 'tô querendo', 'to querendo'].includes(textoLower) ||
          isSaudacao || isInteresse;

        if (isSim) {
          // Robust fallback: recalculate if values are missing/NaN
          let valorAvista = Number(dados.valor_avista);
          let valorParcelado = Number(dados.valor_parcelado);
          let maxParcelas = Number(dados.max_parcelas);

          if (!valorAvista || isNaN(valorAvista)) {
            let valorTotal = Number(dados.valor_total);
            if (!valorTotal || isNaN(valorTotal)) {
              // Try to fetch from devedores by CPF
              const cpfFallback = dados.cpf;
              if (cpfFallback) {
                const { data: devsFallback } = await supabase.rpc('consultar_debitos_por_cpf', { p_cpf: cpfFallback });
                if (devsFallback && devsFallback.length > 0) {
                  valorTotal = devsFallback.reduce((sum: number, d: any) => sum + Number(d.valor_atualizado), 0);
                }
              }
            }
            if (valorTotal && !isNaN(valorTotal)) {
              valorAvista = valorTotal * 0.5;
              valorParcelado = valorTotal * 0.7;
              maxParcelas = Math.min(24, Math.floor(valorParcelado / VALOR_MINIMO_PARCELA));
              if (maxParcelas < 2) maxParcelas = 2;
              // Save back to dados for subsequent stages
              dados = { ...dados, valor_total: valorTotal, valor_avista: valorAvista, valor_parcelado: valorParcelado, max_parcelas: maxParcelas };
              console.log(`[Fallback] Recalculated: avista=${valorAvista}, parcelado=${valorParcelado}, maxParcelas=${maxParcelas}`);
            }
          }

          resposta = gerarMensagemProposta(valorAvista, valorParcelado);

          await salvarEResponder('oferta_valores');
          break;
        } else {
          // Client said no or unclear — notify admin, stay silent
          console.log(`[SILÊNCIO] proposta_enviada: cliente não aceitou/ambíguo: "${texto}"`);
          await salvarSilenciosoENotificar('proposta_enviada', texto);
          break;
        }
      }

      // -------- OFERTA DE VALORES (avista ou parcelado?) --------
      case 'oferta_valores': {
        // Ensure values are valid numbers with fallback (moved up for reuse)
        let vaOfertas = Number(dados.valor_avista);
        let vpOfertas = Number(dados.valor_parcelado);
        let mpOfertas = Number(dados.max_parcelas);
        if (!vaOfertas || isNaN(vaOfertas)) {
          let vt = Number(dados.valor_total);
          if (!vt || isNaN(vt)) {
            const cpfF = dados.cpf;
            if (cpfF) {
              const { data: df } = await supabase.rpc('consultar_debitos_por_cpf', { p_cpf: cpfF });
              if (df && df.length > 0) vt = df.reduce((s: number, d: any) => s + Number(d.valor_atualizado), 0);
            }
          }
          if (vt && !isNaN(vt)) {
            vaOfertas = vt * 0.5;
            vpOfertas = vt * 0.7;
            mpOfertas = Math.min(24, Math.floor(vpOfertas / VALOR_MINIMO_PARCELA));
            if (mpOfertas < 2) mpOfertas = 2;
            dados = { ...dados, valor_total: vt, valor_avista: vaOfertas, valor_parcelado: vpOfertas, max_parcelas: mpOfertas };
          }
        }

        // Check if client is asking about specific installments (e.g. "como fica em 12x?")
        const matchParcelasOferta = texto.match(/(\d+)\s*(?:x|vezes|parcelas?)/i) || texto.match(/em\s+(\d+)\b/i);
        
        if (matchParcelasOferta) {
          const parcelasPedidas = parseInt(matchParcelasOferta[1]);
          
          if (parcelasPedidas === 1) {
            dados = { ...dados, tipo_pagamento: 'avista', parcelas: 1, valor_final: vaOfertas };
            resposta = `À vista fica *${formatCurrency(vaOfertas)}*. Você consegue fazer o pagamento hoje?`;
            await salvarEResponder('aguardando_pagamento_hoje');
            break;
          } else if (parcelasPedidas >= 2 && parcelasPedidas <= 24 && vpOfertas / parcelasPedidas >= VALOR_MINIMO_PARCELA) {
            const valorParcCalc = vpOfertas / parcelasPedidas;
            dados = { ...dados, tipo_pagamento: 'parcelado', parcelas: parcelasPedidas, valor_final: vpOfertas };
            resposta = `Em ${parcelasPedidas}x fica *${formatCurrency(valorParcCalc)}* cada parcela. Você consegue fazer o pagamento hoje?`;
            await salvarEResponder('aguardando_pagamento_hoje');
            break;
          } else {
            resposta = `O parcelamento pode ser de 2x a ${mpOfertas}x com parcela mínima de R$ 100,00. Como prefere?`;
            await salvarEResponder('oferta_valores');
            break;
          }
        }

        // Original flow: classify intent
        let escolha = textoLower === '1' ? 'avista' : textoLower === '2' ? 'parcelado' : null;

        if (!escolha) {
          const intencaoOferta = await interpretarIntencao(texto, ['avista', 'parcelado', 'nenhuma']);
          if (intencaoOferta?.includes('avista')) escolha = 'avista';
          else if (intencaoOferta?.includes('parcelado')) escolha = 'parcelado';
        }

        if (escolha === 'avista') {
          dados = { ...dados, tipo_pagamento: 'avista', parcelas: 1, valor_final: vaOfertas };
          resposta = `Você consegue fazer o pagamento hoje?`;
          await salvarEResponder('aguardando_pagamento_hoje');
          break;

        } else if (escolha === 'parcelado') {
          const listaParc = gerarListaParcelamento(vpOfertas);
          resposta = `Ótimo! Aqui estão as opções de parcelamento:\n\n${listaParc}\n\nEm quantas vezes deseja pagar? Responda com o número (ex: *3x*).`;
          dados = { ...dados, tipo_pagamento: 'parcelado', valor_final: vpOfertas };
          await salvarEResponder('oferta_valores');
          break;

        } else {
          // Check for greetings/interest before giving up
          const isSaudacaoOferta = /^(ol[aá]|oi|bom dia|boa tarde|boa noite|e a[ií]|tudo bem)/i.test(textoLower);
          const isInteresseOferta = /(como fica|qual.?valor|quanto|me fala|explica|fala mais|me interessa|tenho interesse|quero saber|quero ver|como funciona|como que|qual proposta)/i.test(textoLower);

          if (isSaudacaoOferta || isInteresseOferta) {
            // Re-send the offer with full list
            const listaParc = gerarListaParcelamento(vpOfertas);
            let msgReenvio = `Olá! 😊 Temos uma ótima oportunidade: quitação à vista por *${formatCurrency(vaOfertas)}*.`;
            if (listaParc) {
              msgReenvio += `\n\nOu podemos parcelar:\n\n${listaParc}`;
            }
            msgReenvio += `\n\nComo prefere pagar? Responda com o número de parcelas (ex: *3x*) ou *à vista*.`;
            resposta = msgReenvio;
            await salvarEResponder('oferta_valores');
            break;
          }

          // AI não entendeu — notificar admin e silenciar
          console.log(`[SILÊNCIO] oferta_valores: não entendeu escolha: "${texto}"`);
          await salvarSilenciosoENotificar('oferta_valores', texto);
          break;
        }
      }

      // -------- CONSEGUE PAGAR HOJE? --------
      case 'aguardando_pagamento_hoje': {
        // Detectar pedido de parcelas antes de classificar sim/não
        const matchParcelasHoje = texto.match(/(\d+)\s*(?:x|vezes|parcelas?)/i) || texto.match(/em\s+(\d+)\b/i);
        if (matchParcelasHoje) {
          const parcelasPedidas = parseInt(matchParcelasHoje[1]);
          const vpCalc = dados.valor_parcelado || dados.valor_final || 0;
          const tambemConfirmou = /(sim|consigo|quero|pode ser|ok|fechado|fecha|vamos|bora|isso|esse|essa|aceito)/i.test(textoLower);
          
          if (parcelasPedidas === 1) {
            const vaCalc = dados.valor_avista || vpCalc * 0.5 / 0.7;
            dados = { ...dados, tipo_pagamento: 'avista', parcelas: 1, valor_final: vaCalc };
            if (tambemConfirmou) {
              resposta = `Ok! Iremos te enviar o boleto à vista no valor de *${formatCurrency(vaCalc)}*.`;
              await salvarEResponder('acordo_finalizado', { data_pagamento: 'hoje' });
              await notificarAcordoFechado(serverUrl!, instanceToken!, telefone, { ...dados, data_pagamento: 'hoje' });
            } else {
              resposta = `À vista fica *${formatCurrency(vaCalc)}*. Você consegue fazer o pagamento hoje?`;
              await salvarEResponder('aguardando_pagamento_hoje');
            }
            break;
          } else if (parcelasPedidas >= 2 && parcelasPedidas <= 24 && vpCalc / parcelasPedidas >= 100) {
            const valorParcCalc = vpCalc / parcelasPedidas;
            dados = { ...dados, tipo_pagamento: 'parcelado', parcelas: parcelasPedidas, valor_final: vpCalc };
            if (tambemConfirmou) {
              resposta = `Ok! Iremos te enviar o boleto em ${parcelasPedidas}x de *${formatCurrency(valorParcCalc)}*.`;
              await salvarEResponder('acordo_finalizado', { data_pagamento: 'hoje' });
              await notificarAcordoFechado(serverUrl!, instanceToken!, telefone, { ...dados, data_pagamento: 'hoje' });
            } else {
              resposta = `Em ${parcelasPedidas}x fica *${formatCurrency(valorParcCalc)}* cada parcela. Você consegue fazer o pagamento hoje?`;
              await salvarEResponder('aguardando_pagamento_hoje');
            }
            break;
          } else {
            const maxP = Math.floor(vpCalc / 100);
            resposta = `O parcelamento pode ser de 2x a ${Math.min(maxP, 24)}x (parcela mínima de R$ 100). Como prefere?`;
            await salvarEResponder('aguardando_pagamento_hoje');
            break;
          }
        }

        const intencao = await interpretarIntencao(texto, ['sim', 'nao']);
        const isSim = intencao?.includes('sim') ||
          ['sim', 'consigo', 'sim consigo', 'hoje mesmo', 'pode ser', 'sim pode', 'ok'].includes(textoLower);
        const isNao = intencao?.includes('nao') ||
          ['não', 'nao', 'não consigo', 'nao consigo', 'agora não', 'agora nao', 'não hoje', 'nao hoje', 'outro dia'].includes(textoLower);

        if (isSim) {
          resposta = `Ok! Iremos te enviar o boleto para pagamento hoje.`;
          // TODO: here you can trigger boleto generation
          await salvarEResponder('acordo_finalizado', { data_pagamento: 'hoje' });
          await notificarAcordoFechado(serverUrl!, instanceToken!, telefone, { ...dados, data_pagamento: 'hoje' });
          break;

        } else if (isNao) {
          resposta = `Que dia você pode fazer o pagamento?`;
          await salvarEResponder('aguardando_data');
          break;

        } else {
          // Try to interpret as a date directly
          const dataInformada = extrairData(texto);
          if (dataInformada) {
            const dias = diffDias(new Date(), dataInformada);
            if (dias <= 7 && dias >= 0) {
              resposta = `OK, irei te enviar o boleto para essa data!`;
              await salvarEResponder('acordo_finalizado', { data_pagamento: formatDataBR(dataInformada) });
              await notificarAcordoFechado(serverUrl!, instanceToken!, telefone, { ...dados, data_pagamento: formatDataBR(dataInformada) });
            } else {
              resposta = `Infelizmente o prazo máximo para pagamento é de 7 dias. Poderia escolher uma data dentro desse período?`;
              await salvarEResponder('aguardando_data');
            }
            break;
          }

          // AI não entendeu — notificar admin e silenciar
          console.log(`[SILÊNCIO] aguardando_pagamento_hoje: resposta ambígua: "${texto}"`);
          await salvarSilenciosoENotificar('aguardando_pagamento_hoje', texto);
          break;
        }
      }

      // -------- AGUARDANDO DATA DE PAGAMENTO --------
      case 'aguardando_data': {
        const dataInformada = extrairData(texto);

        if (!dataInformada) {
          // Try AI interpretation
          const intencao = await interpretarIntencao(texto, ['hoje', 'amanha', 'nenhuma']);
          if (intencao?.includes('hoje')) {
            resposta = `Ok! Iremos te enviar o boleto para pagamento hoje.`;
            await salvarEResponder('acordo_finalizado', { data_pagamento: 'hoje' });
            await notificarAcordoFechado(serverUrl!, instanceToken!, telefone, { ...dados, data_pagamento: 'hoje' });
            break;
          } else if (intencao?.includes('amanha')) {
            const amanha = new Date();
            amanha.setDate(amanha.getDate() + 1);
            resposta = `OK, irei te enviar o boleto para essa data!`;
            await salvarEResponder('acordo_finalizado', { data_pagamento: formatDataBR(amanha) });
            await notificarAcordoFechado(serverUrl!, instanceToken!, telefone, { ...dados, data_pagamento: formatDataBR(amanha) });
            break;
          }

          // AI não entendeu a data — notificar admin e silenciar
          console.log(`[SILÊNCIO] aguardando_data: data não identificada: "${texto}"`);
          await salvarSilenciosoENotificar('aguardando_data', texto);
          break;
        }

        const dias = diffDias(new Date(), dataInformada);

        if (dias < 0) {
          resposta = `Essa data já passou. Por favor, informe uma data futura dentro dos próximos 7 dias.`;
          await salvarEResponder('aguardando_data');
          break;
        }

        if (dias > 7) {
          resposta = `Infelizmente o prazo máximo para pagamento é de 7 dias. Poderia escolher uma data até ${formatDataBR((() => { const d = new Date(); d.setDate(d.getDate() + 7); return d; })())}?`;
          await salvarEResponder('aguardando_data');
          break;
        }

        resposta = `OK, irei te enviar o boleto para essa data!`;
        await salvarEResponder('acordo_finalizado', { data_pagamento: formatDataBR(dataInformada) });
        await notificarAcordoFechado(serverUrl!, instanceToken!, telefone, { ...dados, data_pagamento: formatDataBR(dataInformada) });
        break;
      }

      // -------- AGUARDANDO HUMANO (IA não soube responder) --------
      case 'aguardando_humano': {
        // Não responde nada ao cliente, apenas re-notifica o admin se insistir
        console.log(`[AGUARDANDO_HUMANO] Cliente ${telefone} insistiu: "${texto}" — re-notificando admin`);
        await notificarAdmin(serverUrl!, instanceToken!, telefone, telefoneInstancia, texto);
        // Salvar histórico sem mudar etapa
        await supabase.from('chatbot_conversas').upsert({
          telefone, etapa: 'aguardando_humano', dados,
          server_url: serverUrl, instance_token: instanceToken,
          atualizado_em: new Date().toISOString(),
        }, { onConflict: 'telefone' });
        break;
      }

      // -------- ESTADOS FINAIS --------
      case 'acordo_finalizado':
      case 'sem_debitos':
      case 'gerando_boleto': {
        // If client sends something meaningful (not just menu commands), restart the flow
        const isResetCommand = ['menu', 'inicio', 'início', 'voltar', 'reiniciar'].includes(textoLower);
        if (!isResetCommand) {
          console.log(`[RESET] Estado terminal "${etapaAtual}" recebeu mensagem relevante, reiniciando fluxo...`);
          // Reset to 'novo' and re-process by identifying client by phone
          etapaAtual = 'novo';
          dados = { mensagens_historico: dados.mensagens_historico || [] };

          // Re-run the 'novo' logic: find client by phone
          const phoneSuffix = telefone.slice(-10);
          const phoneSuffix11 = telefone.slice(-11);

          let devedoresReset: any[] = [];
          const { data: devPorTelReset } = await supabase
            .from('devedores')
            .select('nome, cpf, telefone, valor_atualizado, credor')
            .eq('ativo', true)
            .or(`telefone.ilike.%${phoneSuffix},telefone.ilike.%${phoneSuffix11}`);
          devedoresReset = devPorTelReset || [];

          if (devedoresReset.length === 0) {
            const { data: telsAdicionaisReset } = await supabase
              .from('devedor_telefones')
              .select('devedor_cpf, numero')
              .eq('ativo', true)
              .or(`numero.ilike.%${phoneSuffix},numero.ilike.%${phoneSuffix11}`);
            if (telsAdicionaisReset && telsAdicionaisReset.length > 0) {
              const cpfsUnicos = [...new Set(telsAdicionaisReset.map((t: any) => t.devedor_cpf))];
              const { data: devPorCpfReset } = await supabase
                .from('devedores')
                .select('nome, cpf, telefone, valor_atualizado, credor')
                .eq('ativo', true)
                .in('cpf', cpfsUnicos);
              if (devPorCpfReset) devedoresReset = devPorCpfReset;
            }
          }

          if (devedoresReset.length > 0) {
            const devedor = devedoresReset[0];
            const cpf = devedor.cpf.replace(/\D/g, '');
            const valorTotal = devedoresReset
              .filter((d: any) => d.cpf.replace(/\D/g, '') === cpf)
              .reduce((sum: number, d: any) => sum + Number(d.valor_atualizado), 0);
            const valorAvista = valorTotal * 0.5;
            const valorParcelado = valorTotal * 0.7;
            let maxParcelas = Math.floor(valorParcelado / VALOR_MINIMO_PARCELA);
            if (maxParcelas > 24) maxParcelas = 24;
            if (maxParcelas < 2) maxParcelas = 2;
            const credorNome = getCredorNome(devedor.credor || '');

            // Check if the message is a positive response (client saying "sim" to a proposal)
            const intencaoReset = await interpretarIntencao(texto, ['sim', 'nao']);
            const isSimReset = intencaoReset?.includes('sim') ||
              ['sim', 'consigo', 'sim consigo', 'quero', 'pode ser', 'sim como fica', 'aceito', 'quero sim', 'como fica'].includes(textoLower);

            if (isSimReset) {
              // Client is saying yes to the offer — show values directly
              const valorParcelaMin = valorParcelado / maxParcelas;
              resposta = `Que ótimo! Estamos com uma super oportunidade para você quitar todo débito em aberto pelo valor de *${formatCurrency(valorAvista)}*. Ou podemos parcelar para você em *${maxParcelas}x de ${formatCurrency(valorParcelaMin)}*. Como fica melhor para você?`;
              dados = {
                ...dados, cpf, nome: devedor.nome, valor_total: valorTotal,
                valor_avista: valorAvista, valor_parcelado: valorParcelado,
                max_parcelas: maxParcelas, credor: credorNome,
              };
              await salvarEResponder('oferta_valores');
              break;
            } else {
              // Not a clear "sim" — send the initial proposal
              const primeiroNome = devedor.nome.split(' ')[0];
              const primeiroNomeCap = primeiroNome.charAt(0).toUpperCase() + primeiroNome.slice(1).toLowerCase();
              resposta = `Olá ${primeiroNomeCap}, você consegue voltar a pagar suas parcelas em aberto com ${credorNome} com 50% de desconto?`;
              dados = {
                ...dados, cpf, nome: devedor.nome, valor_total: valorTotal,
                valor_avista: valorAvista, valor_parcelado: valorParcelado,
                max_parcelas: maxParcelas, credor: credorNome,
              };
              await salvarEResponder('proposta_enviada');
              break;
            }
          }

          // No debtor found — ask for CPF
          resposta = `Olá! Para consultar sua situação, por favor me informe seu CPF.`;
          await salvarEResponder('aguardando_cpf');
          break;
        }

        resposta = `Para uma nova consulta, digite "menu". Para falar com um negociador: (62) 98218-3144.`;
        await salvarEResponder(etapaAtual);
        break;
      }

      default: {
        resposta = `Olá! Para consultar sua situação financeira, me informe seu CPF.`;
        await salvarEResponder('aguardando_cpf');
      }
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

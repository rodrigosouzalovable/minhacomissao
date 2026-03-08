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

const ADMIN_NUMERO = '5562991672674';

async function notificarAdmin(serverUrl: string, instanceToken: string, telefoneCliente: string, telefoneInstancia: string, textoCliente: string) {
  try {
    const msg = `Olá Rodrigo, na mensagem enviada pelo número ${telefoneCliente} para o número ${telefoneInstancia}, o cliente respondeu algo que eu não soube informar: "${textoCliente}". Você poderia analisar por favor?`;
    console.log(`[ADMIN] Notificando admin: ${msg}`);
    await sendMessage(serverUrl, instanceToken, ADMIN_NUMERO, msg);
  } catch (e) {
    console.error('[ADMIN] Falha ao notificar admin:', e);
  }
}
}

// AI only for INTENT interpretation — never for composing responses
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
          { role: 'system', content: 'Você interpreta a intenção do cliente em uma negociação de dívida. Responda APENAS com uma das opções listadas.' },
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

      // --- DESBLOQUEIO: admin respondeu manualmente a um cliente aguardando_humano ---
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
    const texto = (payload?.message?.text || payload?.body || payload?.text || payload?.message?.body || payload?.message?.conversation || payload?.message?.extendedTextMessage?.text || payload?.message?.content?.text || '').trim();

    if (!telefone || !texto) {
      return new Response(JSON.stringify({ success: true, ignored: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Mensagem de ${telefone}: "${texto}"`);

    // Chatbot ativo?
    const { data: chatbotConfig } = await supabase.from('chatbot_config').select('ativo').limit(1).single();
    if (!chatbotConfig?.ativo) {
      return new Response(JSON.stringify({ success: true, ignored: true, reason: 'disabled' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const serverUrl = payload?.BaseUrl?.replace(/\/+$/, '') || Deno.env.get('UAZAPI_SERVER_URL');
    const instanceToken = payload?.token || Deno.env.get('UAZAPI_INSTANCE_TOKEN');

    // Check instance owner
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
    dados = addToHistorico(dados, 'cliente', texto);

    const textoLower = texto.toLowerCase().trim();

    // Reset commands
    if (['menu', 'inicio', 'início', 'voltar', 'reiniciar'].includes(textoLower) && etapaAtual !== 'novo') {
      etapaAtual = 'novo';
      dados = { mensagens_historico: dados.mensagens_historico || [] };
    }

    // Greetings reset only if not in active negotiation
    const etapasAtivas = ['proposta_enviada', 'oferta_valores', 'aguardando_parcelas', 'aguardando_confirmacao_identidade', 'aguardando_pagamento_hoje', 'aguardando_data', 'aguardando_humano'];
    if (['oi', 'olá', 'ola', 'bom dia', 'boa tarde', 'boa noite'].includes(textoLower) && etapaAtual !== 'novo' && !etapasAtivas.includes(etapaAtual)) {
      etapaAtual = 'novo';
      dados = { mensagens_historico: dados.mensagens_historico || [] };
    }

    let resposta = '';

    // Extract instance phone number from payload
    const telefoneInstancia = (payload?.phone || payload?.instance?.wuid || payload?.wuid || '').replace(/\D/g, '') || 'desconhecido';

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
      await notificarAdmin(serverUrl!, instanceToken!, telefone, telefoneInstancia, textoCliente);
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
          resposta = `Olá! Para consultar sua situação, por favor me informe seu CPF.`;
          await salvarEResponder('aguardando_cpf');
          break;
        }

        // Waiting for CPF input
        const cpf = extractCpf(texto);
        if (!cpf) {
          resposta = `Não consegui identificar um CPF válido. Por favor, envie seu CPF com 11 dígitos. Exemplo: 123.456.789-00`;
          await salvarEResponder('aguardando_cpf');
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

        resposta = `Olá ${primeiroNomeCap}, você consegue voltar a pagar suas parcelas em aberto com ${credorNome} com 50% de desconto?`;

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

          resposta = `Olá ${primeiroNomeCap}, você consegue voltar a pagar suas parcelas em aberto com ${credorNome} com 50% de desconto?`;

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
        // Client responds to "consegue voltar a pagar com 50% de desconto?"
        const intencao = await interpretarIntencao(texto, ['sim', 'nao']);
        const isSim = intencao?.includes('sim') ||
          ['sim', 'consigo', 'sim consigo', 'quero', 'pode ser', 'sim como fica', 'aceito', 'quero sim', 'como fica', 'tô querendo', 'to querendo'].includes(textoLower);

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

          const valorParcelaMin = valorParcelado / maxParcelas;

          resposta = `Que ótimo! Estamos com uma super oportunidade para você quitar todo débito em aberto pelo valor de *${formatCurrency(valorAvista)}*. Ou podemos parcelar para você em *${maxParcelas}x de ${formatCurrency(valorParcelaMin)}*. Como fica melhor para você?`;

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
        let escolha = textoLower === '1' ? 'avista' : textoLower === '2' ? 'parcelado' : null;

        if (!escolha) {
          const intencao = await interpretarIntencao(texto, ['avista', 'parcelado', 'nenhuma']);
          if (intencao?.includes('avista')) escolha = 'avista';
          else if (intencao?.includes('parcelado')) escolha = 'parcelado';
        }

        // Ensure values are valid numbers with fallback
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

        if (escolha === 'avista') {
          dados = { ...dados, tipo_pagamento: 'avista', parcelas: 1, valor_final: vaOfertas };
          resposta = `Você consegue fazer o pagamento hoje?`;
          await salvarEResponder('aguardando_pagamento_hoje');
          break;

        } else if (escolha === 'parcelado') {
          dados = { ...dados, tipo_pagamento: 'parcelado', valor_final: vpOfertas };
          resposta = `Você consegue fazer o pagamento hoje?`;
          await salvarEResponder('aguardando_pagamento_hoje');
          break;

        } else {
          // AI não entendeu — notificar admin e silenciar
          console.log(`[SILÊNCIO] oferta_valores: não entendeu escolha: "${texto}"`);
          await salvarSilenciosoENotificar('oferta_valores', texto);
          break;
        }
      }

      // -------- CONSEGUE PAGAR HOJE? --------
      case 'aguardando_pagamento_hoje': {
        const intencao = await interpretarIntencao(texto, ['sim', 'nao']);
        const isSim = intencao?.includes('sim') ||
          ['sim', 'consigo', 'sim consigo', 'hoje mesmo', 'pode ser', 'sim pode', 'ok'].includes(textoLower);
        const isNao = intencao?.includes('nao') ||
          ['não', 'nao', 'não consigo', 'nao consigo', 'agora não', 'agora nao', 'não hoje', 'nao hoje', 'outro dia'].includes(textoLower);

        if (isSim) {
          resposta = `Ok! Iremos te enviar o boleto para pagamento hoje.`;
          // TODO: here you can trigger boleto generation
          await salvarEResponder('acordo_finalizado', { data_pagamento: 'hoje' });
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
            break;
          } else if (intencao?.includes('amanha')) {
            const amanha = new Date();
            amanha.setDate(amanha.getDate() + 1);
            resposta = `OK, irei te enviar o boleto para essa data!`;
            await salvarEResponder('acordo_finalizado', { data_pagamento: formatDataBR(amanha) });
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

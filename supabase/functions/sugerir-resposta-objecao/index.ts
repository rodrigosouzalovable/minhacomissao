// Copiloto de objeções: gera sugestões de resposta para o atendente durante o atendimento.
// Uma chamada de IA por mensagem do cliente (cache no banco por mensagem_id).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, json, chamarIA, extrairJson } from '../_shared/iago.ts';

const CHAVES = ['sem_condicoes', 'caro', 'vou_pensar', 'mes_que_vem', 'desconfianca', 'outro'] as const;

function normalizar(t: string) {
  return String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** Detector local (sem IA) — devolve a chave provável ou null. */
export function detectarObjecao(texto: string): string | null {
  const t = normalizar(texto);
  if (!t || t.length < 3) return null;
  if (/(nao tenho|sem) (condic|dinheiro|como pagar)|nao tenho como|estou desempregad|to desempregad|nao da pra pagar|nao consigo pagar|sem grana|apertad/.test(t)) return 'sem_condicoes';
  if (/(muito|ta|esta|e) car[oa]|acima do que|nao vale|abusiv|absurd|valor alto|parcela alta|diminui|abaixa|desconto maior|melhor(a|e) (a|o) (proposta|valor)/.test(t)) return 'caro';
  if (/vou pensar|vou ver|depois eu|te (aviso|retorno)|analisar|pensar melhor|conversar com/.test(t)) return 'vou_pensar';
  if (/mes que vem|proximo mes|semana que vem|dia \d{1,2}|quando (eu )?receber|so no (dia|mes)|mais pra frente|adiant|salario/.test(t)) return 'mes_que_vem';
  if (/golpe|nao confio|isso e verdade|voce e (real|de verdade)|como (eu )?sei|nunca fiz|nao reconheco|nao devo|ja paguei/.test(t)) return 'desconfianca';
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  try {
    const body = await req.json().catch(() => ({}));
    const instancia_id = String(body?.instancia_id || '');
    const telefone = String(body?.telefone || '');
    const mensagem_id = String(body?.mensagem_id || '');
    const credorEntrada = String(body?.credor || '').trim();
    const forcar = !!body?.forcar;
    const usuario_id = body?.usuario_id ? String(body.usuario_id) : null;

    if (!instancia_id || !telefone || !mensagem_id) {
      return json({ success: false, error: 'instancia_id, telefone e mensagem_id são obrigatórios' }, 400);
    }

    // Cache
    const { data: existente } = await supabase
      .from('objecao_sugestoes_log')
      .select('id, objecao_chave, sugestoes')
      .eq('instancia_id', instancia_id).eq('telefone', telefone).eq('mensagem_id', mensagem_id)
      .maybeSingle();

    if (existente && !forcar) {
      return json({ success: true, cache: true, log_id: existente.id, objecao: existente.objecao_chave, sugestoes: existente.sugestoes || [] });
    }

    // Histórico da conversa (últimas 20)
    const { data: msgs } = await supabase
      .from('meta_whatsapp_mensagens')
      .select('direcao, conteudo, tipo_conteudo, transcricao, criado_em')
      .eq('instancia_id', instancia_id).eq('telefone', telefone)
      .order('criado_em', { ascending: false })
      .limit(20);

    const historico = [...((msgs || []) as any[])].reverse()
      .map((m) => {
        const txt = String(m.conteudo || m.transcricao || '').replace(/\s+/g, ' ').trim();
        if (!txt) return '';
        return `${m.direcao === 'entrada' ? 'CLIENTE' : 'ATENDENTE'}: ${txt.slice(0, 400)}`;
      })
      .filter(Boolean);

    const ultimaCliente = [...((msgs || []) as any[])].find((m) => m.direcao === 'entrada');
    const textoCliente = String(body?.texto || ultimaCliente?.conteudo || ultimaCliente?.transcricao || '').trim();
    if (!historico.length && !textoCliente) return json({ success: false, error: 'sem histórico da conversa' }, 400);

    // Contato / credor
    const { data: contato } = await supabase
      .from('meta_whatsapp_contatos')
      .select('nome, cpf, credor')
      .eq('instancia_id', instancia_id).eq('telefone', telefone)
      .maybeSingle();

    const credor = credorEntrada || String((contato as any)?.credor || '').trim();
    const objecaoLocal = detectarObjecao(textoCliente);

    // Catálogo do que já funciona
    let q = supabase.from('objecao_catalogo')
      .select('id, objecao_chave, resposta, usos, conversoes, score')
      .eq('ativo', true)
      .order('score', { ascending: false })
      .limit(12);
    if (objecaoLocal) q = q.eq('objecao_chave', objecaoLocal);
    const { data: catalogo } = await q;

    const catalogoTxt = ((catalogo || []) as any[]).length
      ? ((catalogo || []) as any[]).map((c) =>
          `- [${c.objecao_chave}] (${c.conversoes}/${c.usos} conversões) ${String(c.resposta).slice(0, 300)}`).join('\n')
      : '(catálogo ainda vazio)';

    const system = [
      'Você é uma consultora sênior de negociação de dívidas por WhatsApp no Brasil.',
      'Um atendente HUMANO está negociando e o cliente acabou de trazer uma objeção. Sugira respostas para o atendente enviar.',
      'Regras obrigatórias:',
      '- Escreva como o atendente falaria no WhatsApp: português brasileiro, primeira pessoa, tom cordial, direto e humano. Sem emoji em excesso (no máximo 1).',
      '- Cada sugestão com no máximo 380 caracteres, pronta para enviar, sem placeholders entre colchetes.',
      '- NUNCA invente valores, descontos, prazos ou parcelas que não estejam no histórico da conversa. Se precisar citar valor, use exatamente o que já foi enviado.',
      '- Parcela mínima é R$ 100,00. Nunca prometa condição fora do que o sistema já ofereceu.',
      '- Trate a objeção de frente, valide o cliente, reduza atrito e conduza para o fechamento (confirmar forma de pagamento ou data).',
      '- Varie as abordagens entre as 3 sugestões (ex.: empatia + reforço de benefício; alternativa de parcelamento já ofertada; urgência/prazo).',
      credor ? `- Credor da negociação: ${credor}.` : '',
      '',
      'Respostas que já converteram bem nesta operação (use como referência de estilo e argumento):',
      catalogoTxt,
      '',
      `Classifique a objeção em uma destas chaves: ${CHAVES.join(', ')}.`,
      'Responda SOMENTE com JSON: {"objecao":"chave","sugestoes":[{"texto":"..."},{"texto":"..."},{"texto":"..."}]}',
    ].filter(Boolean).join('\n');

    const user = [
      contato?.nome ? `Cliente: ${contato.nome}` : '',
      contato?.cpf ? `CPF: ${contato.cpf}` : '',
      objecaoLocal ? `Objeção provável detectada pelo sistema: ${objecaoLocal}` : '',
      '',
      'Conversa (ordem cronológica):',
      historico.join('\n').slice(0, 8000),
      '',
      `Última mensagem do cliente: ${textoCliente.slice(0, 600)}`,
    ].filter(Boolean).join('\n');

    let out = '';
    try {
      out = await chamarIA(system, user, 'google/gemini-3.7-flash');
    } catch (e: any) {
      const m = String(e?.message || e);
      if (m === 'rate_limit') return json({ success: false, error: 'Muitas requisições de IA. Aguarde alguns segundos.' }, 429);
      if (m === 'sem_creditos') return json({ success: false, error: 'Créditos de IA esgotados. Adicione créditos no workspace.' }, 402);
      return json({ success: false, error: `Falha na IA: ${m}` }, 502);
    }

    const parsed = extrairJson(out);
    const lista = Array.isArray(parsed?.sugestoes) ? parsed.sugestoes : [];
    const sugestoes = lista
      .map((s: any) => ({ texto: String(s?.texto || s || '').trim().slice(0, 500) }))
      .filter((s: any) => s.texto.length > 10)
      .slice(0, 3);

    if (!sugestoes.length) return json({ success: false, error: 'IA não retornou sugestões' }, 502);

    const objecao = CHAVES.includes(parsed?.objecao) ? parsed.objecao : (objecaoLocal || 'outro');

    // Grava as sugestões novas no catálogo (para medir conversão depois)
    const catIds: string[] = [];
    for (const s of sugestoes) {
      const { data: ins } = await supabase.from('objecao_catalogo')
        .insert({ objecao_chave: objecao, resposta: s.texto, origem: 'ia', credor: credor || null })
        .select('id').maybeSingle();
      if (ins?.id) catIds.push(ins.id);
    }

    const payload = {
      instancia_id, telefone, mensagem_id,
      objecao_chave: objecao,
      sugestoes: sugestoes.map((s: any, i: number) => ({ texto: s.texto, catalogo_id: catIds[i] || null })),
      catalogo_ids: catIds,
      usuario_id,
      resultado: 'pendente',
      usada_idx: null,
    };

    const { data: log, error: logErr } = await supabase.from('objecao_sugestoes_log')
      .upsert(payload, { onConflict: 'instancia_id,telefone,mensagem_id' })
      .select('id').maybeSingle();
    if (logErr) console.error('[objecao] erro ao gravar log', logErr.message);

    return json({ success: true, log_id: log?.id || null, objecao, sugestoes: payload.sugestoes });
  } catch (e: any) {
    console.error('[sugerir-resposta-objecao]', e?.message || e);
    return json({ success: false, error: String(e?.message || e) }, 500);
  }
});

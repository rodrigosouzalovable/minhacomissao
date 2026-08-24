// Aprendizado do copiloto de objeções: fecha os logs pendentes, calcula conversão
// por resposta e consolida as vencedoras no catálogo.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, json, soDigitos, chamarIA, extrairJson } from '../_shared/iago.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  try {
    const limite = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { data: pendentes } = await supabase
      .from('objecao_sugestoes_log')
      .select('id, instancia_id, telefone, objecao_chave, catalogo_ids, usada_idx, criado_em')
      .eq('resultado', 'pendente')
      .lt('criado_em', limite)
      .order('criado_em')
      .limit(200);

    let fechados = 0;
    const contagem = new Map<string, { usos: number; conv: number }>();

    for (const log of ((pendentes || []) as any[])) {
      // O cliente respondeu depois da sugestão?
      const { count: respostas } = await supabase
        .from('meta_whatsapp_mensagens')
        .select('id', { count: 'exact', head: true })
        .eq('instancia_id', log.instancia_id)
        .eq('telefone', log.telefone)
        .eq('direcao', 'entrada')
        .gt('criado_em', log.criado_em);

      // Virou acordo?
      let virouAcordo = false;
      const { data: contato } = await supabase
        .from('meta_whatsapp_contatos')
        .select('cpf')
        .eq('instancia_id', log.instancia_id).eq('telefone', log.telefone)
        .maybeSingle();
      const cpf = soDigitos((contato as any)?.cpf || '');
      if (cpf.length >= 9) {
        const { count } = await supabase
          .from('acordos')
          .select('id', { count: 'exact', head: true })
          .ilike('cpf', `%${cpf.slice(-9)}%`)
          .gte('criado_em', log.criado_em);
        virouAcordo = (count || 0) > 0;
      }

      const resultado = virouAcordo ? 'acordo' : ((respostas || 0) > 0 ? 'respondeu' : 'sem_retorno');
      await supabase.from('objecao_sugestoes_log').update({ resultado }).eq('id', log.id);
      fechados++;

      const usadaId = typeof log.usada_idx === 'number' ? (log.catalogo_ids || [])[log.usada_idx] : null;
      if (usadaId) {
        const atual = contagem.get(usadaId) || { usos: 0, conv: 0 };
        atual.usos += 1;
        if (resultado === 'acordo') atual.conv += 1;
        else if (resultado === 'respondeu') atual.conv += 0.3;
        contagem.set(usadaId, atual);
      }
    }

    // Atualiza contadores e score do catálogo
    for (const [id, c] of contagem) {
      const { data: row } = await supabase.from('objecao_catalogo')
        .select('usos, conversoes').eq('id', id).maybeSingle();
      const usos = (Number((row as any)?.usos) || 0) + c.usos;
      const conversoes = (Number((row as any)?.conversoes) || 0) + Math.round(c.conv);
      const score = usos > 0 ? Number(((conversoes / usos) * Math.min(1, usos / 5) * 100).toFixed(2)) : 0;
      await supabase.from('objecao_catalogo').update({ usos, conversoes, score }).eq('id', id);
    }

    // Limpeza: sugestões que nunca foram usadas, com mais de 14 dias e não fixadas
    const velho = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString();
    await supabase.from('objecao_catalogo').delete()
      .eq('origem', 'ia').eq('usos', 0).eq('fixada', false).lt('criado_em', velho);

    // Consolidação: transforma as vencedoras em padrões de aprendizado
    const { data: melhores } = await supabase.from('objecao_catalogo')
      .select('objecao_chave, resposta, usos, conversoes, score')
      .eq('ativo', true).gte('usos', 3)
      .order('score', { ascending: false }).limit(25);

    let aprendizados = 0;
    if ((melhores || []).length >= 3) {
      const system = [
        'Você analisa respostas reais de negociação de dívidas por WhatsApp com a taxa de conversão de cada uma.',
        'Consolide as que mais converteram em respostas modelo reutilizáveis, uma por tipo de objeção.',
        'Sem nomes, CPFs, telefones ou valores específicos. Máximo 380 caracteres por resposta, pronta para enviar.',
        'Responda SOMENTE com JSON: {"modelos":[{"objecao":"sem_condicoes","resposta":"..."}]} (máximo 6 modelos).',
      ].join('\n');
      const user = ((melhores || []) as any[])
        .map((m) => `[${m.objecao_chave}] score ${m.score} (${m.conversoes}/${m.usos}): ${m.resposta}`)
        .join('\n').slice(0, 12000);

      try {
        const parsed = extrairJson(await chamarIA(system, user, 'google/gemini-3.7-flash'));
        const modelos = Array.isArray(parsed?.modelos) ? parsed.modelos : [];
        if (modelos.length) {
          await supabase.from('objecao_catalogo').delete().eq('origem', 'aprendizado').eq('fixada', false);
          const rows = modelos.slice(0, 6).map((m: any) => ({
            objecao_chave: String(m?.objecao || 'outro').slice(0, 40),
            resposta: String(m?.resposta || '').slice(0, 500),
            origem: 'aprendizado',
            score: 60,
          })).filter((r: any) => r.resposta.length > 10);
          if (rows.length) {
            const { error } = await supabase.from('objecao_catalogo').insert(rows);
            if (error) console.error('[objecao-aprender] insert', error.message);
            else aprendizados = rows.length;
          }
        }
      } catch (e: any) {
        console.error('[objecao-aprender] IA', e?.message || e);
      }
    }

    console.log('[objecao-aprender]', { fechados, atualizados: contagem.size, aprendizados });
    return json({ success: true, fechados, atualizados: contagem.size, aprendizados });
  } catch (e: any) {
    console.error('[objecao-aprender] erro', e?.message || e);
    return json({ success: false, error: String(e?.message || e) }, 500);
  }
});

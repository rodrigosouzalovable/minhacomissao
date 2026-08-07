// Aprendizado do IAGO: lê conversas de clientes que fecharam acordo com os operadores,
// extrai os padrões que funcionaram e grava como conhecimento (tipo "aprendizado").
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, json, soDigitos, sufixo8, carregarConfig, chamarIA, extrairJson } from '../_shared/iago.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  try {
    const cfg = await carregarConfig(supabase);
    const body = await req.json().catch(() => ({}));
    const forcar = !!body?.forcar;
    if (!forcar && !cfg?.aprendizado_auto) return json({ success: true, skipped: 'aprendizado automático desligado' });

    // Acordos recentes fechados (30 dias)
    const desde = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    const { data: acordos } = await supabase
      .from('acordos')
      .select('cpf, nome, criado_em')
      .gte('criado_em', desde)
      .order('criado_em', { ascending: false })
      .limit(60);

    if (!(acordos || []).length) return json({ success: true, skipped: 'sem acordos recentes' });

    // Telefones desses CPFs
    const cpfs = [...new Set(((acordos || []) as any[]).map((a) => soDigitos(a.cpf)).filter(Boolean))].slice(0, 40);
    const sufixos = new Set<string>();
    for (const cpf of cpfs) {
      const { data: devs } = await supabase
        .from('devedores').select('telefone').ilike('cpf', `%${cpf.slice(-9)}%`).limit(3);
      for (const d of (devs || []) as any[]) {
        const s = sufixo8(d.telefone);
        if (s.length === 8) sufixos.add(s);
      }
      const { data: tels } = await supabase
        .from('devedor_telefones').select('numero').ilike('devedor_cpf', `%${cpf.slice(-9)}%`).limit(3);
      for (const t of (tels || []) as any[]) {
        const s = sufixo8(t.numero);
        if (s.length === 8) sufixos.add(s);
      }
    }

    if (!sufixos.size) return json({ success: true, skipped: 'sem telefones vinculados aos acordos' });

    // Conversas dessas pessoas (amostra)
    const conversas: string[] = [];
    for (const suf of [...sufixos].slice(0, 15)) {
      const { data: msgs } = await supabase
        .from('meta_whatsapp_mensagens')
        .select('direcao, conteudo, criado_em')
        .ilike('telefone', `%${suf}`)
        .order('criado_em', { ascending: true })
        .limit(30);
      const linhas = ((msgs || []) as any[])
        .filter((m) => String(m.conteudo || '').trim())
        .map((m) => `${m.direcao === 'entrada' ? 'CLIENTE' : 'OPERADOR'}: ${String(m.conteudo).replace(/\s+/g, ' ').slice(0, 300)}`);
      if (linhas.length >= 4) conversas.push(linhas.join('\n'));
    }

    if (!conversas.length) return json({ success: true, skipped: 'sem conversas suficientes para aprender' });

    const system = [
      'Você analisa conversas reais de negociação de dívidas por WhatsApp que TERMINARAM EM ACORDO FECHADO.',
      'Extraia o que os operadores humanos fizeram de eficaz, para treinar um novo atendente da equipe.',
      'Foque em: abordagem inicial, forma de apresentar valores, resposta a objeções ("não tenho dinheiro", "vou pensar", "é caro"), senso de urgência, forma de conduzir ao fechamento e tom de voz.',
      'Não inclua nomes de clientes, CPFs, telefones nem valores específicos — só padrões reutilizáveis.',
      'Responda SOMENTE com JSON: {"aprendizados":[{"titulo":"objeção: é caro","conteudo":"instrução prática em 1 ou 2 frases"}]}',
      'Máximo de 8 aprendizados, cada conteudo com no máximo 300 caracteres, escritos como instrução ao atendente.',
    ].join('\n');

    const out = await chamarIA(system, conversas.join('\n\n---\n\n').slice(0, 24000));
    const parsed = extrairJson(out);
    const lista = Array.isArray(parsed?.aprendizados) ? parsed.aprendizados : [];
    if (!lista.length) return json({ success: false, error: 'IA não retornou aprendizados' });

    // Substitui os aprendizados automáticos anteriores (mantém os manuais e os desativados por você)
    await supabase.from('iago_conhecimento').delete().eq('tipo', 'aprendizado').eq('origem', 'auto').eq('ativo', true);

    const rows = lista.slice(0, 8).map((a: any) => ({
      tipo: 'aprendizado',
      gatilho: String(a?.titulo || '').slice(0, 120) || null,
      conteudo: String(a?.conteudo || '').slice(0, 600),
      origem: 'auto',
      ativo: true,
    })).filter((r: any) => r.conteudo);

    const { error } = await supabase.from('iago_conhecimento').insert(rows);
    if (error) throw error;

    console.log('[IAGO aprender]', { conversas: conversas.length, aprendizados: rows.length });
    return json({ success: true, conversas: conversas.length, aprendizados: rows.length });
  } catch (e: any) {
    console.error('[IAGO aprender] erro', e?.message || e);
    return json({ success: false, error: String(e?.message || e) }, 500);
  }
});

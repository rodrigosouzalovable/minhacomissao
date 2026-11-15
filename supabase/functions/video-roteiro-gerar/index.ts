import { requireCaller } from '../_shared/auth-guard.ts';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const SYSTEM = `Você é roteirista de vídeos curtos virais (TikTok, YouTube Shorts, Reels) em português do Brasil.
Crie roteiros de alta retenção: gancho de choque em até 3s, curiosidade acelerada e CTA final para um produto de afiliado (link no comentário fixado/bio).
Nunca use trechos protegidos de forma enganosa; trate rumores como rumores.
Responda APENAS JSON: {"gancho":string,"roteiro":string (narração completa),"cenas":[{"segundos":string,"prompt_visual":string (em inglês, cinematográfico, vertical 9:16),"narracao":string}],"cta":string,"legenda":string,"hashtags":string}`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const caller = await requireCaller(req, { user: 'admin' });
  if (caller instanceof Response) return caller;
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  try {
    const body = await req.json().catch(() => ({}));
    const tema = String(body?.tema || '').trim().slice(0, 300);
    const nicho = String(body?.nicho || 'GTA 6').trim().slice(0, 80);
    const duracao = Math.min(90, Math.max(10, Number(body?.duracao) || 30));
    const produto = String(body?.produto || '').trim().slice(0, 200);
    if (!tema) return json({ error: 'Informe o tema do vídeo.' }, 400);
    const key = Deno.env.get('LOVABLE_API_KEY');
    if (!key) return json({ error: 'IA não configurada.' }, 500);
    const user = `Nicho: ${nicho}\nTema: ${tema}\nDuração: ${duracao}s (4 a 6 cenas)\nProduto para o CTA: ${produto || 'acessório gamer em geral'}`;
    const r = await fetch('https://ai.gateway.lovable.dev/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Lovable-API-Key': key, 'X-Lovable-AIG-SDK': 'fetch' },
      body: JSON.stringify({ model: 'openai/gpt-6-astra', store: false, reasoning: { effort: 'low' }, input: [
        { role: 'developer', content: [{ type: 'input_text', text: SYSTEM }] },
        { role: 'user', content: [{ type: 'input_text', text: user }] },
      ] }),
    });
    if (r.status === 429) return json({ error: 'Muitas solicitações, tente em instantes.' }, 429);
    if (r.status === 402) return json({ error: 'Créditos de IA esgotados.' }, 402);
    if (!r.ok) return json({ error: `Falha na IA (${r.status})` }, 502);
    const d = await r.json();
    let txt = '';
    for (const o of d?.output || []) for (const c of o?.content || []) if (c?.type === 'output_text') txt += c.text;
    txt = txt.trim().replace(/^```(json)?\s*/i, '').replace(/```$/, '');
    const out = JSON.parse(txt);
    return json({ ok: true, ...out });
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 500);
  }
});

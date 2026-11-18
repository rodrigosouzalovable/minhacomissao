import { requireCaller } from '../_shared/auth-guard.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const INSTR: Record<string, string> = {
  para_pt: 'Traduza cada texto para português do Brasil, natural e fiel. Se já estiver em português, repita igual.',
  para_en: 'Rewrite each Portuguese text as natural, friendly, professional US English for a WhatsApp sales conversation with a business owner. Keep meaning, prices and links exactly. No extra content.',
  para_es: 'Reescribe cada texto en español neutro latinoamericano, natural, amable y profesional para una conversación comercial por WhatsApp. Mantén significado, precios y enlaces exactos. Sin contenido extra.',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const caller = await requireCaller(req, { user: 'staff', corsHeaders });
  if (caller instanceof Response) return caller;
  try {
    const body = await req.json().catch(() => null);
    const modo = body?.modo;
    const textos = body?.textos;
    if (!INSTR[modo] || !Array.isArray(textos) || textos.length === 0 || textos.length > 80
      || textos.some((t: unknown) => typeof t !== 'string' || t.length > 4000)) {
      return json({ error: 'Dados inválidos' }, 400);
    }
    const key = Deno.env.get('LOVABLE_API_KEY');
    if (!key) return json({ error: 'IA não configurada' }, 500);
    const r = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-3.1-flash-lite',
        messages: [
          { role: 'system', content: `${INSTR[modo]} Responda SOMENTE com JSON {"t": [..]} contendo exatamente ${textos.length} strings, na mesma ordem.` },
          { role: 'user', content: JSON.stringify(textos) },
        ],
        response_format: { type: 'json_object' },
      }),
    });
    if (r.status === 429) return json({ error: 'Muitas solicitações, tente em instantes.' }, 429);
    if (r.status === 402) return json({ error: 'Créditos de IA esgotados.' }, 402);
    if (!r.ok) return json({ error: 'Falha na tradução' }, 502);
    const d = await r.json();
    const raw = String(d?.choices?.[0]?.message?.content || '').replace(/^```(json)?|```$/g, '').trim();
    const parsed = JSON.parse(raw);
    const out = Array.isArray(parsed?.t) ? parsed.t.map((x: unknown) => String(x ?? '')) : [];
    if (out.length !== textos.length) return json({ error: 'Tradução incompleta, tente novamente.' }, 502);
    return json({ traducoes: out });
  } catch (_e) {
    return json({ error: 'Falha na tradução' }, 500);
  }
});

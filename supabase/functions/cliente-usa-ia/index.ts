import { createClient } from 'npm:@supabase/supabase-js@2';
import { clienteUsaAtivo, gerarRespostaClienteUsa } from '../_shared/cliente-usa-ia.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: u } = await sb.auth.getUser(token);
    if (!u?.user) return json({ error: 'Não autenticado' }, 401);
    const { data: cfg } = await sb.from('cliente_usa_config').select('*').eq('user_id', u.user.id).maybeSingle();
    const { data: isAdmin } = await sb.rpc('has_role', { _user_id: u.user.id, _role: 'admin' });
    if (!isAdmin && !clienteUsaAtivo(cfg)) return json({ error: 'Trial expired' }, 403);

    const body = await req.json().catch(() => null);
    const msgs = body?.mensagens;
    const prompt = typeof body?.prompt === 'string' ? body.prompt.slice(0, 8000) : (cfg?.prompt_ia || '');
    const idioma = ['auto', 'en', 'es', 'pt'].includes(body?.idioma) ? body.idioma : (cfg?.idioma || 'auto');
    if (!Array.isArray(msgs) || msgs.length === 0 || msgs.length > 30 ||
      msgs.some((m: any) => !['user', 'assistant'].includes(m?.role) || typeof m?.content !== 'string' || m.content.length > 2000)) {
      return json({ error: 'Dados inválidos' }, 400);
    }
    const resposta = await gerarRespostaClienteUsa(prompt, idioma, msgs);
    return json({ resposta });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

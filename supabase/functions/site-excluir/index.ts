import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { getCloudflareCreds } from '../_shared/cloudflareCreds.ts';

const CF_API = 'https://api.cloudflare.com/client/v4';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader) return json({ success: false, error: 'Não autenticado' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!supabaseUrl || !supabaseAnonKey) return json({ success: false, error: 'Configuração do backend incompleta.' }, 500);
    const supabase = createClient(
      supabaseUrl,
      supabaseAnonKey,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return json({ success: false, error: 'Sessão inválida' }, 401);

    const body = await req.json().catch(() => ({}));
    const id = String(body?.id ?? '');
    if (!id) return json({ success: false, error: 'Informe o id do site.' }, 400);

    const { data: site, error: erroBusca } = await supabase
      .from('sites_gerados')
      .select('id, worker_name')
      .eq('id', id)
      .maybeSingle();
    if (erroBusca) return json({ success: false, error: erroBusca.message }, 500);
    if (!site) return json({ success: false, error: 'Site não encontrado.' }, 404);

    const { token, accountId } = await getCloudflareCreds();
    if (site.worker_name && token && accountId) {
      const del = await fetch(`${CF_API}/accounts/${accountId}/workers/scripts/${site.worker_name}?force=true`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!del.ok) console.error('cloudflare delete falhou', await del.text());
    }

    const { error } = await supabase.from('sites_gerados').delete().eq('id', id);
    if (error) return json({ success: false, error: error.message }, 500);

    return json({ success: true });
  } catch (error: any) {
    console.error('site-excluir erro', error);
    return json({ success: false, error: error?.message ?? 'Erro inesperado' }, 500);
  }
});

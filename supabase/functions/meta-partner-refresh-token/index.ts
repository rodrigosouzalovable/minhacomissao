import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const GRAPH_VERSION = 'v21.0';

interface Body {
  cliente_id?: string;
}

async function graphPost(path: string, params: URLSearchParams) {
  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabase = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const appId = Deno.env.get('META_APP_ID') || '1081283281394312';
    const appSecret = Deno.env.get('META_APP_SECRET');
    if (!appSecret) {
      return new Response(
        JSON.stringify({
          success: false,
          error:
            'META_APP_SECRET não configurado. Adicione o secret da aplicação Meta nas configurações do projeto.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: Body = await req.json().catch(() => ({}));
    const clienteId = body?.cliente_id?.trim();
    if (!clienteId) {
      return new Response(
        JSON.stringify({ success: false, error: 'cliente_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: cliente, error } = await supabase
      .from('meta_partner_clients')
      .select('id, access_token, token_expira_em')
      .eq('id', clienteId)
      .maybeSingle();
    if (error) throw error;
    if (!cliente?.access_token) {
      return new Response(
        JSON.stringify({ success: false, error: 'Cliente não possui token para refresh.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const params = new URLSearchParams();
    params.set('grant_type', 'fb_exchange_token');
    params.set('client_id', appId);
    params.set('client_secret', appSecret);
    params.set('fb_exchange_token', cliente.access_token);

    const refreshed = await graphPost('/oauth/access_token', params);
    if (refreshed.status >= 400 || !refreshed.data?.access_token) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Não foi possível renovar o token',
          raw: refreshed.data,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const expiresIn = refreshed.data.expires_in || 5184000; // ~60 dias
    const tokenExpiraEm = new Date(Date.now() + Number(expiresIn) * 1000).toISOString();

    const { error: updateErr } = await supabase
      .from('meta_partner_clients')
      .update({
        access_token: refreshed.data.access_token,
        token_expira_em: tokenExpiraEm,
        atualizado_em: new Date().toISOString(),
      })
      .eq('id', clienteId);
    if (updateErr) throw updateErr;

    return new Response(
      JSON.stringify({
        success: true,
        cliente_id: clienteId,
        expira_em: tokenExpiraEm,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[meta-partner-refresh-token]', err);
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

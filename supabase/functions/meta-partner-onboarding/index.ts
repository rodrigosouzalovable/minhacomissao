import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const GRAPH_VERSION = 'v21.0';

interface Body {
  code?: string;
  redirect_uri?: string;
  cliente_id?: string;
  nome?: string;
  documento?: string;
  responsavel_nome?: string;
  responsavel_email?: string;
  responsavel_telefone?: string;
}

async function graphGet(path: string, token: string) {
  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

async function graphPost(path: string, params: URLSearchParams, token?: string) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}${path}`, {
    method: 'POST',
    headers,
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
    const code = body?.code?.trim();
    const redirectUri = (body?.redirect_uri || `${supabaseUrl}/functions/v1/meta-partner-onboarding`).trim();

    if (!code) {
      return new Response(
        JSON.stringify({ success: false, error: 'code é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1) Exchange code for short-lived token
    const exchangeParams = new URLSearchParams();
    exchangeParams.set('client_id', appId);
    exchangeParams.set('client_secret', appSecret);
    exchangeParams.set('redirect_uri', redirectUri);
    exchangeParams.set('code', code);

    const exchange = await graphPost('/oauth/access_token', exchangeParams);
    if (exchange.status >= 400 || !exchange.data?.access_token) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Falha ao trocar código por token',
          raw: exchange.data,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const shortToken = exchange.data.access_token;

    // 2) Exchange for long-lived token
    const longParams = new URLSearchParams();
    longParams.set('grant_type', 'fb_exchange_token');
    longParams.set('client_id', appId);
    longParams.set('client_secret', appSecret);
    longParams.set('fb_exchange_token', shortToken);

    const longLived = await graphPost('/oauth/access_token', longParams);
    const accessToken = longLived.data?.access_token || shortToken;
    const expiresIn = longLived.data?.expires_in || exchange.data?.expires_in || 3600;
    const tokenExpiraEm = new Date(Date.now() + Number(expiresIn) * 1000).toISOString();

    // 3) Debug token to understand scope/owner
    const debug = await graphGet(
      `/debug_token?input_token=${accessToken}&access_token=${appId}|${appSecret}`,
      accessToken
    );

    // 4) List businesses accessible by the token
    const businesses = await graphGet('/me/businesses?fields=id,name,verification_status', accessToken);
    const businessList = (businesses.data?.data || []) as any[];

    // 5) List WABAs and phone numbers per business
    const ativos: any[] = [];
    for (const bm of businessList) {
      const wabas = await graphGet(
        `/${bm.id}/owned_whatsapp_business_accounts?fields=id,name,account_review_status,phone_numbers{id,display_phone_number,verified_name,name_status,quality_rating,messaging_limit_tier}`,
        accessToken
      );
      const wabaList = (wabas.data?.data || []) as any[];
      for (const waba of wabaList) {
        const phones = (waba.phone_numbers?.data || []) as any[];
        ativos.push({
          business: { id: bm.id, name: bm.name },
          waba: { id: waba.id, name: waba.name, status: waba.account_review_status },
          phones: phones.map((p) => ({
            id: p.id,
            display_phone_number: p.display_phone_number,
            verified_name: p.verified_name,
            name_status: p.name_status,
            quality_rating: p.quality_rating,
            messaging_limit_tier: p.messaging_limit_tier,
          })),
        });
      }
    }

    // 6) Upsert client record
    let clienteId = body?.cliente_id;
    const updatePayload: Record<string, any> = {
      access_token: accessToken,
      token_expira_em: tokenExpiraEm,
      meta_app_id: appId,
      meta_business_id: businessList[0]?.id || null,
      atualizado_em: new Date().toISOString(),
    };
    if (!clienteId) {
      const insertPayload = {
        nome: body?.nome || `Cliente ${new Date().toLocaleDateString('pt-BR')}`,
        documento: body?.documento || null,
        responsavel_nome: body?.responsavel_nome || null,
        responsavel_email: body?.responsavel_email || null,
        responsavel_telefone: body?.responsavel_telefone || null,
        ativo: true,
        ...updatePayload,
      };
      const { data: novo, error: insertErr } = await supabase
        .from('meta_partner_clients')
        .insert(insertPayload)
        .select('id')
        .single();
      if (insertErr) throw insertErr;
      clienteId = novo.id;
    } else {
      const { error: updateErr } = await supabase
        .from('meta_partner_clients')
        .update(updatePayload)
        .eq('id', clienteId);
      if (updateErr) throw updateErr;
    }

    return new Response(
      JSON.stringify({
        success: true,
        cliente_id: clienteId,
        token_info: {
          tipo: longLived.data?.access_token ? 'long_lived' : 'short_lived',
          expira_em: tokenExpiraEm,
        },
        debug: debug.data,
        ativos,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[meta-partner-onboarding]', err);
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

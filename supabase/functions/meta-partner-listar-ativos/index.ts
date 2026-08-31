import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const GRAPH_VERSION = 'v21.0';

interface Body {
  cliente_id?: string;
}

async function graphGet(path: string, token: string) {
  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
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
      .select('id, nome, access_token, token_expira_em, meta_business_id')
      .eq('id', clienteId)
      .maybeSingle();
    if (error) throw error;
    if (!cliente?.access_token) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Cliente não possui token de acesso configurado.',
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = cliente.access_token;
    const expirado = cliente.token_expira_em && new Date(cliente.token_expira_em) < new Date();

    // Lista negócios e ativos
    const businesses = await graphGet('/me/businesses?fields=id,name,verification_status', token);
    const businessList = (businesses.data?.data || []) as any[];

    const ativos: any[] = [];
    for (const bm of businessList) {
      const wabas = await graphGet(
        `/${bm.id}/owned_whatsapp_business_accounts?fields=id,name,account_review_status,phone_numbers{id,display_phone_number,verified_name,name_status,quality_rating,messaging_limit_tier}`,
        token
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

    return new Response(
      JSON.stringify({
        success: true,
        cliente: {
          id: cliente.id,
          nome: cliente.nome,
          token_expirado: !!expirado,
          token_expira_em: cliente.token_expira_em,
        },
        ativos,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[meta-partner-listar-ativos]', err);
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

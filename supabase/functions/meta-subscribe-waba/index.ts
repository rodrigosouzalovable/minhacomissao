import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const GRAPH_VERSION = 'v21.0';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const webhookUrl = `${supabaseUrl}/functions/v1/meta-whatsapp-webhook`;

    const supabase = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: config, error: configError } = await supabase
      .from('meta_whatsapp_config')
      .select('valor')
      .eq('chave', 'webhook_verify_token')
      .maybeSingle();

    if (configError) throw configError;
    const verifyToken = config?.valor;
    if (!verifyToken) throw new Error('Verify Token compartilhado não configurado');

    const body = await req.json().catch(() => ({}));
    const targetId = body?.instancia_id as string | undefined;

    const q = supabase
      .from('meta_whatsapp_instances')
      .select('id, nome, waba_id, phone_number_id, access_token, ativo');
    const { data: instancias, error } = targetId
      ? await q.eq('id', targetId)
      : await q.eq('ativo', true);
    if (error) throw error;

    const resultados: any[] = [];
    for (const inst of instancias || []) {
      const out: any = {
        id: inst.id,
        nome: inst.nome,
        waba_id: inst.waba_id,
        phone_number_id: inst.phone_number_id,
        webhook_url: webhookUrl,
      };
      try {
        // 1) Subscribe app à WABA forçando o callback correto do sistema.
        const params = new URLSearchParams();
        params.set('override_callback_uri', webhookUrl);
        params.set('verify_token', verifyToken);

        const subRes = await fetch(
          `https://graph.facebook.com/${GRAPH_VERSION}/${inst.waba_id}/subscribed_apps`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${inst.access_token}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params,
          },
        );
        const subData = await subRes.json();
        out.subscribe_ok = subRes.ok && (subData?.success === true || !!subData?.id);
        out.callback_confirmado = out.subscribe_ok;
        out.subscribe_raw = subData;

        // 2) Listar inscrições atuais para diagnóstico visual.
        const listRes = await fetch(
          `https://graph.facebook.com/${GRAPH_VERSION}/${inst.waba_id}/subscribed_apps?fields=id,name,whatsapp_business_api_data`,
          { headers: { Authorization: `Bearer ${inst.access_token}` } },
        );
        out.subscriptions_status = listRes.status;
        out.subscriptions = await listRes.json();
      } catch (e: any) {
        out.error = e?.message || String(e);
        out.subscribe_ok = false;
        out.callback_confirmado = false;
      }
      resultados.push(out);
    }

    return new Response(JSON.stringify({ success: true, resultados }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err?.message || 'Erro' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

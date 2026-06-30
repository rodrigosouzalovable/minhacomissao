import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

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
      const out: any = { id: inst.id, nome: inst.nome, waba_id: inst.waba_id, phone_number_id: inst.phone_number_id };
      try {
        // 1) Subscribe app à WABA
        const subRes = await fetch(
          `https://graph.facebook.com/v21.0/${inst.waba_id}/subscribed_apps`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${inst.access_token}` },
          },
        );
        const subData = await subRes.json();
        out.subscribe_ok = subRes.ok && (subData?.success === true || !!subData?.id);
        out.subscribe_raw = subData;

        // 2) Registrar phone_number_id (necessário em alguns onboardings)
        try {
          const regRes = await fetch(
            `https://graph.facebook.com/v21.0/${inst.phone_number_id}/register`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${inst.access_token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ messaging_product: 'whatsapp', pin: '000000' }),
            },
          );
          out.register_status = regRes.status;
          out.register_raw = await regRes.json().catch(() => null);
        } catch (_) { /* ignora */ }

        // 3) Listar inscrições atuais
        const listRes = await fetch(
          `https://graph.facebook.com/v21.0/${inst.waba_id}/subscribed_apps`,
          { headers: { Authorization: `Bearer ${inst.access_token}` } },
        );
        out.subscriptions = await listRes.json();
      } catch (e: any) {
        out.error = e?.message || String(e);
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

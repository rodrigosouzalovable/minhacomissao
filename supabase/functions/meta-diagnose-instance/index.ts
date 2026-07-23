import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const GRAPH_VERSION = 'v21.0';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const body = await req.json().catch(() => ({}));
    const instanciaId = body?.instancia_id as string | undefined;
    if (!instanciaId) {
      return new Response(JSON.stringify({ success: false, error: 'instancia_id obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: inst, error } = await supabase
      .from('meta_whatsapp_instances')
      .select('id, nome, waba_id, phone_number_id, access_token')
      .eq('id', instanciaId)
      .maybeSingle();
    if (error) throw error;
    if (!inst) throw new Error('Instância não encontrada');

    const auth = { Authorization: `Bearer ${inst.access_token}` };

    // 1) Estado do número
    const phoneRes = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${inst.phone_number_id}?fields=verified_name,display_phone_number,name_status,code_verification_status,quality_rating,throughput,messaging_limit_tier,platform_type,status`,
      { headers: auth },
    );
    const phone = await phoneRes.json();

    // 2) Assinaturas do WABA
    const subRes = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${inst.waba_id}/subscribed_apps?fields=id,name,whatsapp_business_api_data`,
      { headers: auth },
    );
    const subs = await subRes.json();

    // 3) Analytics do dia (para conferir se a Meta contabilizou entregas)
    const now = Math.floor(Date.now() / 1000);
    const start = now - 24 * 3600;
    const anRes = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${inst.waba_id}?fields=analytics.start(${start}).end(${now}).granularity(DAY).phone_numbers(["${inst.display_phone_number ?? ''}"])`,
      { headers: auth },
    );
    const analytics = await anRes.json();

    // Diagnóstico consolidado
    const nameStatus = phone?.name_status || null;
    const quality = phone?.quality_rating || null;
    const hasCallback =
      Array.isArray(subs?.data) &&
      subs.data.some((s: any) => s?.whatsapp_business_api_data?.link || s?.id);

    const problems: string[] = [];
    if (!hasCallback) problems.push('Webhook não assinado nesta WABA — clique em "Webhook" para reinscrever.');
    if (nameStatus && nameStatus !== 'APPROVED') {
      problems.push(
        `Display Name está "${nameStatus}". Meta aceita a chamada, devolve wamid, mas frequentemente descarta a entrega quando o nome não está APPROVED. Solicite aprovação do Display Name no Business Manager.`,
      );
    }
    if (quality === 'RED') problems.push('Qualidade RED — risco alto de bloqueio.');

    const recommendation =
      problems.length === 0
        ? 'Nenhum problema óbvio detectado. Se a mensagem chegou como Aceito mas não entregou, o destinatário pode ter bloqueado o número business ou está sem WhatsApp ativo.'
        : problems.join(' ');

    return new Response(
      JSON.stringify({
        success: true,
        instancia: { id: inst.id, nome: inst.nome, phone_number_id: inst.phone_number_id, waba_id: inst.waba_id },
        phone,
        subscriptions: subs,
        analytics,
        problems,
        recommendation,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err?.message || 'Erro' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

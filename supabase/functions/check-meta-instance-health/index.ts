// Verifica saúde das instâncias Meta WhatsApp via Graph API.
// Retorna status (CONNECTED/FLAGGED/RESTRICTED/etc), quality_rating, tier,
// e ban_info da WABA. Persiste snapshot em meta_whatsapp_instances.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GRAPH = 'https://graph.facebook.com/v21.0';

async function fetchJson(url: string, token: string) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const instanciaId: string | undefined = body?.instancia_id;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    let query = supabase.from('meta_whatsapp_instances').select('*').eq('ativo', true);
    if (instanciaId) query = query.eq('id', instanciaId);
    const { data: instancias, error } = await query;
    if (error) throw error;

    const results: any[] = [];
    for (const inst of instancias || []) {
      const r: any = {
        instancia_id: inst.id,
        nome: inst.nome,
        display_phone: inst.display_phone,
      };
      try {
        const fields = [
          'display_phone_number', 'verified_name', 'quality_rating',
          'name_status', 'code_verification_status', 'status',
          'throughput', 'messaging_limit_tier', 'platform_type', 'account_mode',
        ].join(',');
        const phoneResp = await fetchJson(
          `${GRAPH}/${inst.phone_number_id}?fields=${fields}`,
          inst.access_token,
        );
        if (!phoneResp.ok) {
          r.error = phoneResp.data?.error?.message || `HTTP ${phoneResp.status}`;
          r.raw = phoneResp.data;
        } else {
          r.status = phoneResp.data.status || null;
          r.quality_rating = phoneResp.data.quality_rating || null;
          r.messaging_limit_tier = phoneResp.data.messaging_limit_tier || null;
          r.name_status = phoneResp.data.name_status || null;
          r.throughput = phoneResp.data.throughput || null;
          r.account_mode = phoneResp.data.account_mode || null;
          r.platform_type = phoneResp.data.platform_type || null;
          r.raw = phoneResp.data;
        }

        if (inst.waba_id) {
          const wabaResp = await fetchJson(
            `${GRAPH}/${inst.waba_id}?fields=account_review_status,business_verification_status,ban_info,name,status`,
            inst.access_token,
          );
          if (wabaResp.ok) {
            r.waba = wabaResp.data;
            r.ban_info = wabaResp.data.ban_info || null;
          } else {
            r.waba_error = wabaResp.data?.error?.message || `HTTP ${wabaResp.status}`;
          }
        }

        await supabase.from('meta_whatsapp_instances').update({
          saude_status: r.status,
          saude_quality: r.quality_rating,
          saude_tier: r.messaging_limit_tier,
          saude_name_status: r.name_status,
          saude_throughput: r.throughput,
          saude_ban_info: r.ban_info,
          saude_raw: { phone: r.raw, waba: r.waba || null },
          saude_checked_at: new Date().toISOString(),
        }).eq('id', inst.id);
      } catch (e) {
        r.error = e instanceof Error ? e.message : String(e);
      }
      results.push(r);
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'erro' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

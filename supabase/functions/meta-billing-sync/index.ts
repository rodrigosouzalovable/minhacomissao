// Sincroniza custos reais cobrados pela Meta por WABA/dia/categoria.
// Usa conversation_analytics da Graph API. Requer META_SYSTEM_USER_TOKEN
// como fallback quando as instâncias não têm token válido para acessar a WABA.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Preço por conversation_category — Brasil, vigente 01/07/2026.
// Fonte: developers.facebook.com/docs/whatsapp/pricing (rate card BR).
// Utility/Authentication caíram para US$ 0,0068. Service dentro da CSW = grátis.
const PRECO_USD: Record<string, number> = {
  MARKETING: 0.0625,
  UTILITY: 0.0068,
  AUTHENTICATION: 0.0068,
  SERVICE: 0,
};

async function fetchFxRate(): Promise<number> {
  try {
    const r = await fetch('https://economia.awesomeapi.com.br/last/USD-BRL');
    if (!r.ok) return 5.5;
    const j = await r.json();
    return Number(j?.USDBRL?.bid || 5.5);
  } catch {
    return 5.5;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const body = await req.json().catch(() => ({}));
    const days = Math.min(Number(body?.days) || 35, 90);

    const { data: instancias } = await supabase
      .from('meta_whatsapp_instances')
      .select('id, waba_id, access_token, nome')
      .eq('ativo', true);

    const wabas = new Map<string, string>(); // waba_id -> token
    for (const i of instancias || []) {
      if (i.waba_id && i.access_token && !wabas.has(i.waba_id)) {
        wabas.set(i.waba_id, i.access_token);
      }
    }

    const systemToken = Deno.env.get('META_SYSTEM_USER_TOKEN');
    const fxRate = await fetchFxRate();

    const now = Math.floor(Date.now() / 1000);
    const start = now - days * 86400;

    let totalUpserted = 0;
    const errors: any[] = [];

    for (const [wabaId, token] of wabas.entries()) {
      const tokenToUse = systemToken || token;
      // pricing_analytics é o substituto do conversation_analytics (descontinuado).
      // Retorna volume real de mensagens cobradas por dia, categoria e tipo.
      const fields =
        `pricing_analytics.start(${start}).end(${now}).granularity(DAILY).dimensions(["PRICING_CATEGORY","PRICING_TYPE","COUNTRY"])`;
      const url = `https://graph.facebook.com/v24.0/${wabaId}?fields=${encodeURIComponent(fields)}`;

      try {
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${tokenToUse}` },
        });
        const data = await res.json();
        if (!res.ok) {
          errors.push({ waba_id: wabaId, error: data?.error?.message || 'erro' });
          continue;
        }

        const dataPoints = data?.pricing_analytics?.data?.[0]?.data_points || [];
        console.log(`[meta-billing-sync] waba=${wabaId} points=${dataPoints.length}`);
        for (const dp of dataPoints) {
          const dia = new Date((dp.start || 0) * 1000).toISOString().slice(0, 10);
          const cat = String(dp.pricing_category || 'UNKNOWN').toUpperCase();
          const tipo = String(dp.pricing_type || '').toUpperCase() || null;
          const volume = Number(dp.volume || 0);
          const gratis = tipo === 'FREE_CUSTOMER_SERVICE' || tipo === 'FREE_ENTRY_POINT' || cat === 'SERVICE';
          const costUsd = gratis ? 0 : volume * (PRECO_USD[cat] || 0);
          const costBrl = Number((costUsd * fxRate).toFixed(4));

          const { error } = await supabase.from('meta_billing_snapshot').upsert({
            waba_id: wabaId,
            dia,
            conversation_category: cat,
            conversation_type: tipo,
            conversations_count: volume,
            cost_usd: costUsd,
            cost_brl: costBrl,
            fx_rate: fxRate,
          }, { onConflict: 'waba_id,dia,conversation_category,conversation_type' });
          if (error) errors.push({ waba_id: wabaId, dia, error: error.message });
          else totalUpserted++;
        }
      } catch (e) {
        errors.push({ waba_id: wabaId, error: e instanceof Error ? e.message : String(e) });
      }
    }

    return new Response(
      JSON.stringify({ success: true, upserted: totalUpserted, wabas: wabas.size, fx_rate: fxRate, errors }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : 'erro' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});

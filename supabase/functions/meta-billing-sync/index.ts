// Sincroniza custos reais cobrados pela Meta por WABA/dia/categoria.
// Usa conversation_analytics da Graph API. Requer META_SYSTEM_USER_TOKEN
// como fallback quando as instâncias não têm token válido para acessar a WABA.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Tabela de preço estimada por conversation_category (fallback quando a Meta não retorna 'cost')
// Valores oficiais em USD para região Brasil (aproximados; a Meta ajusta periodicamente).
const PRECO_USD: Record<string, number> = {
  MARKETING: 0.0625,
  UTILITY: 0.008,
  AUTHENTICATION: 0.0315,
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
      const fields =
        `conversation_analytics.start(${start}).end(${now}).granularity(DAILY).phone_numbers([]).dimensions(["CONVERSATION_CATEGORY","CONVERSATION_TYPE"])`;
      const url = `https://graph.facebook.com/v21.0/${wabaId}?fields=${encodeURIComponent(fields)}`;

      try {
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${tokenToUse}` },
        });
        const data = await res.json();
        if (!res.ok) {
          errors.push({ waba_id: wabaId, error: data?.error?.message || 'erro' });
          continue;
        }

        const dataPoints = data?.conversation_analytics?.data?.[0]?.data_points || [];
        for (const dp of dataPoints) {
          const dia = new Date((dp.start || 0) * 1000).toISOString().slice(0, 10);
          const cat = String(dp.conversation_category || 'UNKNOWN').toUpperCase();
          const tipo = String(dp.conversation_type || '').toUpperCase() || null;
          const qtd = Number(dp.conversation || 0);
          // A Meta às vezes retorna 'cost' diretamente
          const costUsdReal = Number(dp.cost || 0);
          const costUsd = costUsdReal > 0 ? costUsdReal : qtd * (PRECO_USD[cat] || 0);
          const costBrl = Number((costUsd * fxRate).toFixed(2));

          const { error } = await supabase.from('meta_billing_snapshot').upsert({
            waba_id: wabaId,
            dia,
            conversation_category: cat,
            conversation_type: tipo,
            conversations_count: qtd,
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

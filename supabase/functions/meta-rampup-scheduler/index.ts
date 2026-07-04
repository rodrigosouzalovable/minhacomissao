// Recalcula fase_rampup de todas as instâncias com data_ativacao_api definida.
// Roda 1x/dia via cron (04:00 BRT = 07:00 UTC).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function faseFromDias(d: number): string {
  if (d <= 3) return 'fase1';
  if (d <= 7) return 'fase2';
  if (d <= 14) return 'fase3';
  if (d <= 21) return 'fase4';
  return 'livre';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: insts } = await supabase
      .from('meta_whatsapp_instances')
      .select('id, data_ativacao_api, fase_rampup, estado_pool')
      .not('data_ativacao_api', 'is', null);

    const updates: any[] = [];
    for (const inst of insts || []) {
      const dias = Math.floor((Date.now() - new Date(inst.data_ativacao_api).getTime()) / 86400000) + 1;
      const fase = faseFromDias(dias);
      if (fase !== inst.fase_rampup) {
        await supabase.from('meta_whatsapp_instances').update({ fase_rampup: fase }).eq('id', inst.id);
        updates.push({ id: inst.id, dias, fase });
      }
    }
    return new Response(JSON.stringify({ success: true, atualizadas: updates.length, updates }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : 'erro' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

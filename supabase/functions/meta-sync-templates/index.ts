import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sincronizarTemplatesMeta } from "../_shared/sincronizar-templates-meta.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const instanciaId = typeof body?.instancia_id === 'string' ? body.instancia_id.trim() : '';
    if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(instanciaId)) {
      return new Response(JSON.stringify({ success: false, error: 'instancia_id inválido' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: inst, error: ie } = await supabase
      .from('meta_whatsapp_instances')
      .select('id,waba_id,access_token').eq('id', instanciaId).maybeSingle();
    if (ie || !inst) throw new Error('Instância não encontrada');

    const result = await sincronizarTemplatesMeta(supabase, inst);

    return new Response(JSON.stringify({
      ...result,
      fallback: !result.success && [100, 190, 200].includes(result.code || 0),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err instanceof Error ? err.message : 'Erro' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

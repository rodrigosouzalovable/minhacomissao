import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function extractVariables(bodyText: string): Record<string, string> {
  const matches = Array.from(bodyText.matchAll(/\{\{(\d+)\}\}/g));
  const vars: Record<string, string> = {};
  matches.forEach(m => { vars[m[1]] = ''; });
  return vars;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const { instancia_id } = await req.json();
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: inst, error: ie } = await supabase
      .from('meta_whatsapp_instances')
      .select('*').eq('id', instancia_id).maybeSingle();
    if (ie || !inst) throw new Error('Instância não encontrada');

    const res = await fetch(`https://graph.facebook.com/v21.0/${inst.waba_id}/message_templates?limit=200`, {
      headers: { Authorization: `Bearer ${inst.access_token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || 'Falha ao buscar templates');

    const templates = data.data || [];
    let synced = 0;
    for (const t of templates) {
      const body = (t.components || []).find((c: any) => c.type === 'BODY');
      const bodyText = body?.text || '';
      const variaveis = extractVariables(bodyText);

      // Preserve existing mapping when re-syncing
      const { data: existing } = await supabase
        .from('meta_whatsapp_templates')
        .select('variaveis')
        .eq('instancia_id', instancia_id)
        .eq('nome_template', t.name)
        .eq('idioma', t.language)
        .maybeSingle();
      const mergedVars = existing?.variaveis
        ? { ...variaveis, ...(existing.variaveis as Record<string, string>) }
        : variaveis;

      await supabase.from('meta_whatsapp_templates').upsert({
        instancia_id,
        nome_template: t.name,
        categoria: t.category,
        idioma: t.language,
        status: t.status?.toLowerCase() || 'pending',
        body_text: bodyText,
        variaveis: mergedVars,
        sincronizado_em: new Date().toISOString(),
      }, { onConflict: 'instancia_id,nome_template,idioma' });
      synced++;
    }

    return new Response(JSON.stringify({ success: true, synced }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err instanceof Error ? err.message : 'Erro' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

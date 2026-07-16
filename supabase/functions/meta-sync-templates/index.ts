import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function extractVariables(bodyText: string): Record<string, string> {
  const matches = Array.from(bodyText.matchAll(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*|\d+)\s*\}\}/g));
  const vars: Record<string, string> = {};
  matches.forEach(m => { vars[m[1]] = ''; });
  return vars;
}

function extractTemplateMetadata(components: any[]): Record<string, any> {
  const meta: Record<string, any> = { _components: components || [] };
  const header = (components || []).find((c: any) => c?.type === 'HEADER');
  if (header?.format) meta._header_format = String(header.format).toUpperCase();
  return meta;
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

    if (!inst.waba_id) {
      return new Response(JSON.stringify({ success: false, error: 'WABA ID não configurado nesta instância', fallback: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const res = await fetch(`https://graph.facebook.com/v21.0/${inst.waba_id}/message_templates?limit=200`, {
      headers: { Authorization: `Bearer ${inst.access_token}` },
    });
    const data = await res.json();
    if (!res.ok) {
      const msg = data?.error?.message || `HTTP ${res.status}`;
      const code = data?.error?.code;
      // Erros de permissão/objeto inexistente (100, 190, 200) — retorna 200 com fallback
      // para não quebrar a UI. Usuário precisa revisar WABA ID / access token.
      const isFallbackable = code === 100 || code === 190 || code === 200 || res.status === 400 || res.status === 401 || res.status === 403;
      return new Response(JSON.stringify({
        success: false,
        error: msg,
        fallback: isFallbackable,
        hint: isFallbackable ? 'Verifique se o WABA ID e o Access Token da instância estão corretos e com permissões whatsapp_business_management.' : undefined,
      }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const templates = data.data || [];
    let synced = 0;
    for (const t of templates) {
      const body = (t.components || []).find((c: any) => c.type === 'BODY');
      const bodyText = body?.text || '';
      const variaveis = extractVariables(bodyText);
      const metadata = extractTemplateMetadata(t.components || []);

      // Preserve existing mapping when re-syncing
      const { data: existing } = await supabase
        .from('meta_whatsapp_templates')
        .select('variaveis')
        .eq('instancia_id', instancia_id)
        .eq('nome_template', t.name)
        .eq('idioma', t.language)
        .maybeSingle();
      const existingVars = (existing?.variaveis || {}) as Record<string, any>;
      const mergedVars = { ...variaveis, ...existingVars, ...metadata };

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

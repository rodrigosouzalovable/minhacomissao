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

    // ===== Escada de retorno pós-quarentena =====
    // Números que saíram da quarentena sobem de degrau após N dias seguidos em
    // GREEN; quem não está GREEN volta ao primeiro degrau.
    const { data: cfg } = await supabase
      .from('meta_envio_pool_config')
      .select('escada_retorno, recuperacao_dias_green_alta')
      .eq('id', 1).maybeSingle();
    const escada: number[] = Array.isArray(cfg?.escada_retorno) ? cfg!.escada_retorno : [20, 40, 80];
    const diasGreenAlta = Math.max(1, Number(cfg?.recuperacao_dias_green_alta ?? 3));

    const { data: comEscada } = await supabase
      .from('meta_whatsapp_instances')
      .select('id, nome, saude_quality, teto_escada, quarentena_ate, recuperacao_ativa, dias_green_consecutivos')
      .not('teto_escada', 'is', null);

    const escadaUpdates: any[] = [];
    for (const inst of (comEscada || []) as any[]) {
      const emQuarentena = inst.quarentena_ate && new Date(inst.quarentena_ate) > new Date();
      if (emQuarentena || inst.recuperacao_ativa === true) continue;
      const qual = String(inst.saude_quality || '').toUpperCase();
      const atual = Number(inst.teto_escada);
      let novo: number | null = atual;
      if (qual === 'GREEN') {
        if (Number(inst.dias_green_consecutivos || 0) < diasGreenAlta) continue;
        const idx = escada.findIndex((v) => Number(v) >= atual);
        const proximo = idx >= 0 && idx + 1 < escada.length ? Number(escada[idx + 1]) : null;
        // Último degrau concluído com GREEN → libera o teto normal da fase.
        novo = proximo ?? null;
      } else {
        novo = Number(escada[0] ?? 20);
      }
      if (novo !== atual) {
        await supabase.from('meta_whatsapp_instances').update({ teto_escada: novo }).eq('id', inst.id);
        escadaUpdates.push({ id: inst.id, nome: inst.nome, de: atual, para: novo });
      }
    }


    return new Response(JSON.stringify({ success: true, atualizadas: updates.length, updates, escada: escadaUpdates }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : 'erro' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

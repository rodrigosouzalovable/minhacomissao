// Aquecimento Meta oficial: envia template utility entre instâncias próprias
// pra gerar inbound orgânico e melhorar ratio inbound/outbound (evita ban).
// Roda 1x a cada 10min via pg_cron, dentro da janela 09-19h BRT, exceto domingo.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GRAPH = 'https://graph.facebook.com/v21.0';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const { data: cfg } = await supabase.from('meta_envio_pool_config').select('*').eq('id', 1).maybeSingle();
    if (!cfg?.aquecimento_ativo) {
      return new Response(JSON.stringify({ skipped: 'aquecimento_desativado' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const nowBrt = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const dia = nowBrt.getDay();
    const hora = nowBrt.getHours();
    if (dia === 0) {
      return new Response(JSON.stringify({ skipped: 'domingo' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const hIniCfg = Number(String(cfg.horario_inicio || '08:00').split(':')[0]);
    const hFimCfg = Number(String(cfg.horario_fim || '19:00').split(':')[0]);
    const hIni = Number.isFinite(hIniCfg) ? hIniCfg : 8;
    const hFim = Number.isFinite(hFimCfg) ? hFimCfg : 19;
    if (hora < hIni || hora >= hFim) {
      return new Response(JSON.stringify({ skipped: 'fora_janela' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }


    const template = cfg.aquecimento_template_utility;
    if (!template) {
      return new Response(JSON.stringify({ skipped: 'sem_template' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Carrega instâncias ativas, saudáveis e com >=3 dias de idade
    const { data: insts } = await supabase
      .from('meta_whatsapp_instances')
      .select('id, nome, phone_number_id, access_token, display_phone, data_ativacao_api, saude_quality, estado_pool, pausa_automatica_ate, ativo')
      .eq('ativo', true);

    const elegiveis = (insts || []).filter((i: any) => {
      if (i.estado_pool && i.estado_pool !== 'ativo') return false;
      if (i.pausa_automatica_ate && new Date(i.pausa_automatica_ate) > new Date()) return false;
      const q = String(i.saude_quality || 'UNKNOWN').toUpperCase();
      if (q === 'RED') return false;
      if (!i.data_ativacao_api) return true;
      const dias = Math.floor((Date.now() - new Date(i.data_ativacao_api).getTime()) / 86400000);
      return dias >= 0;
    });

    if (elegiveis.length < 2) {
      return new Response(JSON.stringify({ skipped: 'menos_2_instancias' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const hoje = new Date().toISOString().slice(0, 10);
    const maxDia = Math.max(1, cfg.aquecimento_max_pares_dia || 20);

    // Reset diário dos contadores por par
    await supabase.from('meta_aquecimento_pares')
      .update({ trocas_hoje: 0, ultimo_reset: hoje })
      .neq('ultimo_reset', hoje);

    // Escolhe emissor com menos trocas hoje (round-robin natural)
    const { data: paresAtuais } = await supabase.from('meta_aquecimento_pares').select('*');
    const paresMap = new Map<string, any>();
    (paresAtuais || []).forEach((p: any) => paresMap.set(`${p.emissor_id}:${p.receptor_id}`, p));

    // Score por emissor = total de trocas_hoje somadas (queremos o menor)
    const trocasPorEmissor: Record<string, number> = {};
    elegiveis.forEach((i: any) => trocasPorEmissor[i.id] = 0);
    (paresAtuais || []).forEach((p: any) => {
      trocasPorEmissor[p.emissor_id] = (trocasPorEmissor[p.emissor_id] || 0) + (p.trocas_hoje || 0);
    });

    const emissoresOrdenados = [...elegiveis].sort((a: any, b: any) =>
      (trocasPorEmissor[a.id] || 0) - (trocasPorEmissor[b.id] || 0)
    );

    let processado: any = null;
    for (const emissor of emissoresOrdenados) {
      // Receptores elegíveis: outros números, com par ainda dentro do limite
      const receptores = elegiveis.filter((r: any) => r.id !== emissor.id);
      const receptoresOrd = receptores.sort((a: any, b: any) => {
        const pa = paresMap.get(`${emissor.id}:${a.id}`);
        const pb = paresMap.get(`${emissor.id}:${b.id}`);
        return (pa?.trocas_hoje || 0) - (pb?.trocas_hoje || 0);
      });

      for (const receptor of receptoresOrd) {
        const par = paresMap.get(`${emissor.id}:${receptor.id}`);
        if (par && (par.trocas_hoje || 0) >= maxDia) continue;

        // Envia template utility do emissor pro número do receptor
        const numeroDestino = String(receptor.display_phone || '').replace(/\D/g, '');
        if (!numeroDestino) continue;

        const body = {
          messaging_product: 'whatsapp',
          to: numeroDestino,
          type: 'template',
          template: { name: template, language: { code: 'pt_BR' } },
        };

        const res = await fetch(`${GRAPH}/${emissor.phone_number_id}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${emissor.access_token}`,
          },
          body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));

        // UPSERT do par
        if (par) {
          await supabase.from('meta_aquecimento_pares').update({
            trocas_hoje: (par.trocas_hoje || 0) + 1,
            trocas_total: (par.trocas_total || 0) + 1,
            ultima_troca_em: new Date().toISOString(),
            ultimo_reset: hoje,
          }).eq('id', par.id);
        } else {
          await supabase.from('meta_aquecimento_pares').insert({
            emissor_id: emissor.id,
            receptor_id: receptor.id,
            trocas_hoje: 1,
            trocas_total: 1,
            ultima_troca_em: new Date().toISOString(),
            ultimo_reset: hoje,
          });
        }

        processado = {
          emissor: emissor.nome || emissor.display_phone,
          receptor: receptor.nome || receptor.display_phone,
          ok: res.ok,
          error: res.ok ? null : (data?.error?.message || `HTTP ${res.status}`),
        };
        break;
      }
      if (processado) break;
    }

    return new Response(JSON.stringify({ ok: true, processado }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'erro' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

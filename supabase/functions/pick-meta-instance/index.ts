// Escolhe a melhor instância Meta para o próximo envio baseado em score de saúde.
// Regras: só considera estado_pool='ativo', não pausada, dentro do horário e cota.
// Fórmula: quality × tier × idade × (1 - uso_hoje/cota_efetiva)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function pesoQualidade(q: string | null): number {
  const v = String(q || '').toUpperCase();
  if (v === 'GREEN') return 100;
  if (v === 'UNKNOWN' || v === '') return 60;
  return 0; // YELLOW/RED bloqueado
}
function pesoTier(t: string | null): number {
  const v = String(t || '').toUpperCase();
  if (v.includes('UNLIMITED')) return 1000;
  if (v.includes('100K')) return 400;
  if (v.includes('10K')) return 40;
  if (v.includes('1K')) return 4;
  return 1; // TIER_250 e default
}
function fatorIdade(dias: number): number {
  if (dias < 7) return 0.3;
  if (dias < 30) return 0.7;
  return 1.0;
}
function cotaFase(fase: string, cfg: any): number {
  switch (fase) {
    case 'fase1': return cfg?.cota_fase1 || 20;
    case 'fase2': return cfg?.cota_fase2 || 50;
    case 'fase3': return cfg?.cota_fase3 || 150;
    case 'fase4': return cfg?.cota_fase4 || 400;
    case 'livre': return 999999;
    default: return 0; // aguardando
  }
}
function faseFromDias(d: number): string {
  if (d < 1) return 'fase1';
  if (d <= 3) return 'fase1';
  if (d <= 7) return 'fase2';
  if (d <= 14) return 'fase3';
  if (d <= 21) return 'fase4';
  return 'livre';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const { instancia_ids, user_id } = await req.json();
    if (!Array.isArray(instancia_ids) || instancia_ids.length === 0) {
      return new Response(JSON.stringify({ success: false, error: 'instancia_ids obrigatório' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: cfg } = await supabase.from('meta_envio_pool_config').select('*').eq('id', 1).maybeSingle();

    // Bloqueio de domingo/horário BRT
    const nowBrt = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const diaSemana = nowBrt.getDay(); // 0=domingo
    if (cfg?.bloquear_domingo && diaSemana === 0) {
      return new Response(JSON.stringify({ success: false, blocked: 'domingo', error: 'Envios bloqueados aos domingos' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const hh = nowBrt.getHours() + nowBrt.getMinutes() / 60;
    const [hIni] = String(cfg?.horario_inicio || '08:00:00').split(':').map(Number);
    const [hFim] = String(cfg?.horario_fim || '20:00:00').split(':').map(Number);
    if (hh < hIni || hh >= hFim) {
      return new Response(JSON.stringify({ success: false, blocked: 'horario', error: `Fora do horário (${hIni}h–${hFim}h BRT)` }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Carrega instâncias candidatas
    const { data: insts } = await supabase
      .from('meta_whatsapp_instances').select('*')
      .in('id', instancia_ids).eq('ativo', true);

    if (!insts?.length) {
      return new Response(JSON.stringify({ success: false, error: 'nenhuma instância ativa' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const hoje = new Date().toISOString().slice(0, 10);
    const nowIso = new Date().toISOString();

    // Contagem hoje (fallback: enviados_hoje da própria row)
    const candidates: any[] = [];
    for (const inst of insts) {
      if (inst.estado_pool && inst.estado_pool !== 'ativo') continue;
      if (inst.pausa_automatica_ate && new Date(inst.pausa_automatica_ate) > new Date()) continue;

      // Reset diário
      let uso = inst.enviados_hoje || 0;
      if (inst.ultimo_reset !== hoje) uso = 0;

      // Fase
      const diasAtivo = inst.data_ativacao_api
        ? Math.floor((Date.now() - new Date(inst.data_ativacao_api).getTime()) / 86400000) + 1
        : 0;
      const fase = inst.data_ativacao_api ? faseFromDias(diasAtivo) : 'aguardando';
      if (fase === 'aguardando') continue;
      const cota = Math.min(cotaFase(fase, cfg), inst.tier_diario || 999999);
      if (uso >= cota) continue;

      const q = pesoQualidade(inst.saude_quality);
      if (q === 0) continue;
      const score = q * pesoTier(inst.saude_tier) * fatorIdade(diasAtivo) * (1 - uso / Math.max(1, cota));
      candidates.push({ inst, score, fase, cota, uso, diasAtivo });
    }

    if (!candidates.length) {
      return new Response(JSON.stringify({ success: false, blocked: 'sem_disponivel', error: 'Nenhuma instância disponível (cota, pausa ou qualidade)' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    candidates.sort((a, b) => b.score - a.score);
    const winner = candidates[0];

    // Cacheia score
    await supabase.from('meta_whatsapp_instances').update({
      score_saude_cache: winner.score,
      fase_rampup: winner.fase,
    }).eq('id', winner.inst.id);

    return new Response(JSON.stringify({
      success: true,
      instancia_id: winner.inst.id,
      nome: winner.inst.nome,
      score: winner.score,
      fase: winner.fase,
      cota_efetiva: winner.cota,
      enviados_hoje: winner.uso,
      dias_ativo: winner.diasAtivo,
      total_candidatos: candidates.length,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : 'erro' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

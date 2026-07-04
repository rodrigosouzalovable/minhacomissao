// Processa a fila diária das campanhas Meta agendadas.
// Chamado por pg_cron todo dia às 08:00 BRT (11:00 UTC), seg-sáb.
// Regras: bloqueia domingo, respeita horário 08-20h BRT, delays randomizados.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function todayBRT(): string {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
function nowBRT(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
}
function randInt(lo: number, hi: number) {
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}
async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function invokeSend(supabase: any, item: any, campanha: any) {
  const templateIdByInst = (campanha.template_id_by_instance || {}) as Record<string, string>;
  const templateId = templateIdByInst[item.instancia_id] || campanha.template_id;
  const { data, error } = await supabase.functions.invoke('send-whatsapp-meta', {
    body: {
      template_id: templateId,
      instancia_id: item.instancia_id,
      cliente: item.cliente,
    },
  });
  if (error) throw error;
  return data;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Bloqueio de domingo
    const now = nowBRT();
    const diaSemana = now.getDay();
    if (diaSemana === 0) {
      return new Response(JSON.stringify({ success: false, blocked: 'domingo' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Janela padrão 08-20h BRT
    const hh = now.getHours() + now.getMinutes() / 60;
    if (hh < 8 || hh >= 20) {
      return new Response(JSON.stringify({ success: false, blocked: 'horario', hora: hh }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const hoje = todayBRT();

    // Puxa itens pendentes com data_prevista <= hoje, campanhas ativas
    const { data: campanhas, error: cErr } = await supabase
      .from('meta_campanha_agendada')
      .select('*')
      .in('status', ['agendada', 'em_execucao']);
    if (cErr) throw cErr;

    let enviadosTotais = 0;
    let errosTotais = 0;
    const detalhePorCampanha: any[] = [];

    for (const campanha of campanhas || []) {
      const { data: itens } = await supabase
        .from('meta_campanha_item')
        .select('*')
        .eq('campanha_id', campanha.id)
        .eq('status', 'pendente')
        .lte('data_prevista', hoje)
        .order('data_prevista', { ascending: true });

      if (!itens || itens.length === 0) continue;

      // Marca campanha em execução
      if (campanha.status !== 'em_execucao') {
        await supabase.from('meta_campanha_agendada').update({ status: 'em_execucao' }).eq('id', campanha.id);
      }

      let enviadosC = 0;
      let errosC = 0;
      const lo = Math.max(1, campanha.min_seg || 40);
      const hi = Math.max(lo, campanha.max_seg || 90);

      for (let i = 0; i < itens.length; i++) {
        // Re-checa janela BRT a cada envio
        const nowLoop = nowBRT();
        const hhLoop = nowLoop.getHours() + nowLoop.getMinutes() / 60;
        if (hhLoop >= 20) break;

        const item = itens[i];

        // Escolha inteligente de instância (respeita cota, YELLOW, pausa)
        let chosenInstId = item.instancia_id;
        try {
          const { data: pick } = await supabase.functions.invoke('pick-meta-instance', {
            body: { instancia_ids: campanha.instancia_ids },
          });
          if (pick?.success && pick.instancia_id) {
            chosenInstId = pick.instancia_id;
          } else if (pick?.blocked === 'domingo' || pick?.blocked === 'horario') {
            break;
          }
        } catch (_) {
          // fallback: usa a instância pré-atribuída
        }

        // Se instância mudou (cota estourou / YELLOW), atualiza no item
        const finalItem = { ...item, instancia_id: chosenInstId };

        try {
          const data = await invokeSend(supabase, finalItem, campanha);
          if (data?.blocked === 'domingo' || data?.blocked === 'horario') break;
          if (data?.tier_full || data?.pool_blocked || data?.pool_paused) {
            // Não decrementa; deixa pendente para replanejamento
            continue;
          }
          if (!data?.success) throw new Error(data?.error || 'falha');

          await supabase.from('meta_campanha_item').update({
            status: 'enviado',
            enviado_em: new Date().toISOString(),
            instancia_id: chosenInstId,
          }).eq('id', item.id);
          enviadosC++;
        } catch (e: any) {
          await supabase.from('meta_campanha_item').update({
            status: 'erro',
            erro: e?.message || String(e),
            instancia_id: chosenInstId,
          }).eq('id', item.id);
          errosC++;
        }

        // Delay aleatório antes do próximo
        if (i < itens.length - 1) {
          await sleep(randInt(lo, hi) * 1000);
        }
      }

      // Atualiza contadores
      const { data: contagem } = await supabase
        .from('meta_campanha_item')
        .select('status', { count: 'exact', head: false })
        .eq('campanha_id', campanha.id);
      const enviados = (contagem || []).filter((r: any) => r.status === 'enviado').length;
      const erros = (contagem || []).filter((r: any) => r.status === 'erro').length;
      const pendentes = (contagem || []).filter((r: any) => r.status === 'pendente').length;
      const novoStatus = pendentes === 0 ? 'concluida' : 'em_execucao';
      await supabase.from('meta_campanha_agendada').update({
        enviados, erros, status: novoStatus,
      }).eq('id', campanha.id);

      enviadosTotais += enviadosC;
      errosTotais += errosC;
      detalhePorCampanha.push({ id: campanha.id, nome: campanha.nome, enviados: enviadosC, erros: errosC });
    }

    return new Response(JSON.stringify({
      success: true,
      hoje,
      enviados: enviadosTotais,
      erros: errosTotais,
      campanhas: detalhePorCampanha,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : 'erro' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

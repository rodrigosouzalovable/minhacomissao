// Aquecimento preventivo dos números Meta saudáveis (cron a cada 10 min).
// Cada número GREEN em campanha recebe um mínimo diário de conversas com os
// números UAZAPI da pasta AQUECIMENTO (atendidos pelo IAGO), gerando entrada
// real para não chegar em YELLOW.
// A recuperação de números YELLOW/RED é feita por meta-recuperacao-tick.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  dentroJanelaAquecimento,
  destinosAquecimento,
  enviarTemplateAquecimento,
  erroFatalMeta,
  escolherTemplateAprovado,
  hojeBrt,
  sorteio,
} from '../_shared/meta-aquecimento-alvo.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_POR_RUN = 5;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const body = await req.json().catch(() => ({}));
    const forcar = body?.forcar === true;

    const { data: cfg } = await supabase
      .from('meta_envio_pool_config').select('*').eq('id', 1).maybeSingle();
    if (!cfg?.aquecimento_ativo && !forcar) {
      return json({ ok: true, skipped: 'aquecimento_desativado' });
    }

    const hIni = Number(String(cfg?.horario_inicio || '09:00').split(':')[0]) || 9;
    const hFim = Number(String(cfg?.horario_fim || '19:00').split(':')[0]) || 19;
    const janela = dentroJanelaAquecimento(Math.max(9, hIni), Math.min(19, hFim));
    if (!janela.ok && !forcar) return json({ ok: true, skipped: janela.motivo });

    const metaDia = Math.max(1, Number(cfg?.preventivo_msgs_dia ?? 3));
    const intMin = Math.max(60, Number(cfg?.recuperacao_intervalo_min_seg ?? 1200));
    const intMax = Math.max(intMin, Number(cfg?.recuperacao_intervalo_max_seg ?? 2400));
    const maxPorDestino = Math.max(1, Number(cfg?.recuperacao_max_por_destino_dia ?? 2));

    const { data: insts } = await supabase
      .from('meta_whatsapp_instances')
      .select('id, nome, display_phone, phone_number_id, access_token, waba_id, saude_quality, estado_pool, pausa_automatica_ate, quarentena_ate, recuperacao_ativa, recuperacao_proximo_envio_em, ativo, provider')
      .eq('ativo', true)
      .eq('provider', 'meta');

    const elegiveis = (insts || []).filter((i: any) => {
      if (i.recuperacao_ativa === true) return false; // cuidado por meta-recuperacao-tick
      if (i.estado_pool && i.estado_pool !== 'ativo') return false;
      if (i.pausa_automatica_ate && new Date(i.pausa_automatica_ate) > new Date()) return false;
      if (i.quarentena_ate && new Date(i.quarentena_ate) > new Date()) return false;
      const q = String(i.saude_quality || 'UNKNOWN').toUpperCase();
      if (q === 'RED' || q === 'YELLOW') return false;
      if (!i.phone_number_id || !i.access_token) return false;
      return true;
    });

    if (elegiveis.length === 0) return json({ ok: true, skipped: 'nenhuma_elegivel' });

    const destinos = await destinosAquecimento(supabase);
    if (destinos.length === 0) return json({ ok: false, error: 'nenhum número UAZAPI na pasta AQUECIMENTO' });

    const dia = hojeBrt();
    const { data: logsHoje } = await supabase
      .from('meta_recuperacao_log')
      .select('instancia_id, destino_instancia_id, enviado_em, status')
      .eq('dia', dia)
      .limit(5000);
    const usoDestino = new Map<string, number>();
    (logsHoje || []).forEach((l: any) => {
      if (l.status !== 'enviado' || !l.destino_instancia_id) return;
      usoDestino.set(l.destino_instancia_id, (usoDestino.get(l.destino_instancia_id) || 0) + 1);
    });

    const resultados: any[] = [];
    let processadas = 0;

    for (const inst of elegiveis as any[]) {
      if (processadas >= MAX_POR_RUN) break;
      if (!forcar && inst.recuperacao_proximo_envio_em &&
          new Date(inst.recuperacao_proximo_envio_em) > new Date()) continue;

      const meus = (logsHoje || []).filter(
        (l: any) => l.instancia_id === inst.id && l.status === 'enviado',
      );
      if (meus.length >= metaDia) continue;

      const ultimo = meus
        .sort((a: any, b: any) => new Date(b.enviado_em).getTime() - new Date(a.enviado_em).getTime())[0];
      const destinosOk = destinos.filter((d) =>
        (usoDestino.get(d.id) || 0) < maxPorDestino && d.id !== ultimo?.destino_instancia_id
      );
      if (destinosOk.length === 0) continue;
      const destino = destinosOk[Math.floor(Math.random() * destinosOk.length)];

      const tpl = await escolherTemplateAprovado(inst, cfg?.aquecimento_template_utility);
      if (!tpl) {
        resultados.push({ instancia: inst.nome, erro: 'sem_template_aprovado' });
        continue;
      }

      const envio = await enviarTemplateAquecimento(inst, destino.telefone, tpl, destino.nome);

      await supabase.from('meta_recuperacao_log').insert({
        instancia_id: inst.id,
        destino_instancia_id: destino.id,
        destino_telefone: destino.telefone,
        tipo: `preventivo:${tpl.name}`,
        status: envio.ok ? 'enviado' : 'falha',
        erro: envio.ok ? null : envio.erro,
        wamid: envio.wamid || null,
        dia,
      });

      await supabase.from('meta_whatsapp_instances').update({
        recuperacao_ultimo_envio_em: new Date().toISOString(),
        recuperacao_proximo_envio_em: new Date(Date.now() + sorteio(intMin, intMax) * 1000).toISOString(),
      }).eq('id', inst.id);

      if (envio.ok) usoDestino.set(destino.id, (usoDestino.get(destino.id) || 0) + 1);
      if (!envio.ok && erroFatalMeta(envio.codigo, envio.erro)) {
        console.log('[aquecimento] erro fatal, parando ciclo:', envio.erro);
        resultados.push({ instancia: inst.nome, ok: false, erro: envio.erro, parado: true });
        break;
      }

      processadas++;
      resultados.push({
        instancia: inst.nome || inst.display_phone,
        destino: destino.nome || destino.telefone,
        template: tpl.name,
        ok: envio.ok,
        erro: envio.erro || null,
      });
    }

    return json({ ok: true, total: resultados.length, resultados });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : 'erro' }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Resumo do aquecimento de qualidade dos números Meta em YELLOW/RED.
// Cron 13h e 18h BRT: manda um único WhatsApp com o que já foi feito no dia,
// quantas mensagens saíram, quantas voltaram e a previsão de volta ao GREEN.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { destinosAquecimento, hojeBrt } from '../_shared/meta-aquecimento-alvo.ts';
import { linhaPrevisao, previsaoGreen } from '../_shared/meta-recuperacao-aviso.ts';
import { notificarAdmin } from '../_shared/notificar-admin.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const suf8 = (t: string) => String(t || '').replace(/\D/g, '').slice(-8);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const dia = hojeBrt();
    const { data: cfg } = await supabase
      .from('meta_envio_pool_config').select('*').eq('id', 1).maybeSingle();
    const diasGreenAlta = Math.max(1, Number(cfg?.recuperacao_dias_green_alta ?? 3));

    const { data: insts } = await supabase
      .from('meta_whatsapp_instances')
      .select('id, nome, display_phone, saude_quality, recuperacao_ativa, recuperacao_desde, recuperacao_msgs_meta_dia, dias_green_consecutivos, quarentena_ate')
      .eq('ativo', true)
      .eq('provider', 'meta')
      .eq('aquecimento_qualidade_permitido', true)
      .eq('recuperacao_ativa', true);

    const DESTINOS_RELATORIO = ['5562991672674', '5562994300880'];

    const horaAgora = new Date().toLocaleTimeString('pt-BR', {
      timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit',
    });

    if (!insts?.length) {
      // Nunca ficar em silêncio: se ninguém está em reaquecimento, avisar —
      // e listar os números fora do verde que deveriam estar sendo tratados.
      const { data: fora } = await supabase
        .from('meta_whatsapp_instances')
        .select('nome, display_phone, saude_quality')
        .eq('ativo', true)
        .eq('provider', 'meta')
        .in('saude_quality', ['YELLOW', 'RED']);

      const lista = (fora || []).map((i: any) =>
        `• *${i.nome || i.display_phone}* · ${String(i.saude_quality).toUpperCase()}`
      );

      const msg = lista.length
        ? `⚠️ *Aquecimento de qualidade — ${horaAgora}*\n\n` +
          `Nenhum número está em reaquecimento agora, mas ${lista.length} número(s) estão fora do verde:\n` +
          `${lista.join('\n')}\n\n` +
          `A varredura automática religa o reaquecimento na próxima checagem de saúde (de hora em hora).`
        : `✅ *Aquecimento de qualidade — ${horaAgora}*\n\n` +
          `Nenhum número em reaquecimento e nenhum número em YELLOW/RED. Todos os seus números da API oficial estão saudáveis.`;

      await notificarAdmin(supabase, {
        tipo: 'meta_aquecimento_resumo',
        mensagem: msg,
        chaveIdempotencia: `meta_aquec_resumo_${dia}_${horaAgora.replace(':', '')}`,
        umaVezPorChave: true,
        destinatarios: DESTINOS_RELATORIO,
      });
      return json({ ok: true, sem_recuperacao: true, fora: lista.length });
    }


    const { data: logs } = await supabase
      .from('meta_recuperacao_log')
      .select('instancia_id, status, erro')
      .eq('dia', dia)
      .limit(5000);

    const destinos = await destinosAquecimento(supabase);
    const sufDestinos = new Set(destinos.map((d) => suf8(d.telefone)));

    const inicioDia = new Date(`${dia}T00:00:00-03:00`).toISOString();
    const { data: msgs } = await supabase
      .from('meta_whatsapp_mensagens')
      .select('instancia_id, telefone, direcao')
      .in('instancia_id', insts.map((i: any) => i.id))
      .eq('direcao', 'entrada')
      .gte('criado_em', inicioDia)
      .limit(20000);

    const respostas = new Map<string, number>();
    (msgs || []).forEach((m: any) => {
      if (!sufDestinos.has(suf8(m.telefone))) return;
      respostas.set(m.instancia_id, (respostas.get(m.instancia_id) || 0) + 1);
    });

    let totalEnv = 0;
    let totalResp = 0;
    const linhas: string[] = [];

    for (const i of insts as any[]) {
      const meus = (logs || []).filter((l: any) => l.instancia_id === i.id);
      const enviados = meus.filter((l: any) => l.status === 'enviado').length;
      const falhas = meus.filter((l: any) => l.status === 'falha').length;
      const resp = respostas.get(i.id) || 0;
      const meta = Number(i.recuperacao_msgs_meta_dia || 0);
      const p = previsaoGreen(i.saude_quality, i.dias_green_consecutivos, diasGreenAlta);
      totalEnv += enviados;
      totalResp += resp;
      const diasEmRecup = i.recuperacao_desde
        ? Math.max(1, Math.ceil((Date.now() - new Date(i.recuperacao_desde).getTime()) / 86400000))
        : 1;
      linhas.push(
        `• *${i.nome || i.display_phone}* · ${String(i.saude_quality || 'UNKNOWN').toUpperCase()}\n` +
        `   ${enviados}/${meta || '?'} enviadas · ${resp} respostas · ${falhas} falha(s)\n` +
        `   dia ${diasEmRecup} de recuperação · ${p.diasGreen}/${diasGreenAlta} dias GREEN · previsão GREEN ${p.greenEm}, volta ao pool ${p.altaEm}`,
      );
    }

    const hora = horaAgora;

    const mensagem =
      `📈 *Aquecimento de qualidade — ${hora}*\n\n` +
      `${linhas.join('\n')}\n\n` +
      `Total do dia: ${totalEnv} enviadas · ${totalResp} respostas recebidas\n` +
      `As mensagens vão para os números UAZAPI da caixa AQUECIMENTO (09h–19h, 20–40 min entre envios) e o IAGO responde todas, gerando entrada real.\n` +
      `Enquanto estiverem em recuperação, esses números ficam fora das campanhas.`;

    await notificarAdmin(supabase, {
      tipo: 'meta_aquecimento_resumo',
      mensagem,
      chaveIdempotencia: `meta_aquec_resumo_${dia}_${hora.replace(':', '')}`,
      umaVezPorChave: true,
      destinatarios: ['5562991672674', '5562994300880'],
    });


    return json({ ok: true, instancias: insts.length, totalEnv, totalResp });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : 'erro' }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Processa um lote de consultas UME em blocos e se auto-reencadeia até terminar.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { consultarUme } from '../_shared/ume-desconto.ts';
import { notificarAdmin } from '../_shared/notificar-admin.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const service = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

// Ritmo controlado: 6 consultas em paralelo, pausa curta entre blocos.
const PARALELO = 6;
const PAUSA_MS = 400;
const MAX_TENTATIVAS = 3;
// Orçamento da execução; ao estourar, reencadeia outra chamada.
const ORCAMENTO_MS = 100_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function reencadear(loteId: string) {
  const url = `${Deno.env.get('SUPABASE_URL')}/functions/v1/ume-lote-tick`;
  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
    },
    body: JSON.stringify({ loteId }),
  }).catch((e) => console.error('[ume-lote-tick] falha ao reencadear', e));
}

async function atualizarContadores(loteId: string) {
  const contar = async (filtro: (q: any) => any) => {
    let q = service.from('ume_lote_itens').select('id', { count: 'exact', head: true }).eq('lote_id', loteId);
    q = filtro(q);
    const { count } = await q;
    return count ?? 0;
  };
  const encontrados = await contar((q: any) => q.eq('status', 'encontrado'));
  const naoLocalizados = await contar((q: any) => q.eq('status', 'nao_localizado'));
  const erros = await contar((q: any) => q.eq('status', 'erro'));
  const pendentes = await contar((q: any) => q.eq('status', 'pendente'));

  await service
    .from('ume_lotes')
    .update({
      encontrados,
      nao_localizados: naoLocalizados,
      erros,
      processados: encontrados + naoLocalizados + erros,
      ...(pendentes === 0 ? { status: 'concluido' } : {}),
    })
    .eq('id', loteId);

  return pendentes;
}

async function processarItem(item: any, forcar: boolean) {
  try {
    const c = await consultarUme(service, item.cpf, { forcar });
    await service
      .from('ume_lote_itens')
      .update({
        status: c.encontrado ? 'encontrado' : 'nao_localizado',
        valor_sem_juros: c.valorSemJuros,
        valor_com_juros: c.valorComJuros,
        nome: c.nome || null,
        telefone: c.telefone || null,
        dias_atraso: c.diasAtraso,
        fase: c.fase || null,
        limite_total: c.limiteTotal,
        tentativas: (item.tentativas || 0) + 1,
        erro: null,
      })
      .eq('id', item.id);
    return { ok: true as const };
  } catch (e) {
    const msg = String((e as Error)?.message || e);
    const tentativas = (item.tentativas || 0) + 1;
    const layoutMudou = msg.includes('layout_ume_mudou');
    const desiste = layoutMudou || msg.includes('cpf_invalido') || tentativas >= MAX_TENTATIVAS;
    await service
      .from('ume_lote_itens')
      .update({ tentativas, erro: msg.slice(0, 300), status: desiste ? 'erro' : 'pendente' })
      .eq('id', item.id);
    return { ok: false as const, layoutMudou, msg };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const inicio = Date.now();
  try {
    const body = await req.json().catch(() => ({}));
    const loteId = String((body as any)?.loteId || '');
    if (!loteId) return json({ error: 'loteId obrigatório' }, 400);

    const { data: lote } = await service
      .from('ume_lotes')
      .select('id, status, forcar')
      .eq('id', loteId)
      .maybeSingle();
    if (!lote) return json({ error: 'lote não encontrado' }, 404);
    if (lote.status === 'pausado' || lote.status === 'cancelado') return json({ ok: true, parado: true });
    if (lote.status !== 'processando') {
      await service.from('ume_lotes').update({ status: 'processando' }).eq('id', loteId);
    }

    let processadosAgora = 0;

    while (Date.now() - inicio < ORCAMENTO_MS) {
      const { data: pendentes } = await service
        .from('ume_lote_itens')
        .select('id, cpf, tentativas')
        .eq('lote_id', loteId)
        .eq('status', 'pendente')
        .lt('tentativas', MAX_TENTATIVAS)
        .order('created_at', { ascending: true })
        .limit(PARALELO);

      if (!pendentes || pendentes.length === 0) break;

      const resultados = await Promise.all(pendentes.map((it) => processarItem(it, !!lote.forcar)));
      processadosAgora += pendentes.length;

      const layout = resultados.find((r) => !r.ok && (r as any).layoutMudou);
      if (layout) {
        await service
          .from('ume_lotes')
          .update({ status: 'pausado', erro: 'layout_ume_mudou' })
          .eq('id', loteId);
        await atualizarContadores(loteId);
        try {
          await notificarAdmin(service, {
            tipo: 'ume_layout_mudou',
            mensagem: '⚠️ *Calculadora UME em lote pausada*\n\nO layout do relatório da UME mudou. O lote foi pausado para não gerar valores errados.',
          });
        } catch { /* melhor esforço */ }
        return json({ ok: false, pausado: true, motivo: 'layout_ume_mudou' });
      }

      await atualizarContadores(loteId);
      await sleep(PAUSA_MS);
    }

    const pendentesRestantes = await atualizarContadores(loteId);
    if (pendentesRestantes > 0) {
      reencadear(loteId);
      return json({ ok: true, processadosAgora, pendentes: pendentesRestantes, continua: true });
    }
    return json({ ok: true, processadosAgora, concluido: true });
  } catch (error) {
    const msg = String((error as Error)?.message || error);
    console.error('[ume-lote-tick] erro', msg);
    return json({ ok: false, error: msg }, 200);
  }
});

// Ações sobre uma chamada existente: pre_accept, accept, reject e terminate.
// Usada tanto para atender/rejeitar chamadas de entrada quanto para encerrar as de saída.
import {
  corsHeaders, json, service, userDaRequisicao, carregarInstancia, podeUsarInstancia,
  chamarGraph, humanizarErroChamada, custoEstimado,
} from '../_shared/meta-call.ts';

const ACOES = ['pre_accept', 'accept', 'reject', 'terminate'] as const;
type Acao = typeof ACOES[number];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const acao: Acao = body?.acao;
    const callId: string | undefined = body?.call_id;
    const sdp: string | undefined = body?.sdp;
    let instanciaId: string | undefined = body?.instancia_id;

    if (!ACOES.includes(acao)) return json({ ok: false, error: 'Ação inválida' }, 400);
    if (!callId) return json({ ok: false, error: 'call_id é obrigatório' }, 400);

    const supabase = service();
    const userId = await userDaRequisicao(req);

    const { data: chamada } = await supabase.from('whatsapp_chamadas')
      .select('id, instancia_id, tipo_chamada, status, data_inicio, funcionario_id')
      .eq('call_id', callId).maybeSingle();
    instanciaId = instanciaId || chamada?.instancia_id || undefined;
    if (!instanciaId) return json({ ok: false, error: 'Chamada não encontrada' }, 404);

    if (!(await podeUsarInstancia(supabase, userId, instanciaId))) {
      return json({ ok: false, error: 'Sem acesso a esta instância' }, 403);
    }

    const inst = await carregarInstancia(supabase, instanciaId);

    // Chamadas de entrada: a Meta recomenda pre_accept (negocia o áudio) e depois accept.
    if (acao === 'accept' && sdp) {
      const pre = await chamarGraph(inst, {
        call_id: callId, action: 'pre_accept', session: { sdp_type: 'answer', sdp },
      });
      console.log('[meta-call-action:pre_accept]', pre.status, JSON.stringify(pre.data));
      // pre_accept é best-effort: se a Meta recusar, seguimos direto para o accept
    }

    const payload: Record<string, unknown> = { call_id: callId, action: acao };
    if ((acao === 'accept' || acao === 'pre_accept') && sdp) {
      payload.session = { sdp_type: 'answer', sdp };
    }

    const resp = await chamarGraph(inst, payload);
    console.log(`[meta-call-action:${acao}]`, resp.status, JSON.stringify(resp.data));
    if (!resp.ok) {
      const erro = humanizarErroChamada(resp.data);
      console.error(`[meta-call-action:${acao}] falha`, resp.status, JSON.stringify(resp.data));
      return json({ ok: false, error: erro, status: resp.status, details: resp.data }, 200);
    }


    if (chamada?.id) {
      const patch: Record<string, unknown> = { atualizado_em: new Date().toISOString() };
      if (acao === 'accept') {
        patch.status = 'em_andamento';
        if (!chamada.funcionario_id && userId) patch.funcionario_id = userId;
        // não gravamos o SDP local em sdp_answer: esse campo é reservado à
        // resposta do cliente em chamadas de saída

      } else if (acao === 'reject') {
        patch.status = 'rejeitada';
        patch.data_fim = new Date().toISOString();
      } else if (acao === 'terminate') {
        const inicio = new Date(chamada.data_inicio).getTime();
        const dur = chamada.status === 'em_andamento' ? Math.max(0, Math.round((Date.now() - inicio) / 1000)) : 0;
        patch.status = chamada.status === 'em_andamento' ? 'concluida' : 'perdida';
        patch.duracao_segundos = dur;
        patch.data_fim = new Date().toISOString();
        patch.custo_estimado = custoEstimado(dur, chamada.tipo_chamada);
      }
      await supabase.from('whatsapp_chamadas').update(patch).eq('id', chamada.id);
    }

    return json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    console.error('[meta-call-action] erro', msg);
    return json({ ok: false, error: msg }, 200);
  }
});

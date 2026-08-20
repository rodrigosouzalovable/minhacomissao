// Inicia uma chamada de voz de saída (atendente → cliente) pela Calling API oficial.
// O navegador manda a oferta SDP; a Meta devolve o call_id e a resposta SDP chega
// depois pelo webhook (evento connect/accept), gravada em whatsapp_chamadas.sdp_answer.
import {
  corsHeaders, json, service, userDaRequisicao, carregarInstancia, podeUsarInstancia,
  chamarGraph, humanizarErroChamada, digitos,
} from '../_shared/meta-call.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const instanciaId: string = body?.instancia_id;
    const telefone = digitos(body?.telefone);
    const contatoId: string | null = body?.contato_id ?? null;
    const sdp: string | undefined = body?.sdp;

    if (!instanciaId || !telefone) return json({ ok: false, error: 'instancia_id e telefone são obrigatórios' }, 400);
    if (!sdp) return json({ ok: false, error: 'Oferta de áudio (SDP) ausente' }, 400);

    const supabase = service();
    const userId = await userDaRequisicao(req);
    if (!(await podeUsarInstancia(supabase, userId, instanciaId))) {
      return json({ ok: false, error: 'Sem acesso a esta instância' }, 403);
    }

    const inst = await carregarInstancia(supabase, instanciaId);

    // Permissão de chamada precisa estar aceita e válida.
    const { data: perm } = await supabase.from('meta_call_permissions')
      .select('status, expira_em')
      .eq('instancia_id', instanciaId).eq('telefone', telefone).maybeSingle();
    const permOk = perm?.status === 'accepted'
      && (!perm.expira_em || new Date(perm.expira_em).getTime() > Date.now());
    if (!permOk) {
      return json({
        ok: false, precisa_permissao: true,
        error: 'O cliente ainda não autorizou chamadas. Envie o pedido de permissão primeiro.',
      }, 200);
    }

    const resp = await chamarGraph(inst, {
      to: telefone,
      action: 'connect',
      session: { sdp_type: 'offer', sdp },
    });

    const callId = resp.data?.calls?.[0]?.id ?? resp.data?.id ?? null;

    if (!resp.ok || !callId) {
      const erro = humanizarErroChamada(resp.data);
      await supabase.from('whatsapp_chamadas').insert({
        contato_id: contatoId, instancia_id: inst.id, funcionario_id: userId,
        waba_id: inst.waba_id, phone_number_id: inst.phone_number_id,
        telefone, tipo_chamada: 'saida', status: 'erro', erro,
      });
      console.error('[meta-call-start] falha', resp.status, JSON.stringify(resp.data));
      return json({ ok: false, error: erro, status: resp.status, details: resp.data }, 200);
    }

    const { data: row } = await supabase.from('whatsapp_chamadas').insert({
      contato_id: contatoId, instancia_id: inst.id, funcionario_id: userId,
      waba_id: inst.waba_id, phone_number_id: inst.phone_number_id,
      telefone, call_id: String(callId), tipo_chamada: 'saida',
      status: 'iniciada', sdp_offer: sdp,
    }).select('id').maybeSingle();

    return json({ ok: true, call_id: String(callId), chamada_id: row?.id ?? null });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    console.error('[meta-call-start] erro', msg);
    return json({ ok: false, error: msg }, 200);
  }
});

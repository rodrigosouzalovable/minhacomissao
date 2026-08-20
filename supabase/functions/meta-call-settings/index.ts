// Consulta e liga/desliga a Calling API em um número da Meta (call_settings).
// Precisa que o produto "Chamadas" já exista no app da Meta.
import {
  corsHeaders, json, service, userDaRequisicao, carregarInstancia, podeUsarInstancia,
  humanizarErroChamada, GRAPH,
} from '../_shared/meta-call.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const instanciaId: string = body?.instancia_id;
    const ativar: boolean | undefined = body?.ativar;
    if (!instanciaId) return json({ ok: false, error: 'instancia_id é obrigatório' }, 400);

    const supabase = service();
    const userId = await userDaRequisicao(req);
    if (!(await podeUsarInstancia(supabase, userId, instanciaId))) {
      return json({ ok: false, error: 'Sem acesso a esta instância' }, 403);
    }
    const inst = await carregarInstancia(supabase, instanciaId);

    if (typeof ativar === 'boolean') {
      const res = await fetch(`${GRAPH}/${inst.phone_number_id}/settings`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${inst.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          calling: {
            status: ativar ? 'ENABLED' : 'DISABLED',
            call_icon_visibility: ativar ? 'DEFAULT' : 'DISABLE_ALL',
            callback_permission_status: ativar ? 'ENABLED' : 'DISABLED',
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.error) {
        const erro = humanizarErroChamada(data);
        console.error('[meta-call-settings] falha ao salvar', res.status, JSON.stringify(data));
        return json({ ok: false, error: erro, status: res.status, details: data }, 200);
      }
      await supabase.from('meta_whatsapp_instances')
        .update({ chamadas_habilitadas: ativar }).eq('id', inst.id);
    }

    const get = await fetch(`${GRAPH}/${inst.phone_number_id}/settings?include=calling`, {
      headers: { Authorization: `Bearer ${inst.access_token}` },
    });
    const atual = await get.json().catch(() => ({}));
    const status = String(atual?.calling?.status || '').toUpperCase();
    if (status === 'ENABLED' || status === 'DISABLED') {
      await supabase.from('meta_whatsapp_instances')
        .update({ chamadas_habilitadas: status === 'ENABLED' }).eq('id', inst.id);
    }

    return json({ ok: true, calling: atual?.calling ?? null, habilitado: status === 'ENABLED' });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    console.error('[meta-call-settings] erro', msg);
    return json({ ok: false, error: msg }, 200);
  }
});

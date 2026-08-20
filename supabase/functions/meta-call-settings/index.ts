// Consulta e liga/desliga a Calling API em números da Meta (call_settings).
// Aceita uma instância (instancia_id) ou lote (instancia_ids / todas: true).
import {
  corsHeaders, json, service, userDaRequisicao, carregarInstancia, podeUsarInstancia,
  humanizarErroChamada, GRAPH, type Instancia,
} from '../_shared/meta-call.ts';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function ligarDesligar(inst: Instancia, ativar: boolean) {
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
  return { ok: res.ok && !data?.error, status: res.status, data };
}

async function lerStatus(inst: Instancia) {
  const get = await fetch(`${GRAPH}/${inst.phone_number_id}/settings?include=calling`, {
    headers: { Authorization: `Bearer ${inst.access_token}` },
  });
  const atual = await get.json().catch(() => ({}));
  return {
    calling: atual?.calling ?? null,
    status: String(atual?.calling?.status || 'NOT_SET').toUpperCase(),
    erro: atual?.error ? humanizarErroChamada(atual) : null,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const ativar: boolean | undefined = body?.ativar;
    const supabase = service();
    const userId = await userDaRequisicao(req);

    // ---------- modo lote ----------
    const emLote = body?.todas === true || Array.isArray(body?.instancia_ids);
    if (emLote) {
      let ids: string[] = Array.isArray(body?.instancia_ids) ? body.instancia_ids : [];
      if (body?.todas === true) {
        const { data } = await supabase
          .from('meta_whatsapp_instances')
          .select('id')
          .eq('provider', 'meta')
          .eq('ativo', true);
        ids = (data ?? []).map((r: any) => r.id);
      }

      const resultados: any[] = [];
      for (const id of ids) {
        try {
          if (!(await podeUsarInstancia(supabase, userId, id))) {
            resultados.push({ instancia_id: id, ok: false, error: 'Sem acesso a esta instância' });
            continue;
          }
          const inst = await carregarInstancia(supabase, id);
          if (typeof ativar === 'boolean') {
            const r = await ligarDesligar(inst, ativar);
            if (!r.ok) {
              const erro = humanizarErroChamada(r.data);
              resultados.push({ instancia_id: id, nome: inst.nome, ok: false, error: erro });
              await sleep(300);
              continue;
            }
          }
          const st = await lerStatus(inst);
          if (st.status === 'ENABLED' || st.status === 'DISABLED') {
            await supabase.from('meta_whatsapp_instances')
              .update({ chamadas_habilitadas: st.status === 'ENABLED' }).eq('id', inst.id);
          }
          resultados.push({
            instancia_id: id, nome: inst.nome, ok: true,
            status: st.status, habilitado: st.status === 'ENABLED',
          });
        } catch (e) {
          resultados.push({
            instancia_id: id, ok: false,
            error: e instanceof Error ? e.message : 'Erro desconhecido',
          });
        }
        await sleep(300);
      }

      return json({
        ok: true,
        total: resultados.length,
        habilitadas: resultados.filter((r) => r.ok && r.habilitado).length,
        falhas: resultados.filter((r) => !r.ok),
        resultados,
      });
    }

    // ---------- instância única ----------
    const instanciaId: string = body?.instancia_id;
    if (!instanciaId) return json({ ok: false, error: 'instancia_id é obrigatório' }, 400);

    if (!(await podeUsarInstancia(supabase, userId, instanciaId))) {
      return json({ ok: false, error: 'Sem acesso a esta instância' }, 403);
    }
    const inst = await carregarInstancia(supabase, instanciaId);

    // Diagnóstico: mostra platform_type / status do número (útil quando a Meta recusa com #141000).
    if (body?.diag === true) {
      const r = await fetch(
        `${GRAPH}/${inst.phone_number_id}?fields=display_phone_number,verified_name,platform_type,code_verification_status,quality_rating,status,throughput,is_official_business_account`,
        { headers: { Authorization: `Bearer ${inst.access_token}` } },
      );
      const info = await r.json().catch(() => ({}));
      const st = await lerStatus(inst);
      return json({ ok: true, numero: info, calling: st.calling, status: st.status });
    }


    if (typeof ativar === 'boolean') {
      const r = await ligarDesligar(inst, ativar);
      if (!r.ok) {
        const erro = humanizarErroChamada(r.data);
        console.error('[meta-call-settings] falha ao salvar', r.status, JSON.stringify(r.data));
        return json({ ok: false, error: erro, status: r.status, details: r.data }, 200);
      }
      await supabase.from('meta_whatsapp_instances')
        .update({ chamadas_habilitadas: ativar }).eq('id', inst.id);
    }

    const st = await lerStatus(inst);
    if (st.status === 'ENABLED' || st.status === 'DISABLED') {
      await supabase.from('meta_whatsapp_instances')
        .update({ chamadas_habilitadas: st.status === 'ENABLED' }).eq('id', inst.id);
    }

    return json({ ok: true, calling: st.calling, status: st.status, habilitado: st.status === 'ENABLED' });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    console.error('[meta-call-settings] erro', msg);
    return json({ ok: false, error: msg }, 200);
  }
});

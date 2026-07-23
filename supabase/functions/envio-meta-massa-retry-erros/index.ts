// Reenvia itens com status='erro' de um job — devolve-os para 'pendente',
// zera contador de tentativas, reabre o job (status='rodando') e re-dispara
// o worker (rajada) ou o tick (serial). O throttle e retry ficam por conta
// do próprio envio (envio-meta-massa-burst / envio-meta-massa-tick).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get('Authorization') || '';
    const jwt = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!jwt) {
      return new Response(JSON.stringify({ success: false, error: 'não autenticado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const { data: userData } = await supabase.auth.getUser(jwt);
    const user = userData?.user;
    if (!user) {
      return new Response(JSON.stringify({ success: false, error: 'usuário inválido' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const jobId: string = body?.job_id;
    if (!jobId) {
      return new Response(JSON.stringify({ success: false, error: 'job_id obrigatório' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: job } = await supabase.from('envio_meta_job').select('*').eq('id', jobId).maybeSingle();
    if (!job) {
      return new Response(JSON.stringify({ success: false, error: 'job não encontrado' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (job.user_id !== user.id) {
      const { data: role } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
      if (!role) {
        return new Response(JSON.stringify({ success: false, error: 'sem permissão' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Devolve todos os itens com erro para pendente e zera tentativas.
    const { data: reset, error: resetErr } = await supabase
      .from('envio_meta_job_item')
      .update({ status: 'pendente', erro: null, tentativas: 0, processado_em: null })
      .eq('job_id', jobId)
      .eq('status', 'erro')
      .select('id, instancia_id');
    if (resetErr) throw resetErr;

    const totalReenfileirados = reset?.length ?? 0;
    if (totalReenfileirados === 0) {
      return new Response(JSON.stringify({ success: true, reenfileirados: 0, mensagem: 'Nenhum item com erro' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Ajusta contadores do job: decrementa erros pelos reenfileirados e reabre.
    const jobPatch: Record<string, unknown> = {
      status: 'rodando',
      erros: Math.max(0, (job.erros || 0) - totalReenfileirados),
      concluido_em: null,
      proximo_em: new Date().toISOString(),
    };
    if (job.modo_rajada) jobPatch.msgs_por_segundo = 1;
    await supabase.from('envio_meta_job').update(jobPatch).eq('id', jobId);

    // Re-dispara worker apropriado
    if (job.modo_rajada) {
      // Redistribui itens com erro entre instâncias ELEGÍVEIS do job (não pausadas/restritas).
      const jobInstIds: string[] = Array.isArray(job.instancia_ids) ? job.instancia_ids : [];
      const { data: insts } = await supabase
        .from('meta_whatsapp_instances')
        .select('id, ativo, estado_pool, pausa_automatica_ate')
        .in('id', jobInstIds.length ? jobInstIds : ['00000000-0000-0000-0000-000000000000']);
      const agora = Date.now();
      const elegiveis = (insts || []).filter((i: any) => {
        if (!i.ativo) return false;
        if (i.estado_pool === 'restrita') return false;
        if (i.pausa_automatica_ate && new Date(i.pausa_automatica_ate).getTime() > agora) return false;
        return true;
      }).map((i: any) => i.id);

      if (elegiveis.length === 0) {
        return new Response(JSON.stringify({
          success: false,
          reenfileirados: totalReenfileirados,
          error: 'Nenhuma instância elegível para retomar (todas pausadas/restritas).',
        }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Round-robin reatribuindo instancia_id dos itens resetados.
      const buckets: Record<string, string[]> = {};
      elegiveis.forEach((id: string) => { buckets[id] = []; });
      (reset || []).forEach((row: any, idx: number) => {
        const target = elegiveis[idx % elegiveis.length];
        buckets[target].push(row.id);
      });
      for (const [instId, ids] of Object.entries(buckets)) {
        if (!ids.length) continue;
        // chunk para evitar payload muito grande
        for (let i = 0; i < ids.length; i += 500) {
          const chunk = ids.slice(i, i + 500);
          await supabase.from('envio_meta_job_item')
            .update({ instancia_id: instId })
            .in('id', chunk);
        }
      }

      for (const instId of elegiveis) {
        fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/envio-meta-massa-burst`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          },
          body: JSON.stringify({ job_id: jobId, instancia_id: instId }),
        }).catch(() => {});
      }
    } else {
      fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/envio-meta-massa-tick`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({ job_id: jobId }),
      }).catch(() => {});
    }

    return new Response(JSON.stringify({ success: true, reenfileirados: totalReenfileirados }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[envio-meta-massa-retry-erros]', e);
    return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : 'erro' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

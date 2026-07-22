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
    if (job.modo_rajada) jobPatch.msgs_por_segundo = Math.min(1, Number(job.msgs_por_segundo) || 1);
    await supabase.from('envio_meta_job').update(jobPatch).eq('id', jobId);

    // Re-dispara worker apropriado
    if (job.modo_rajada) {
      const instancias = Array.from(new Set((reset || []).map((r: any) => r.instancia_id).filter(Boolean)));
      for (const instId of instancias) {
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

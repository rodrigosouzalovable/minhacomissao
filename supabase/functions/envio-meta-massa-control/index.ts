// Controla um job de envio massa Meta: pausar / retomar / cancelar / limpar.
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
    const acao: string = body?.acao; // pausar | retomar | cancelar | limpar
    if (!jobId || !acao) {
      return new Response(JSON.stringify({ success: false, error: 'job_id e acao obrigatórios' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: job, error: jobErr } = await supabase
      .from('envio_meta_job').select('*').eq('id', jobId).maybeSingle();
    if (jobErr) throw jobErr;
    if (!job) {
      // Job pode ter sido limpo/excluído — responde 200 para não quebrar auto-retomada/UI.
      return new Response(JSON.stringify({ success: true, skipped: true, reason: 'job_nao_encontrado' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (job.user_id !== user.id) {
      const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
      if (!isAdmin) {
        return new Response(JSON.stringify({ success: false, error: 'sem permissão' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const devolverProcessandoParaFila = async () => {
      await supabase
        .from('envio_meta_job_item')
        .update({ status: 'pendente', processado_em: null })
        .eq('job_id', jobId)
        .eq('status', 'processando');
    };

    const dispararWorker = (targetJob: any) => {
      if (targetJob?.modo_rajada) {
        for (const instId of (targetJob.instancia_ids || [])) {
          fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/envio-meta-massa-burst`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            },
            body: JSON.stringify({ job_id: jobId, instancia_id: instId }),
          }).catch(() => {});
        }
        return;
      }
      fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/envio-meta-massa-tick`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({ job_id: jobId }),
      }).catch(() => {});
    };

    if (acao === 'pausar') {
      await supabase.from('envio_meta_job').update({
        status: 'pausado',
        atual_telefone: null,
        atual_instancia: null,
        proximo_em: null,
      }).eq('id', jobId);
      await devolverProcessandoParaFila();
    } else if (acao === 'retomar') {
      await supabase.from('envio_meta_job').update({
        status: 'rodando',
        proximo_em: new Date().toISOString(),
        status_motivo: null,
      }).eq('id', jobId);
      dispararWorker(job);
    } else if (acao === 'cancelar') {
      await supabase.from('envio_meta_job').update({
        status: 'cancelado',
        concluido_em: new Date().toISOString(),
        atual_telefone: null,
        atual_instancia: null,
        proximo_em: null,
      }).eq('id', jobId);
      await devolverProcessandoParaFila();
    } else if (acao === 'reativar') {
      // Reenfileira itens com erro/falha de volta para pendente e devolve órfãos em "processando"
      await supabase
        .from('envio_meta_job_item')
        .update({ status: 'pendente', erro: null, tentativas: 0 })
        .eq('job_id', jobId)
        .in('status', ['erro', 'falha']);
      await devolverProcessandoParaFila();

      const { count: pendentes } = await supabase
        .from('envio_meta_job_item')
        .select('id', { count: 'exact', head: true })
        .eq('job_id', jobId)
        .eq('status', 'pendente');
      if (!pendentes || pendentes === 0) {
        return new Response(JSON.stringify({ success: false, error: 'não há contatos pendentes para reativar' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      await supabase.from('envio_meta_job').update({
        status: 'rodando',
        concluido_em: null,
        status_motivo: null,
        proximo_em: new Date().toISOString(),
      }).eq('id', jobId);
      dispararWorker(job);
    } else if (acao === 'limpar') {
      // Só remove jobs concluídos/cancelados
      if (!['concluido', 'cancelado', 'erro'].includes(job.status)) {
        return new Response(JSON.stringify({ success: false, error: 'só é possível limpar jobs finalizados' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      await supabase.from('envio_meta_job').delete().eq('id', jobId);
    } else {
      return new Response(JSON.stringify({ success: false, error: 'ação inválida' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[envio-meta-massa-control]', e);
    return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : 'erro' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

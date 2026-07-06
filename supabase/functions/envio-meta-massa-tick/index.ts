// Tick do envio massa Meta. Chamado pelo pg_cron e por self-invoke.
// Loop interno respeita o delay configurado pelo usuário (min_seg/max_seg)
// sem depender do intervalo do cron.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const MAX_WALL_MS = 50_000; // budget por invocação (edge fn tem ~60s)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchJob(id: string) {
  const { data } = await supabase.from('envio_meta_job').select('*').eq('id', id).maybeSingle();
  return data;
}

function selfInvoke(jobId: string) {
  fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/envio-meta-massa-tick`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
    },
    body: JSON.stringify({ job_id: jobId }),
  }).catch(() => {});
}

type ItemResult =
  | { advanced: true; delayMs: number }
  | { advanced: false; waitMs?: number; done?: boolean; stop?: boolean };

function delayUsuarioMs(job: any): number {
  const lo = Math.max(1, Number(job?.min_seg) || 30);
  const hi = Math.max(lo, Number(job?.max_seg) || 90);
  const sec = Math.floor(Math.random() * (hi - lo + 1)) + lo;
  return sec * 1000;
}

async function processarItem(job: any): Promise<ItemResult> {
  if (!job || job.status !== 'rodando') return { advanced: false, stop: true };

  const proxMs = job.proximo_em ? new Date(job.proximo_em).getTime() - Date.now() : 0;
  if (proxMs > 0) return { advanced: false, waitMs: proxMs };

  const { data: pend, error: pendErr } = await supabase
    .from('envio_meta_job_item')
    .select('id, ordem, telefone, nome, cpf, atraso, saldo')
    .eq('job_id', job.id)
    .eq('status', 'pendente')
    .order('ordem', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (pendErr) { console.error('[tick pendErr]', pendErr); return { advanced: false, waitMs: delayUsuarioMs(job) }; }

  if (!pend) {
    await supabase.from('envio_meta_job').update({
      status: 'concluido',
      concluido_em: new Date().toISOString(),
      atual_telefone: null,
      atual_instancia: null,
      proximo_em: null,
    }).eq('id', job.id);
    return { advanced: false, done: true };
  }

  const pickResp = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/pick-meta-instance`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
    },
    body: JSON.stringify({ instancia_ids: job.instancia_ids, user_id: job.user_id }),
  }).then((r) => r.json()).catch((e) => ({ success: false, error: String(e) }));

  if (!pickResp?.success) {
    const blocked = pickResp?.blocked;
    if (blocked === 'domingo' || blocked === 'horario') {
      const waitMs = 10 * 60_000;
      await supabase.from('envio_meta_job').update({
        proximo_em: new Date(Date.now() + waitMs).toISOString(),
        status_motivo: pickResp?.error || blocked,
      }).eq('id', job.id);
      return { advanced: false, waitMs };
    }
    // soft block: sem_disponivel ou erro genérico → respeita delay do usuário
    const waitMs = delayUsuarioMs(job);
    await supabase.from('envio_meta_job').update({
      proximo_em: new Date(Date.now() + waitMs).toISOString(),
      status_motivo: pickResp?.error || blocked || 'pick falhou',
    }).eq('id', job.id);
    return { advanced: false, waitMs };
  }

  const instId: string = pickResp.instancia_id;
  const instNome: string = pickResp.nome;

  const { data: reserved, error: reservErr } = await supabase
    .from('envio_meta_job_item')
    .update({ status: 'processando', instancia_id: instId, instancia_nome: instNome })
    .eq('id', pend.id)
    .eq('status', 'pendente')
    .select('id')
    .maybeSingle();
  if (reservErr || !reserved) return { advanced: false, waitMs: 1_000 };

  await supabase.from('envio_meta_job').update({
    atual_telefone: pend.telefone,
    atual_instancia: instNome,
  }).eq('id', job.id);

  const tplId = (job.template_id_by_instance || {})[instId] || job.template_id;
  const cliente = {
    telefone: pend.telefone,
    nome: pend.nome,
    cpf: pend.cpf,
    atraso: pend.atraso,
    saldo: pend.saldo,
  };

  let ok = false;
  let erroMsg: string | null = null;
  try {
    const sendResp = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-whatsapp-meta`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({ template_id: tplId, instancia_id: instId, cliente, user_id: job.user_id }),
    }).then((r) => r.json());

    if (sendResp?.tier_full || sendResp?.pool_blocked || sendResp?.pool_paused) {
      await supabase.from('envio_meta_job_item')
        .update({ status: 'pendente', instancia_id: null, instancia_nome: null })
        .eq('id', pend.id);
      const waitMs = 30_000;
      await supabase.from('envio_meta_job').update({
        proximo_em: new Date(Date.now() + waitMs).toISOString(),
        status_motivo: sendResp?.error || 'instância indisponível',
      }).eq('id', job.id);
      return { advanced: false, waitMs };
    }
    if (sendResp?.blocked === 'domingo' || sendResp?.blocked === 'horario') {
      await supabase.from('envio_meta_job_item')
        .update({ status: 'pendente', instancia_id: null, instancia_nome: null })
        .eq('id', pend.id);
      const waitMs = 10 * 60_000;
      await supabase.from('envio_meta_job').update({
        proximo_em: new Date(Date.now() + waitMs).toISOString(),
        status_motivo: sendResp.error,
      }).eq('id', job.id);
      return { advanced: false, waitMs };
    }
    if (sendResp?.success) ok = true;
    else erroMsg = sendResp?.error || 'falha';
  } catch (e) {
    erroMsg = e instanceof Error ? e.message : String(e);
  }

  await supabase.from('envio_meta_job_item').update({
    status: ok ? 'enviado' : 'erro',
    erro: ok ? null : erroMsg,
    processado_em: new Date().toISOString(),
  }).eq('id', pend.id);

  const lo = Math.max(1, job.min_seg || 30);
  const hi = Math.max(lo, job.max_seg || 90);
  const delaySec = Math.floor(Math.random() * (hi - lo + 1)) + lo;
  const delayMs = delaySec * 1000;
  const proximoEm = new Date(Date.now() + delayMs).toISOString();

  const { error: rpcErr } = await supabase.rpc('envio_meta_job_bump', {
    _job_id: job.id,
    _enviados_inc: ok ? 1 : 0,
    _erros_inc: ok ? 0 : 1,
    _proximo_em: proximoEm,
  });
  if (rpcErr) {
    await supabase.from('envio_meta_job').update({
      enviados: (job.enviados || 0) + (ok ? 1 : 0),
      erros: (job.erros || 0) + (ok ? 0 : 1),
      proximo_em: proximoEm,
      status_motivo: null,
    }).eq('id', job.id);
  }

  return { advanced: true, delayMs };
}

async function rodarJobLoop(jobInicial: any): Promise<{ processados: number; selfInvokeNeeded: boolean; jobId: string }> {
  const inicio = Date.now();
  let job = jobInicial;
  let processados = 0;
  let selfInvokeNeeded = false;

  while (true) {
    if (Date.now() - inicio > MAX_WALL_MS) { selfInvokeNeeded = true; break; }

    const r = await processarItem(job);
    if ('stop' in r && r.stop) break;
    if ('done' in r && r.done) break;

    if (r.advanced) {
      processados++;
      const restante = MAX_WALL_MS - (Date.now() - inicio);
      if (r.delayMs > restante) { selfInvokeNeeded = true; break; }
      await sleep(r.delayMs);
      const refreshed = await fetchJob(job.id);
      if (!refreshed || refreshed.status !== 'rodando') { job = refreshed; break; }
      job = refreshed;
      continue;
    }

    const waitMs = r.waitMs ?? 5_000;
    const restante = MAX_WALL_MS - (Date.now() - inicio);
    if (waitMs > Math.min(restante, 15_000)) { selfInvokeNeeded = true; break; }
    await sleep(waitMs);
    const refreshed = await fetchJob(job.id);
    if (!refreshed || refreshed.status !== 'rodando') { job = refreshed; break; }
    job = refreshed;
  }

  return { processados, selfInvokeNeeded: selfInvokeNeeded && !!job && job.status === 'rodando', jobId: jobInicial.id };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    let body: any = {};
    try { body = await req.json(); } catch {}
    const jobId: string | undefined = body?.job_id;

    let query = supabase.from('envio_meta_job').select('*').eq('status', 'rodando');
    if (jobId) query = query.eq('id', jobId);
    const { data: jobs, error } = await query.order('iniciado_em', { ascending: true }).limit(50);
    if (error) throw error;

    let processadosTotal = 0;

    if (jobs && jobs.length > 0) {
      if (jobId && jobs.length === 1) {
        const r = await rodarJobLoop(jobs[0]);
        processadosTotal += r.processados;
        if (r.selfInvokeNeeded) selfInvoke(r.jobId);
      } else {
        for (const job of jobs) {
          try {
            const r = await processarItem(job);
            if ('advanced' in r && r.advanced) {
              processadosTotal++;
              selfInvoke(job.id);
            } else if (!('done' in r && r.done) && !('stop' in r && r.stop)) {
              if ((r.waitMs ?? 0) <= 30_000) selfInvoke(job.id);
            }
          } catch (e) {
            console.error('[tick job]', job.id, e);
          }
        }
      }
    }

    return new Response(JSON.stringify({ success: true, jobs: jobs?.length ?? 0, processados: processadosTotal }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[envio-meta-massa-tick]', e);
    return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : 'erro' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

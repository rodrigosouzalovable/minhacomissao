// Tick do envio massa Meta. Chamado a cada 20s pelo pg_cron.
// Também pode receber { job_id } para processar um job específico.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

async function processarJob(job: any): Promise<boolean> {
  // retorna true se avançou (processou 1 item), false caso contrário
  if (job.status !== 'rodando') return false;
  if (job.proximo_em && new Date(job.proximo_em) > new Date()) return false;

  // Verifica se ainda há pendentes
  const { data: pend, error: pendErr } = await supabase
    .from('envio_meta_job_item')
    .select('id, ordem, telefone, nome, cpf, atraso, saldo')
    .eq('job_id', job.id)
    .eq('status', 'pendente')
    .order('ordem', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (pendErr) { console.error('[tick pendErr]', pendErr); return false; }

  if (!pend) {
    // acabou
    await supabase.from('envio_meta_job').update({
      status: 'concluido',
      concluido_em: new Date().toISOString(),
      atual_telefone: null,
      atual_instancia: null,
      proximo_em: null,
    }).eq('id', job.id);
    return false;
  }

  // Escolhe instância via pick-meta-instance (usa contexto de service role -> ignora auth)
  let instId: string | null = null;
  let instNome: string | null = null;
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
    // Se bloqueio "duro" (domingo/horário/sem_disponivel), reagenda para daqui 5min sem pausar
    if (blocked === 'domingo' || blocked === 'horario' || blocked === 'sem_disponivel') {
      await supabase.from('envio_meta_job').update({
        proximo_em: new Date(Date.now() + 5 * 60_000).toISOString(),
        status_motivo: pickResp?.error || blocked,
      }).eq('id', job.id);
      return false;
    }
    // Erro genérico: reagenda 1min
    await supabase.from('envio_meta_job').update({
      proximo_em: new Date(Date.now() + 60_000).toISOString(),
      status_motivo: pickResp?.error || 'pick falhou',
    }).eq('id', job.id);
    return false;
  }
  instId = pickResp.instancia_id;
  instNome = pickResp.nome;

  // Marca item como "processando" atomicamente via update (evita duplicidade entre ticks paralelos)
  const { data: reserved, error: reservErr } = await supabase
    .from('envio_meta_job_item')
    .update({ status: 'processando', instancia_id: instId, instancia_nome: instNome })
    .eq('id', pend.id)
    .eq('status', 'pendente')
    .select('id')
    .maybeSingle();
  if (reservErr || !reserved) return false;

  // Atualiza job com telefone/instância atuais
  await supabase.from('envio_meta_job').update({
    atual_telefone: pend.telefone,
    atual_instancia: instNome,
  }).eq('id', job.id);

  // Chama envio
  const tplId = (job.template_id_by_instance || {})[instId!] || job.template_id;
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
      // Instância indisponível: solta reserva, tentará outra no próximo tick
      await supabase.from('envio_meta_job_item')
        .update({ status: 'pendente', instancia_id: null, instancia_nome: null })
        .eq('id', pend.id);
      await supabase.from('envio_meta_job').update({
        proximo_em: new Date(Date.now() + 30_000).toISOString(),
        status_motivo: sendResp?.error || 'instância indisponível',
      }).eq('id', job.id);
      return false;
    }
    if (sendResp?.blocked === 'domingo' || sendResp?.blocked === 'horario') {
      await supabase.from('envio_meta_job_item')
        .update({ status: 'pendente', instancia_id: null, instancia_nome: null })
        .eq('id', pend.id);
      await supabase.from('envio_meta_job').update({
        proximo_em: new Date(Date.now() + 10 * 60_000).toISOString(),
        status_motivo: sendResp.error,
      }).eq('id', job.id);
      return false;
    }
    if (sendResp?.success) {
      ok = true;
    } else {
      erroMsg = sendResp?.error || 'falha';
    }
  } catch (e) {
    erroMsg = e instanceof Error ? e.message : String(e);
  }

  // Grava resultado do item
  await supabase.from('envio_meta_job_item').update({
    status: ok ? 'enviado' : 'erro',
    erro: ok ? null : erroMsg,
    processado_em: new Date().toISOString(),
  }).eq('id', pend.id);

  // Delay para próximo envio
  const lo = Math.max(1, job.min_seg || 30);
  const hi = Math.max(lo, job.max_seg || 90);
  const delay = Math.floor(Math.random() * (hi - lo + 1)) + lo;

  // Atualiza contadores no job
  await supabase.rpc('envio_meta_job_bump', {
    _job_id: job.id,
    _enviados_inc: ok ? 1 : 0,
    _erros_inc: ok ? 0 : 1,
    _proximo_em: new Date(Date.now() + delay * 1000).toISOString(),
  }).then(async ({ error }) => {
    if (error) {
      // fallback manual (caso RPC não exista)
      await supabase.from('envio_meta_job').update({
        enviados: (job.enviados || 0) + (ok ? 1 : 0),
        erros: (job.erros || 0) + (ok ? 0 : 1),
        proximo_em: new Date(Date.now() + delay * 1000).toISOString(),
        status_motivo: null,
      }).eq('id', job.id);
    }
  });

  return true;
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

    let processados = 0;
    if (jobs) {
      for (const job of jobs) {
        try {
          const avancou = await processarJob(job);
          if (avancou) processados++;
        } catch (e) {
          console.error('[tick job]', job.id, e);
        }
      }
    }

    return new Response(JSON.stringify({ success: true, jobs: jobs?.length ?? 0, processados }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[envio-meta-massa-tick]', e);
    return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : 'erro' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

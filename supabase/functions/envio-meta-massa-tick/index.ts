// Tick curto do envio massa Meta. Cada execução processa no máximo um item por
// campanha elegível e encerra; o pg_cron agenda o próximo tick sem manter uma
// função ociosa durante o delay configurado pelo usuário.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
);

async function jobEstaRodando(jobId: string) {
  const { data } = await supabase.from('envio_meta_job').select('status').eq('id', jobId).maybeSingle();
  return data?.status === 'rodando';
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

// Delay considerado "curto": abaixo disso não vale devolver ao agendador de 10s,
// pois o arredondamento distorce o ritmo pedido pelo usuário.
const DELAY_CURTO_MS = 25_000;
// Orçamento máximo de uma execução em laço (evita função longa demais).
const ORCAMENTO_MS = 120_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function encerrarJobSemDisponibilidade(job: any, motivo: string) {
  const { data: transitioned } = await supabase.from('envio_meta_job').update({
    status: 'erro',
    status_motivo: motivo,
    concluido_em: new Date().toISOString(),
    atual_telefone: null,
    atual_instancia: null,
    proximo_em: null,
  }).eq('id', job.id).eq('status', 'rodando').select('id').maybeSingle();
  if (transitioned) {
    await notificarConclusao(job.id, 'erro', motivo);
  }
}


async function notificarConclusao(jobId: string, statusFinal: 'concluido' | 'erro', motivo?: string) {
  try {
    const { data: job } = await supabase
      .from('envio_meta_job')
      .select('*')
      .eq('id', jobId)
      .maybeSingle();
    if (!job) return;

    const { count: semWaCount } = await supabase
      .from('envio_meta_job_item')
      .select('id', { count: 'exact', head: true })
      .eq('job_id', jobId)
      .eq('status', 'sem_whatsapp');

    // Instâncias que ficaram restritas durante o job
    const { data: restritas } = await supabase
      .from('meta_whatsapp_instances')
      .select('nome, display_phone, pausa_automatica_motivo, pausa_automatica_ate')
      .in('id', job.instancia_ids || [])
      .eq('estado_pool', 'restrita')
      .gte('pausa_automatica_ate', job.iniciado_em);

    const total = job.total || 0;
    const enviados = job.enviados || 0;
    const erros = job.erros || 0;
    const semWa = semWaCount || 0;
    const template = job.template_nome || '—';
    const inicio = new Date(job.iniciado_em).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const fim = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    const cabec = statusFinal === 'concluido'
      ? '✅ *Envio Meta concluído*'
      : `⚠️ *Envio Meta encerrado*${motivo ? ` — ${motivo}` : ''}`;

    let msg = `${cabec}\n\n` +
      `📄 Template: *${template}*\n` +
      `📊 Total: ${total}\n` +
      `✅ Enviados: ${enviados}\n` +
      `❌ Falharam: ${erros}\n` +
      (semWa > 0 ? `🚫 Sem WhatsApp: ${semWa}\n` : '') +
      `🕐 Início: ${inicio}\n` +
      `🕐 Fim: ${fim}\n\n`;

    if (restritas && restritas.length > 0) {
      msg += `🚫 *Instâncias restringidas durante o envio:*\n`;
      for (const r of restritas as any[]) {
        const label = r.nome || r.display_phone || 'instância';
        const fone = r.display_phone && r.nome ? ` (${r.display_phone})` : '';
        msg += `• ${label}${fone} — ${r.pausa_automatica_motivo || 'restrição Meta'}\n`;
      }
    } else {
      msg += `✅ Nenhuma instância restringida.`;
    }

    // Instâncias auto-ignoradas por falhas consecutivas neste job
    const bloqRun: string[] = Array.isArray(job.instancias_bloqueadas_run) ? job.instancias_bloqueadas_run : [];
    if (bloqRun.length > 0) {
      const { data: autoIgn } = await supabase
        .from('meta_whatsapp_instances')
        .select('id, nome, display_phone')
        .in('id', bloqRun);
      msg += `\n⚠️ *Instâncias auto-ignoradas por falhas consecutivas:*\n`;
      for (const r of (autoIgn || []) as any[]) {
        const label = r.nome || r.display_phone || 'instância';
        const fone = r.display_phone && r.nome ? ` (${r.display_phone})` : '';
        msg += `• ${label}${fone}\n`;
      }
    }

    // Campanha cancelada/pausada pelo usuário não gera aviso
    if (job.status === 'cancelado' || job.status === 'pausado') return;

    const { notificarAdmin } = await import('../_shared/notificar-admin.ts');
    await notificarAdmin(supabase, {
      tipo: 'envio_meta_concluido',
      mensagem: msg,
      // Uma única mensagem por campanha, independente do desfecho
      chaveIdempotencia: `envio_meta_job_fim_${jobId}`,
      umaVezPorChave: true,
    });
  } catch (e) {
    console.error('[tick] notificarConclusao falhou:', String(e).slice(0, 300));
  }
}


async function processarItem(job: any): Promise<ItemResult> {
  if (!job || job.status !== 'rodando') return { advanced: false, stop: true };
  if (!(await jobEstaRodando(job.id))) return { advanced: false, stop: true };

  const proxMs = job.proximo_em ? new Date(job.proximo_em).getTime() - Date.now() : 0;
  if (proxMs > 0) return { advanced: false, waitMs: proxMs };

  const { data: pend, error: pendErr } = await supabase
    .from('envio_meta_job_item')
    .select('id, ordem, telefone, nome, cpf, atraso, saldo, vars, tentativas')
    .eq('job_id', job.id)
    .eq('status', 'pendente')
    .order('ordem', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (pendErr) { console.error('[tick pendErr]', pendErr); return { advanced: false, waitMs: delayUsuarioMs(job) }; }

  if (!pend) {
    const { data: transitioned } = await supabase.from('envio_meta_job').update({
      status: 'concluido',
      concluido_em: new Date().toISOString(),
      atual_telefone: null,
      atual_instancia: null,
      proximo_em: null,
    }).eq('id', job.id).eq('status', 'rodando').select('id').maybeSingle();
    if (transitioned) {
      await notificarConclusao(job.id, 'concluido');
    }
    return { advanced: false, done: true };
  }



  // Remove instâncias auto-bloqueadas por falhas consecutivas neste job
  const bloqueadasRun: string[] = Array.isArray(job.instancias_bloqueadas_run) ? job.instancias_bloqueadas_run : [];
  // Instâncias que já falharam para ESTE contato (não repetir o mesmo número no mesmo chip)
  const varsPend = ((pend as any).vars && typeof (pend as any).vars === 'object') ? (pend as any).vars : {};
  const exclItem: string[] = Array.isArray(varsPend._inst_excluidas) ? varsPend._inst_excluidas : [];

  const instanciaIdsDisponiveis: string[] = (job.instancia_ids || [])
    .filter((id: string) => !bloqueadasRun.includes(id) && !exclItem.includes(id));
  if (instanciaIdsDisponiveis.length === 0) {
    // Se sobrou instância no job mas nenhuma serve para este contato, marca só o item como erro
    const restaNoJob = (job.instancia_ids || []).filter((id: string) => !bloqueadasRun.includes(id));
    if (restaNoJob.length > 0) {
      await supabase.from('envio_meta_job_item').update({
        status: 'erro',
        erro: 'Todas as instâncias disponíveis já falharam na entrega para este contato',
        processado_em: new Date().toISOString(),
      }).eq('id', pend.id);
      return { advanced: true, waitMs: 1_000 };
    }
    await encerrarJobSemDisponibilidade(job, 'Todas as instâncias selecionadas foram ignoradas por falhas consecutivas');
    return { advanced: false, stop: true };
  }

  const pickResp = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/pick-meta-instance`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
    },
    body: JSON.stringify({
      instancia_ids: instanciaIdsDisponiveis,
      user_id: job.user_id,
      excluir_id: job.ultima_instancia_id || null,
      excluir_ids: exclItem,
      ignorar_pausa_qualidade: job.modo_rajada === true,
    }),


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
    if (blocked === 'sem_disponivel') {
      await encerrarJobSemDisponibilidade(job, pickResp?.error || 'Nenhuma instância disponível para envio');
      return { advanced: false, stop: true };
    }
    // erro transitório genérico → respeita delay do usuário
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

  if (!(await jobEstaRodando(job.id))) {
    await supabase.from('envio_meta_job_item')
      .update({ status: 'pendente', instancia_id: null, instancia_nome: null })
      .eq('id', pend.id)
      .eq('status', 'processando');
    return { advanced: false, stop: true };
  }

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
    vars: (pend as any).vars || {},
  };

  const MAX_TENTATIVAS_ITEM = 3;
  const tentativasAtual = Number((pend as any).tentativas || 0);

  let ok = false;
  let waIdOk: string | null = null;
  let erroMsg: string | null = null;
  try {
    const sendResp = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-whatsapp-meta`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({ template_id: tplId, instancia_id: instId, cliente, user_id: job.user_id, folder_id: job.folder_id ?? null }),
    }).then((r) => r.json());

    if (sendResp?.tier_full || sendResp?.pool_blocked || sendResp?.pool_paused || sendResp?.bm_quota_blocked) {
      await supabase.from('envio_meta_job_item')
        .update({ status: 'pendente', instancia_id: null, instancia_nome: null })
        .eq('id', pend.id);
      const waitMs = delayUsuarioMs(job);
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
    if (sendResp?.success) {
      ok = true;
      waIdOk = sendResp?.waId || null;
    } else {
      erroMsg = sendResp?.error || 'falha';
    }
  } catch (e) {
    erroMsg = e instanceof Error ? e.message : String(e);
  }

  // Contadores por instância — auto-ignora instância no PRIMEIRO erro
  const MAX_FALHAS_CONSECUTIVAS = 1;
  const falhasMap: Record<string, number> = (job.falhas_por_instancia_run && typeof job.falhas_por_instancia_run === 'object')
    ? { ...job.falhas_por_instancia_run } : {};
  const bloqueadasRunAtual: string[] = Array.isArray(job.instancias_bloqueadas_run)
    ? [...job.instancias_bloqueadas_run] : [];

  // #131053 (Media upload error) é falha da mídia do template, não da instância:
  // o contato volta pra fila mas a instância NÃO é bloqueada.
  const erroDeMidia = !ok && /#131053|media upload error/i.test(String(erroMsg || ''));

  if (ok || erroDeMidia) {
    if (ok && falhasMap[instId]) delete falhasMap[instId];
  } else {
    falhasMap[instId] = (falhasMap[instId] || 0) + 1;
    if (falhasMap[instId] >= MAX_FALHAS_CONSECUTIVAS && !bloqueadasRunAtual.includes(instId)) {
      bloqueadasRunAtual.push(instId);
      delete falhasMap[instId];
    }
  }


  // Verifica se ainda restam instâncias disponíveis para tentar outra vez
  const restantesDisponiveis = (job.instancia_ids || []).filter((id: string) => !bloqueadasRunAtual.includes(id));

  // Guardrail: se nenhuma instância ainda conseguiu enviar (enviados===0)
  // e TODAS as instâncias já falharam ao menos uma vez, encerra o job.
  const todasInstancias: string[] = Array.isArray(job.instancia_ids) ? job.instancia_ids : [];
  const instanciasQueJaFalharam = new Set<string>([
    ...bloqueadasRunAtual,
    ...Object.keys(falhasMap),
  ]);
  const todasFalharamSemSucesso =
    !ok &&
    (job.enviados || 0) === 0 &&
    todasInstancias.length > 0 &&
    todasInstancias.every((id) => instanciasQueJaFalharam.has(id));

  if (todasFalharamSemSucesso) {
    // Marca este item como erro definitivo e persiste contadores antes de encerrar
    await supabase.from('envio_meta_job_item').update({
      status: 'erro',
      erro: erroMsg,
      processado_em: new Date().toISOString(),
      tentativas: tentativasAtual + 1,
    }).eq('id', pend.id);
    await supabase.from('envio_meta_job').update({
      falhas_por_instancia_run: falhasMap,
      instancias_bloqueadas_run: bloqueadasRunAtual,
    }).eq('id', job.id);
    await encerrarJobSemDisponibilidade(
      job,
      'Nenhuma instância conseguiu enviar — todas falharam pelo menos uma vez sem nenhum sucesso',
    );
    return { advanced: false, stop: true };
  }

  // Retry por item: em QUALQUER falha, se ainda houver outra instância
  // disponível e não estourou o teto, devolve pra fila pra outra instância tentar
  const proximasTentativas = tentativasAtual + (ok ? 0 : 1);
  const podeReenfileirar = !ok && proximasTentativas < MAX_TENTATIVAS_ITEM && restantesDisponiveis.length > 0;


  if (podeReenfileirar) {
    await supabase.from('envio_meta_job_item').update({
      status: 'pendente',
      instancia_id: null,
      instancia_nome: null,
      erro: erroMsg,
      tentativas: proximasTentativas,
    }).eq('id', pend.id);
  } else {
    await supabase.from('envio_meta_job_item').update({
      status: ok ? 'enviado' : 'erro',
      erro: ok ? null : erroMsg,
      processado_em: new Date().toISOString(),
      tentativas: proximasTentativas,
      wa_message_id: ok ? waIdOk : (pend as any).wa_message_id ?? null,
    }).eq('id', pend.id);
  }

  const lo = Math.max(1, job.min_seg || 30);
  const hi = Math.max(lo, job.max_seg || 90);
  const delaySec = Math.floor(Math.random() * (hi - lo + 1)) + lo;
  const delayMs = delaySec * 1000;
  const proximoEm = new Date(Date.now() + delayMs).toISOString();

  // Persiste os contadores/bloqueios de instâncias no job
  const updateJob: Record<string, unknown> = {
    falhas_por_instancia_run: falhasMap,
    instancias_bloqueadas_run: bloqueadasRunAtual,
  };
  if (ok) updateJob.ultima_instancia_id = instId;
  await supabase.from('envio_meta_job').update(updateJob).eq('id', job.id);

  // Se todas as instâncias foram bloqueadas → encerra o job
  if (restantesDisponiveis.length === 0 && bloqueadasRunAtual.length > 0) {
    await encerrarJobSemDisponibilidade(job, 'Todas as instâncias selecionadas foram ignoradas por falhas consecutivas');
    return { advanced: false, stop: true };
  }

  const contarErro = !ok && !podeReenfileirar;
  const { error: rpcErr } = await supabase.rpc('envio_meta_job_bump', {
    _job_id: job.id,
    _enviados_inc: ok ? 1 : 0,
    _erros_inc: contarErro ? 1 : 0,
    _proximo_em: proximoEm,
  });
  if (rpcErr) {
    await supabase.from('envio_meta_job').update({
      enviados: (job.enviados || 0) + (ok ? 1 : 0),
      erros: (job.erros || 0) + (contarErro ? 1 : 0),
      proximo_em: proximoEm,
      status_motivo: null,
    }).eq('id', job.id);
  }

  return { advanced: true, delayMs };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    let body: any = {};
    try { body = await req.json(); } catch {}
    const jobId: string | undefined = body?.job_id;
    let processadosTotal = 0;
    let claimedTotal = 0;
    const maxClaims = jobId ? 1 : 10;

    for (let i = 0; i < maxClaims; i++) {
      const { data: claimed, error: claimError } = await supabase.rpc('envio_meta_claim_due_job', {
        _job_id: jobId || null,
        _lock_seconds: 45,
      });
      if (claimError) throw claimError;
      if (!claimed?.id) break;
      claimedTotal++;

      try {
        const result = await processarItem(claimed);
        if (result.advanced) processadosTotal++;

        // Delay curto (ex.: 10–15s) é menor que a granularidade do agendador
        // (10s), o que arredondava o ritmo real para ~20s. Neste caso a própria
        // execução aguarda o delay exato e envia o próximo item, respeitando ao
        // milissegundo o intervalo configurado pelo usuário.
        if (result.advanced) {
          const inicioLoop = Date.now();
          let delayMs = result.delayMs;
          while (delayMs > 0 && delayMs <= DELAY_CURTO_MS && Date.now() - inicioLoop + delayMs < ORCAMENTO_MS) {
            await sleep(delayMs);

            // Renova a trava para que outro tick não roube a campanha no meio do laço.
            const { data: renovado } = await supabase
              .from('envio_meta_job')
              .update({ worker_locked_until: new Date(Date.now() + 45_000).toISOString() })
              .eq('id', claimed.id)
              .eq('worker_lock_token', claimed.worker_lock_token)
              .eq('status', 'rodando')
              .select('*')
              .maybeSingle();
            if (!renovado) break; // pausado, cancelado, concluído ou trava perdida

            const proximo = await processarItem({ ...renovado, worker_lock_token: claimed.worker_lock_token });
            if (!proximo.advanced) break;
            processadosTotal++;
            delayMs = proximo.delayMs;
          }
        }
      } catch (e) {
        console.error('[tick job]', claimed.id, e);
      } finally {
        // Libera somente a trava adquirida por esta execução. Se a função cair,
        // o TTL da trava permite recuperação automática pelo próximo tick.
        await supabase
          .from('envio_meta_job')
          .update({ worker_lock_token: null, worker_locked_until: null })
          .eq('id', claimed.id)
          .eq('worker_lock_token', claimed.worker_lock_token);
      }

      if (jobId) break;
    }

    return new Response(JSON.stringify({ success: true, jobs: claimedTotal, processados: processadosTotal }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[envio-meta-massa-tick]', e);
    return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : 'erro' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

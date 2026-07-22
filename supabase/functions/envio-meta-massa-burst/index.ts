// Modo RAJADA CONTROLADA: um worker POR INSTÂNCIA, dispara N msgs/segundo
// (job.msgs_por_segundo, padrão 1) para respeitar o rate limit da Meta.
// - Rate limit (#80007/#131056/429/502 "Rate limit"): devolve o item para 'pendente',
//   pausa a instância pelo tempo Retry-After e re-agenda o worker.
// - Erros transitórios (502/503/504 sem rate limit): devolve item para 'pendente'
//   com contador de tentativas até 3.
// - Erros permanentes: marca como 'erro' (o usuário pode reenviar em lote).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const MAX_WALL_MS = 50_000;         // deixa margem antes do timeout de 60s
const BATCH_PICK = 10;
const MAX_TENTATIVAS_TRANSIENTE = 3;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function jobEstaRodando(jobId: string) {
  const { data } = await supabase
    .from('envio_meta_job')
    .select('status')
    .eq('id', jobId)
    .maybeSingle();
  return data?.status === 'rodando';
}

async function selfInvoke(jobId: string, instanciaId: string, delayMs = 0) {
  if (!(await jobEstaRodando(jobId))) return;
  if (delayMs > 0) await sleep(Math.min(delayMs, 2000)); // pequeno debounce
  if (!(await jobEstaRodando(jobId))) return;
  await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/envio-meta-massa-burst`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
    },
    body: JSON.stringify({ job_id: jobId, instancia_id: instanciaId }),
  }).catch(() => {});
}

async function notificarConclusao(jobId: string) {
  try {
    const { data: job } = await supabase.from('envio_meta_job').select('*').eq('id', jobId).maybeSingle();
    if (!job) return;
    const total = job.total || 0;
    const enviados = job.enviados || 0;
    const erros = job.erros || 0;
    const template = job.template_nome || '—';
    const inicio = new Date(job.iniciado_em).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const fim = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const msg =
      `⚡ *Envio RAJADA concluído*\n\n` +
      `📄 Template: *${template}*\n` +
      `📊 Total: ${total}\n` +
      `✅ Enviados: ${enviados}\n` +
      `❌ Falharam: ${erros}\n` +
      `🕐 Início: ${inicio}\n` +
      `🕐 Fim: ${fim}`;
    const { notificarAdmin } = await import('../_shared/notificar-admin.ts');
    await notificarAdmin(supabase, {
      tipo: 'envio_meta_concluido',
      mensagem: msg,
      chaveIdempotencia: `envio_meta_burst_${jobId}`,
    });
  } catch (e) {
    console.error('[burst] notificarConclusao falhou:', String(e).slice(0, 300));
  }
}

async function tentarEncerrarJob(jobId: string) {
  const { count } = await supabase
    .from('envio_meta_job_item')
    .select('id', { count: 'exact', head: true })
    .eq('job_id', jobId)
    .in('status', ['pendente', 'processando']);
  if ((count ?? 0) > 0) return false;

  const { data: transitioned } = await supabase
    .from('envio_meta_job')
    .update({
      status: 'concluido',
      concluido_em: new Date().toISOString(),
      atual_telefone: null,
      atual_instancia: null,
      proximo_em: null,
    })
    .eq('id', jobId)
    .eq('status', 'rodando')
    .select('id')
    .maybeSingle();
  if (transitioned) await notificarConclusao(jobId);
  return true;
}

type SendResult =
  | { id: string; kind: 'ok'; waId: string | null }
  | { id: string; kind: 'rate_limit'; retryMs: number; erro: string }
  | { id: string; kind: 'transient'; retryMs: number; erro: string }
  | { id: string; kind: 'restricted'; erro: string }
  | { id: string; kind: 'template_paused'; erro: string }
  | { id: string; kind: 'error'; erro: string };

async function enviarUm(item: any, job: any): Promise<SendResult> {
  const tplId = (job.template_id_by_instance || {})[item.instancia_id] || job.template_id;
  const cliente = {
    telefone: item.telefone,
    nome: item.nome,
    cpf: item.cpf,
    atraso: item.atraso,
    saldo: item.saldo,
    vars: item.vars || {},
  };
  try {
    const resp = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-whatsapp-meta`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({
        template_id: tplId,
        instancia_id: item.instancia_id,
        cliente,
        user_id: job.user_id,
        ignorar_pausa_qualidade: true,
      }),
    }).then((r) => r.json());

    if (resp?.success) return { id: item.id, kind: 'ok', waId: resp?.waId ?? null };
    if (resp?.rate_limited) {
      return { id: item.id, kind: 'rate_limit', retryMs: Number(resp?.retry_after_ms) || 30_000, erro: resp?.error || 'rate limit' };
    }
    if (resp?.transient) {
      return { id: item.id, kind: 'transient', retryMs: Number(resp?.retry_after_ms) || 5_000, erro: resp?.error || 'transitório' };
    }
    if (resp?.template_paused) {
      return { id: item.id, kind: 'template_paused', erro: resp?.error || 'Template pausado pela Meta' };
    }
    if (resp?.instance_restricted) {
      return { id: item.id, kind: 'restricted', erro: resp?.error || 'instância restringida' };
    }
    // Fallback: detecta template pausado (#132015) mesmo quando o send-whatsapp-meta
    // ainda não retornou a flag template_paused (versão antiga em cache do runtime).
    const rawErr = String(resp?.error || '');
    const isPausedFallback =
      rawErr.includes('#132015') ||
      /template is (?:temporarily )?unavailable|is paused|paused due to low quality/i.test(rawErr);
    if (isPausedFallback) {
      return { id: item.id, kind: 'template_paused', erro: 'O template está pausado pela Meta. Escolha outro template ou aguarde a liberação.' };
    }
    return { id: item.id, kind: 'error', erro: resp?.error || 'falha' };

  } catch (e) {
    return { id: item.id, kind: 'transient', retryMs: 3_000, erro: e instanceof Error ? e.message : String(e) };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const inicio = Date.now();
    const body = await req.json();
    const jobId: string = body?.job_id;
    const instanciaId: string = body?.instancia_id;
    if (!jobId || !instanciaId) {
      return new Response(JSON.stringify({ success: false, error: 'job_id/instancia_id obrigatórios' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: job } = await supabase.from('envio_meta_job').select('*').eq('id', jobId).maybeSingle();
    if (!job) {
      return new Response(JSON.stringify({ success: false, error: 'job não encontrado' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (job.status !== 'rodando' || job.modo_rajada !== true) {
      return new Response(JSON.stringify({ success: false, error: 'job não é rajada em execução' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verifica se a instância está pausada por rate limit (definido pelo send-whatsapp-meta)
    const { data: inst } = await supabase
      .from('meta_whatsapp_instances')
      .select('id, rate_limit_ate, estado_pool, pausa_automatica_ate, pausa_automatica_motivo')
      .eq('id', instanciaId)
      .maybeSingle();
    const agora = Date.now();
    if (inst?.rate_limit_ate && new Date(inst.rate_limit_ate).getTime() > agora) {
      const espera = new Date(inst.rate_limit_ate).getTime() - agora;
      await selfInvoke(jobId, instanciaId, Math.min(espera, 2000));
      return new Response(JSON.stringify({ success: true, aguardando_rate_limit: true, ms: espera }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    // No modo RAJADA, IGNORAMOS pausas por qualidade (quality=YELLOW/RED). Só encerramos
    // o worker quando a Meta de fato restringir/banir a instância (motivo status=...).
    const motivoPausa = String(inst?.pausa_automatica_motivo || '').toLowerCase();
    const pausaPorStatus = motivoPausa.startsWith('status=');
    const baLocked = /business account|#131031|locked/.test(motivoPausa);
    const restrita = inst?.estado_pool === 'restrita';
    const pausaAtiva = !!inst?.pausa_automatica_ate && new Date(inst.pausa_automatica_ate).getTime() > agora;
    if (restrita || baLocked || (pausaAtiva && pausaPorStatus)) {
      // Instância bloqueada pela Meta (banimento/lock da BA). Marca os pendentes desta
      // instância como erro, adiciona à lista de bloqueadas do job e, se todas as
      // instâncias caíram, encerra o job com motivo claro.
      const motivoLegivel = baLocked
        ? 'Business Account bloqueada pela Meta (#131031). Verifique o Business Manager.'
        : `Instância indisponível pela Meta (${inst?.pausa_automatica_motivo || inst?.estado_pool || 'restrita'}).`;

      const bloqueadasAtuais: string[] = Array.isArray(job.instancias_bloqueadas) ? job.instancias_bloqueadas : [];
      const bloqueadas = Array.from(new Set([...bloqueadasAtuais, instanciaId]));
      await supabase.from('envio_meta_job').update({ instancias_bloqueadas: bloqueadas }).eq('id', jobId);

      const { data: pendDesta } = await supabase
        .from('envio_meta_job_item')
        .select('id')
        .eq('job_id', jobId)
        .eq('instancia_id', instanciaId)
        .eq('status', 'pendente');
      const idsPend = (pendDesta || []).map((r: any) => r.id);
      if (idsPend.length > 0) {
        const CHUNK = 500;
        for (let i = 0; i < idsPend.length; i += CHUNK) {
          await supabase.from('envio_meta_job_item').update({
            status: 'erro', erro: motivoLegivel, processado_em: new Date().toISOString(),
          }).in('id', idsPend.slice(i, i + CHUNK));
        }
        try {
          const { data: cur } = await supabase.from('envio_meta_job').select('erros').eq('id', jobId).maybeSingle();
          await supabase.from('envio_meta_job').update({ erros: (cur?.erros || 0) + idsPend.length }).eq('id', jobId);
        } catch { /* ignore */ }
      }

      const todas: string[] = Array.isArray(job.instancia_ids) ? job.instancia_ids : [];
      const restantesAtivas = todas.filter((x) => !bloqueadas.includes(x));
      if (restantesAtivas.length === 0) {
        await supabase.from('envio_meta_job').update({
          status: 'erro',
          status_motivo: motivoLegivel,
          concluido_em: new Date().toISOString(),
          atual_telefone: null,
          atual_instancia: null,
          proximo_em: null,
        }).eq('id', jobId);
        try {
          const { notificarAdmin } = await import('../_shared/notificar-admin.ts');
          await notificarAdmin(supabase, {
            tipo: 'envio_meta_ba_locked',
            mensagem: `⛔ Campanha encerrada — todas as instâncias bloqueadas pela Meta.\n\nJob: ${job.template_nome || jobId}\nMotivo: ${motivoLegivel}`,
            chaveIdempotencia: `envio_meta_bloqueado_${jobId}`,
          });
        } catch (_) { /* ignore */ }
      }

      return new Response(JSON.stringify({ success: true, instancia_pausada: true, motivo: motivoPausa, ba_locked: baLocked, marcados_erro: idsPend.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const msgsPorSegundo = Math.max(1, Math.min(5, Number(job.msgs_por_segundo) || 1));
    const intervaloMs = Math.floor(1000 / msgsPorSegundo);

    let processadosNesteWorker = 0;
    let paradaPorRateLimit = false;
    let esperaRateLimitMs = 0;
    let atingiuTempo = false;
    let templatePausado = false;
    let templatePausadoErro = '';

    while (Date.now() - inicio < MAX_WALL_MS && !paradaPorRateLimit && !templatePausado) {
      if (!(await jobEstaRodando(jobId))) {
        await supabase.from('envio_meta_job_item')
          .update({ status: 'pendente' })
          .eq('job_id', jobId)
          .eq('instancia_id', instanciaId)
          .eq('status', 'processando');
        return new Response(JSON.stringify({ success: true, cancelado: true, processados: processadosNesteWorker }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: pendentes } = await supabase
        .from('envio_meta_job_item')
        .select('id, telefone, nome, cpf, atraso, saldo, vars, instancia_id, tentativas')
        .eq('job_id', jobId)
        .eq('instancia_id', instanciaId)
        .eq('status', 'pendente')
        .order('ordem', { ascending: true })
        .limit(BATCH_PICK);

      if (!pendentes || pendentes.length === 0) break;

      const ids = pendentes.map((p: any) => p.id);
      const { data: reservados } = await supabase
        .from('envio_meta_job_item')
        .update({ status: 'processando' })
        .in('id', ids)
        .eq('status', 'pendente')
        .select('id');
      const reservadosSet = new Set((reservados || []).map((r: any) => r.id));
      const paraEnviar = pendentes.filter((p: any) => reservadosSet.has(p.id));
      if (paraEnviar.length === 0) continue;

      let okCount = 0;
      let errCount = 0;

      for (const it of paraEnviar) {
        if (!(await jobEstaRodando(jobId))) {
          await supabase.from('envio_meta_job_item')
            .update({ status: 'pendente' })
            .eq('job_id', jobId)
            .eq('instancia_id', instanciaId)
            .eq('status', 'processando');
          break;
        }

        if (Date.now() - inicio >= MAX_WALL_MS) {
          // Devolve o restante para pendente
          await supabase.from('envio_meta_job_item')
            .update({ status: 'pendente' })
            .eq('job_id', jobId)
            .eq('instancia_id', instanciaId)
            .eq('status', 'processando');
          atingiuTempo = true;
          break;
        }

        const t0 = Date.now();
        const r = await enviarUm(it, job);
        const nowIso = new Date().toISOString();

        if (r.kind === 'ok') {
          await supabase.from('envio_meta_job_item').update({
            status: 'enviado', erro: null, processado_em: nowIso, wa_message_id: r.waId,
          }).eq('id', it.id);
          okCount++;
        } else if (r.kind === 'rate_limit') {
          // Devolve o item, pausa este worker, agenda re-execução
          await supabase.from('envio_meta_job_item').update({
            status: 'pendente', erro: `rate limit: ${r.erro}`,
          }).eq('id', it.id);
          paradaPorRateLimit = true;
          esperaRateLimitMs = r.retryMs;
          break;
        } else if (r.kind === 'transient') {
          const tent = (it.tentativas || 0) + 1;
          if (tent >= MAX_TENTATIVAS_TRANSIENTE) {
            await supabase.from('envio_meta_job_item').update({
              status: 'erro', erro: r.erro, processado_em: nowIso, tentativas: tent,
            }).eq('id', it.id);
            errCount++;
          } else {
            await supabase.from('envio_meta_job_item').update({
              status: 'pendente', tentativas: tent, erro: r.erro,
            }).eq('id', it.id);
          }
        } else if (r.kind === 'restricted') {
          // Instância restringida — devolve o item e sai
          await supabase.from('envio_meta_job_item').update({
            status: 'pendente', erro: r.erro,
          }).eq('id', it.id);
          paradaPorRateLimit = true; // encerra este worker
          esperaRateLimitMs = 60_000;
          break;
        } else if (r.kind === 'template_paused') {
          // Template pausado pela Meta nesta instância — desativa este worker
          // e redistribui os pendentes para outras instâncias ativas do job.
          await supabase.from('envio_meta_job_item').update({
            status: 'pendente', erro: r.erro,
          }).eq('id', it.id);
          templatePausado = true;
          templatePausadoErro = r.erro;
          break;
        } else {
          await supabase.from('envio_meta_job_item').update({
            status: 'erro', erro: r.erro, processado_em: nowIso,
          }).eq('id', it.id);
          errCount++;
        }

        processadosNesteWorker++;

        // Throttle: garante N msgs/segundo (aguarda o restante do intervalo)
        const gasto = Date.now() - t0;
        if (intervaloMs > gasto) {
          await sleep(intervaloMs - gasto);
          if (!(await jobEstaRodando(jobId))) break;
        }
      }

      if (paradaPorRateLimit || atingiuTempo || templatePausado || !(await jobEstaRodando(jobId))) {
        await supabase.from('envio_meta_job_item')
          .update({ status: 'pendente' })
          .eq('job_id', jobId)
          .eq('instancia_id', instanciaId)
          .eq('status', 'processando');
      }

      if (okCount > 0 || errCount > 0) {
        await supabase.rpc('envio_meta_job_bump', {
          _job_id: jobId,
          _enviados_inc: okCount,
          _erros_inc: errCount,
          _proximo_em: new Date().toISOString(),
        }).then(() => {}).catch(async () => {
          const { data: cur } = await supabase.from('envio_meta_job').select('enviados, erros').eq('id', jobId).maybeSingle();
          await supabase.from('envio_meta_job').update({
            enviados: (cur?.enviados || 0) + okCount,
            erros: (cur?.erros || 0) + errCount,
          }).eq('id', jobId);
        });
      }

      if (atingiuTempo) break;
    }

    // ===== Template pausado: desativa esta instância no job e redistribui =====
    if (templatePausado) {
      // Marca a instância como bloqueada neste job
      const bloqueadasAtuais: string[] = Array.isArray(job.instancias_bloqueadas) ? job.instancias_bloqueadas : [];
      const bloqueadas = Array.from(new Set([...bloqueadasAtuais, instanciaId]));
      await supabase.from('envio_meta_job').update({ instancias_bloqueadas: bloqueadas }).eq('id', jobId);

      // Notifica admin (idempotente por job+instância)
      try {
        const { notificarAdmin } = await import('../_shared/notificar-admin.ts');
        await notificarAdmin(supabase, {
          tipo: 'meta_template_pausado',
          mensagem:
            `⚠️ Instância desativada por template pausado\n\n` +
            `Job: ${job.nome || jobId}\n` +
            `Instância: ${instanciaId}\n` +
            `Motivo: ${templatePausadoErro}\n\n` +
            `Os contatos pendentes serão redistribuídos entre as instâncias ativas.`,
          chaveIdempotencia: `template_pausado_${jobId}_${instanciaId}`,
        });
      } catch (_) { /* ignore */ }

      // Lista instâncias ainda ativas no job
      const todas: string[] = Array.isArray(job.instancia_ids) ? job.instancia_ids : [];
      const ativas = todas.filter((x) => !bloqueadas.includes(x));

      // Recupera itens já marcados como 'erro' por causa do #132015 antes desta correção
      // (devolve para 'pendente' para serem redistribuídos).
      await supabase.from('envio_meta_job_item')
        .update({ status: 'pendente', erro: null, processado_em: null })
        .eq('job_id', jobId)
        .eq('instancia_id', instanciaId)
        .eq('status', 'erro')
        .or('erro.ilike.%132015%,erro.ilike.%is paused%,erro.ilike.%paused due to low quality%');

      // Ajusta contador do job removendo esses erros recuperados
      try {
        const { count: recuperados } = await supabase
          .from('envio_meta_job_item')
          .select('id', { count: 'exact', head: true })
          .eq('job_id', jobId)
          .eq('instancia_id', instanciaId)
          .eq('status', 'pendente')
          .is('erro', null);
        if ((recuperados ?? 0) > 0) {
          const { data: cur } = await supabase.from('envio_meta_job').select('erros').eq('id', jobId).maybeSingle();
          const novoErros = Math.max(0, (cur?.erros || 0) - 0); // não subtrai — evita descontar mais do que registramos
          await supabase.from('envio_meta_job').update({ erros: novoErros }).eq('id', jobId);
        }
      } catch { /* ignora */ }

      // Pega os pendentes desta instância para reatribuir
      const { data: pendentesRest } = await supabase
        .from('envio_meta_job_item')
        .select('id')
        .eq('job_id', jobId)
        .eq('instancia_id', instanciaId)
        .eq('status', 'pendente')
        .order('ordem', { ascending: true });

      const idsRest = (pendentesRest || []).map((r: any) => r.id);


      if (ativas.length === 0) {
        // Todas as instâncias caíram — marca como erro e encerra o job
        if (idsRest.length > 0) {
          const CHUNK = 500;
          for (let i = 0; i < idsRest.length; i += CHUNK) {
            const slice = idsRest.slice(i, i + CHUNK);
            await supabase.from('envio_meta_job_item').update({
              status: 'erro',
              erro: 'Todas as instâncias com template pausado pela Meta.',
              processado_em: new Date().toISOString(),
            }).in('id', slice);
          }
          try {
            const { data: cur } = await supabase.from('envio_meta_job').select('erros').eq('id', jobId).maybeSingle();
            await supabase.from('envio_meta_job').update({
              erros: (cur?.erros || 0) + idsRest.length,
            }).eq('id', jobId);
          } catch { /* ignore */ }
        }
        await tentarEncerrarJob(jobId);
        return new Response(JSON.stringify({
          success: true,
          template_pausado: true,
          todas_bloqueadas: true,
          restantes_marcados_erro: idsRest.length,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Redistribui round-robin entre as ativas
      const grupos: Record<string, string[]> = {};
      for (const inst of ativas) grupos[inst] = [];
      for (let i = 0; i < idsRest.length; i++) {
        const target = ativas[i % ativas.length];
        grupos[target].push(idsRest[i]);
      }
      for (const [target, itemIds] of Object.entries(grupos)) {
        if (itemIds.length > 0) {
          const CHUNK = 500;
          for (let i = 0; i < itemIds.length; i += CHUNK) {
            await supabase.from('envio_meta_job_item').update({ instancia_id: target })
              .in('id', itemIds.slice(i, i + CHUNK));
          }
        }
      }
      // Garante que TODAS as instâncias ativas estão com worker rodando
      // (mesmo as que já haviam encerrado o próprio loop por falta de trabalho).
      for (const inst of ativas) {
        await selfInvoke(jobId, inst, 0);
      }


      return new Response(JSON.stringify({
        success: true,
        template_pausado: true,
        instancia_desativada: instanciaId,
        redistribuidos: idsRest.length,
        ativas_restantes: ativas,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }


    // Se ainda há pendentes, encadeia self-invoke (respeitando rate limit se houver)
    const { count: restantes } = await supabase
      .from('envio_meta_job_item')
      .select('id', { count: 'exact', head: true })
      .eq('job_id', jobId)
      .eq('instancia_id', instanciaId)
      .eq('status', 'pendente');

    if ((restantes ?? 0) > 0) {
      if (!(await jobEstaRodando(jobId))) {
        return new Response(JSON.stringify({ success: true, cancelado: true, processados: processadosNesteWorker, restantes }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      // Se parou por rate limit, aguarda o tempo indicado antes de reagendar
      const espera = paradaPorRateLimit ? Math.min(esperaRateLimitMs, 60_000) : 0;
      await selfInvoke(jobId, instanciaId, espera);
      return new Response(JSON.stringify({
        success: true,
        processados: processadosNesteWorker,
        restantes,
        continua: true,
        rate_limited: paradaPorRateLimit,
        aguardando_ms: espera,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Antes de tentar encerrar: se ainda existem itens 'processando' desta instância (janela de corrida
    // com outro worker), reagende curto ao invés de finalizar. Evita marcar concluido/erro cedo demais.
    const { count: processando } = await supabase
      .from('envio_meta_job_item')
      .select('id', { count: 'exact', head: true })
      .eq('job_id', jobId)
      .eq('instancia_id', instanciaId)
      .eq('status', 'processando');
    if ((processando ?? 0) > 0) {
      if (await jobEstaRodando(jobId)) await selfInvoke(jobId, instanciaId, 2000);
      return new Response(JSON.stringify({ success: true, processados: processadosNesteWorker, restantes: 0, aguardando_processando: processando }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await tentarEncerrarJob(jobId);
    return new Response(JSON.stringify({ success: true, processados: processadosNesteWorker, restantes: 0 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[envio-meta-massa-burst]', e);
    return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : 'erro' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

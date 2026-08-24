// Modo RAJADA CONTROLADA: um worker POR INSTÂNCIA, com teto definido em
// job.msgs_por_segundo. A taxa real é adaptativa e persistida por instância.
// - Rate limit (#80007/#131056/429/502 "Rate limit"): devolve o item para
//   'pendente' sem contar como erro final, derruba a instância para 1 msg/s,
//   respeita o Retry-After da Meta e re-agenda o worker automaticamente.
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
const MAX_MPS_HARD_CAP = 60;        // teto absoluto por instância
const MAX_TENTATIVAS_TRANSIENTE = 3;
const MIN_MPS_APOS_RATE_LIMIT = 1;
const JANELAS_OK_PARA_RAMPUP = 10;

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
  // O bloqueio real fica em rate_limit_ate; aqui dormimos curto para não estourar timeout.
  if (delayMs > 0) await sleep(Math.min(delayMs, 10_000));
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

// Desativa uma instância dentro do job, recupera erros compatíveis com o
// motivo do bloqueio e redistribui os pendentes órfãos (round-robin) entre
// as instâncias ainda ativas. Se todas caírem, marca o restante como erro
// final e encerra o job. Usado tanto para #132015 (template pausado) quanto
// para BANNED/FLAGGED/RESTRICTED/#131031 (instância indisponível).
async function desativarInstanciaERedistribuir(
  jobId: string,
  instanciaId: string,
  motivo: string,
  tipoNotif: string,
  recuperarErrosLike: string[],
): Promise<{ ativas_restantes: string[]; redistribuidos: number; todas_bloqueadas: boolean; recuperados: number }> {
  const { data: job } = await supabase.from('envio_meta_job').select('*').eq('id', jobId).maybeSingle();
  if (!job) return { ativas_restantes: [], redistribuidos: 0, todas_bloqueadas: false, recuperados: 0 };

  const bloqueadasAtuais: string[] = Array.isArray(job.instancias_bloqueadas) ? job.instancias_bloqueadas : [];
  const bloqueadas = Array.from(new Set([...bloqueadasAtuais, instanciaId]));
  await supabase.from('envio_meta_job').update({ instancias_bloqueadas: bloqueadas }).eq('id', jobId);

  // Devolve itens em 'processando' desta instância para 'pendente'
  await supabase.from('envio_meta_job_item')
    .update({ status: 'pendente' })
    .eq('job_id', jobId).eq('instancia_id', instanciaId).eq('status', 'processando');

  // Recupera erros compatíveis com este bloqueio (voltam para pendente)
  let recuperados = 0;
  if (recuperarErrosLike.length > 0) {
    const orExpr = recuperarErrosLike.map((p) => `erro.ilike.${p}`).join(',');
    const { data: recovered } = await supabase
      .from('envio_meta_job_item')
      .update({ status: 'pendente', erro: null, tentativas: 0, processado_em: null })
      .eq('job_id', jobId).eq('instancia_id', instanciaId).eq('status', 'erro')
      .or(orExpr)
      .select('id');
    recuperados = recovered?.length ?? 0;
    if (recuperados > 0) {
      const { data: cur } = await supabase.from('envio_meta_job').select('erros').eq('id', jobId).maybeSingle();
      await supabase.from('envio_meta_job').update({
        erros: Math.max(0, (cur?.erros || 0) - recuperados),
      }).eq('id', jobId);
    }
  }

  // Coleta pendentes desta instância (agora inclui os recuperados)
  const { data: pendentes } = await supabase
    .from('envio_meta_job_item')
    .select('id')
    .eq('job_id', jobId).eq('instancia_id', instanciaId).eq('status', 'pendente')
    .order('ordem', { ascending: true });
  const idsPend = (pendentes || []).map((r: any) => r.id);

  const todas: string[] = Array.isArray(job.instancia_ids) ? job.instancia_ids : [];
  const ativas = todas.filter((x) => !bloqueadas.includes(x));

  if (ativas.length === 0) {
    if (idsPend.length > 0) {
      const CHUNK = 500;
      for (let i = 0; i < idsPend.length; i += CHUNK) {
        await supabase.from('envio_meta_job_item').update({
          status: 'erro', erro: motivo, processado_em: new Date().toISOString(),
        }).in('id', idsPend.slice(i, i + CHUNK));
      }
      const { data: cur } = await supabase.from('envio_meta_job').select('erros').eq('id', jobId).maybeSingle();
      await supabase.from('envio_meta_job').update({
        erros: (cur?.erros || 0) + idsPend.length,
      }).eq('id', jobId);
    }
    try {
      const { notificarAdmin } = await import('../_shared/notificar-admin.ts');
      await notificarAdmin(supabase, {
        tipo: tipoNotif,
        mensagem: `⛔ Campanha encerrada — todas as instâncias bloqueadas pela Meta.\n\nJob: ${job.template_nome || jobId}\nMotivo: ${motivo}`,
        chaveIdempotencia: `envio_meta_bloqueado_${jobId}`,
      });
    } catch { /* ignore */ }
    await tentarEncerrarJob(jobId);
    return { ativas_restantes: [], redistribuidos: 0, todas_bloqueadas: true, recuperados };
  }

  // Round-robin dos pendentes órfãos entre as instâncias ativas
  const grupos: Record<string, string[]> = {};
  for (const inst of ativas) grupos[inst] = [];
  for (let i = 0; i < idsPend.length; i++) {
    grupos[ativas[i % ativas.length]].push(idsPend[i]);
  }
  for (const [target, itemIds] of Object.entries(grupos)) {
    if (itemIds.length === 0) continue;
    const CHUNK = 500;
    for (let i = 0; i < itemIds.length; i += CHUNK) {
      await supabase.from('envio_meta_job_item').update({ instancia_id: target })
        .in('id', itemIds.slice(i, i + CHUNK));
    }
  }

  try {
    const { notificarAdmin } = await import('../_shared/notificar-admin.ts');
    await notificarAdmin(supabase, {
      tipo: tipoNotif,
      mensagem:
        `⚠️ Instância desativada da campanha\n\n` +
        `Job: ${job.template_nome || jobId}\n` +
        `Motivo: ${motivo}\n` +
        `${idsPend.length} contato(s) redistribuído(s) entre ${ativas.length} instância(s) ativa(s).`,
      chaveIdempotencia: `envio_meta_desat_${jobId}_${instanciaId}`,
    });
  } catch { /* ignore */ }

  for (const inst of ativas) await selfInvoke(jobId, inst, 0);

  return { ativas_restantes: ativas, redistribuidos: idsPend.length, todas_bloqueadas: false, recuperados };
}


type SendResult =
  | { id: string; kind: 'ok'; waId: string | null }
  | { id: string; kind: 'rate_limit'; retryMs: number; erro: string }
  | { id: string; kind: 'transient'; retryMs: number; erro: string }
  | { id: string; kind: 'restricted'; erro: string }
  | { id: string; kind: 'template_paused'; erro: string }
  | { id: string; kind: 'error'; erro: string };

// Variação de templates: resolve o template_id da variante atribuída ao item,
// já aprovado na instância escolhida. Se a variante não existe nessa instância,
// cai para a próxima variante e, por fim, para o template principal do job.
function resolverTemplateId(job: any, instId: string, varianteIdx: number): string {
  const variantes = Array.isArray(job?.template_variantes) ? job.template_variantes : [];
  const n = variantes.length;
  if (n > 0) {
    const start = (((Number(varianteIdx) || 0) % n) + n) % n;
    for (let i = 0; i < n; i++) {
      const byInst = variantes[(start + i) % n]?.template_id_by_instance || {};
      if (byInst[instId]) return byInst[instId];
    }
  }
  return (job?.template_id_by_instance || {})[instId] || job?.template_id;
}

async function enviarUm(item: any, job: any): Promise<SendResult> {
  const tplId = resolverTemplateId(job, item.instancia_id, Number(item.variante_idx || 0));

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
        folder_id: job.folder_id ?? null,
        credor: item.credor ?? job.credor ?? null,
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
    if (resp?.instance_restricted || resp?.bm_quota_blocked) {
      return { id: item.id, kind: 'restricted', erro: resp?.error || 'instância restringida' };
    }
    // Fallback: detecta template pausado (#132015) mesmo quando o send-whatsapp-meta
    // ainda não retornou a flag template_paused (versão antiga em cache do runtime).
    const rawErr = String(resp?.error || '');
    // #131053 (Media upload error) é problema de mídia, não da instância → retry.
    if (rawErr.includes('#131053') || /media upload error/i.test(rawErr)) {
      return { id: item.id, kind: 'transient', retryMs: 4_000, erro: rawErr || 'Media upload error (#131053)' };
    }
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
      .select('id, rate_limit_ate, estado_pool, pausa_automatica_ate, pausa_automatica_motivo, rajada_taxa_atual, rajada_ultimo_ajuste_em')
      .eq('id', instanciaId)
      .maybeSingle();
    const agora = Date.now();
    if (inst?.rate_limit_ate && new Date(inst.rate_limit_ate).getTime() > agora) {
      const espera = new Date(inst.rate_limit_ate).getTime() - agora;
      // Espera residual > 60s é tratada como órfã (herança de campanha anterior):
      // limpa e segue enviando imediatamente.
      if (espera > 60_000) {
        await supabase.from('meta_whatsapp_instances')
          .update({ rate_limit_ate: null })
          .eq('id', instanciaId);
      } else {
        await supabase.from('envio_meta_job').update({
          proximo_em: new Date(Date.now() + espera).toISOString(),
          status_motivo: `RATE_LIMIT:${instanciaId}:${espera}:Meta pausou temporariamente esta instância por rate limit. Retomando automaticamente a 1 msg/s.`,
        }).eq('id', jobId).eq('status', 'rodando');
        await selfInvoke(jobId, instanciaId, espera);
        return new Response(JSON.stringify({ success: true, aguardando_rate_limit: true, ms: espera }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Recupera automaticamente rate limits legados que eventualmente tenham sido
    // gravados como erro final antes desta regra. Eles voltam para a fila e somem
    // da lista vermelha sem exigir clique manual.
    try {
      const { data: rateLimitErrors } = await supabase
        .from('envio_meta_job_item')
        .update({ status: 'pendente', erro: null, tentativas: 0, processado_em: null })
        .eq('job_id', jobId)
        .eq('instancia_id', instanciaId)
        .eq('status', 'erro')
        .or('erro.ilike.%rate limit%,erro.ilike.%Rate limit%,erro.ilike.%80007%,erro.ilike.%131056%')
        .select('id');
      const recuperados = rateLimitErrors?.length ?? 0;
      if (recuperados > 0) {
        const { data: cur } = await supabase.from('envio_meta_job').select('erros').eq('id', jobId).maybeSingle();
        await supabase.from('envio_meta_job').update({
          erros: Math.max(0, (cur?.erros || 0) - recuperados),
        }).eq('id', jobId);
      }
    } catch { /* não bloqueia o worker */ }
    // No modo RAJADA, IGNORAMOS pausas por qualidade (quality=YELLOW/RED). Só encerramos
    // o worker quando a Meta de fato restringir/banir a instância (motivo status=...).
    const motivoPausa = String(inst?.pausa_automatica_motivo || '').toLowerCase();
    const pausaPorStatus = motivoPausa.startsWith('status=');
    const baLocked = /business account|#131031|locked/.test(motivoPausa);
    const restrita = inst?.estado_pool === 'restrita';
    const pausaAtiva = !!inst?.pausa_automatica_ate && new Date(inst.pausa_automatica_ate).getTime() > agora;
    if (restrita || baLocked || (pausaAtiva && pausaPorStatus)) {
      const motivoLegivel = baLocked
        ? 'Business Account bloqueada pela Meta (#131031). Verifique o Business Manager.'
        : `Instância indisponível pela Meta (${inst?.pausa_automatica_motivo || inst?.estado_pool || 'restrita'}).`;

      const resultado = await desativarInstanciaERedistribuir(
        jobId,
        instanciaId,
        motivoLegivel,
        baLocked ? 'envio_meta_ba_locked' : 'meta_instancia_restrita',
        [
          '%status=BANNED%', '%status=FLAGGED%', '%status=RESTRICTED%',
          '%indispon%vel pela Meta%', '%#131031%',
          '%Business Account%', '%restringida%', '%restringido%',
        ],
      );

      return new Response(JSON.stringify({
        success: true,
        instancia_desativada: instanciaId,
        motivo: motivoPausa,
        ba_locked: baLocked,
        redistribuidos: resultado.redistribuidos,
        recuperados: resultado.recuperados,
        ativas_restantes: resultado.ativas_restantes,
        todas_bloqueadas: resultado.todas_bloqueadas,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Token-bucket ADAPTATIVO por instância.
    // - `mpsAlvo` (slider do usuário) é o TETO.
    // - A taxa real nunca reseta agressivamente para o teto só por estar abaixo dele.
    // - Rate limit derruba para 1 msg/s; ramp-up só ocorre após várias janelas OK.
    // - Também limpa rate_limit_ate órfão (passado > 5min).
    const mpsAlvo = Math.max(1, Math.min(MAX_MPS_HARD_CAP, Number(job.msgs_por_segundo) || 1));

    // Limpa rate_limit_ate órfão
    if (inst?.rate_limit_ate && new Date(inst.rate_limit_ate).getTime() < agora - 5 * 60_000) {
      await supabase.from('meta_whatsapp_instances')
        .update({ rate_limit_ate: null })
        .eq('id', instanciaId);
    }

    const taxaPersist = Number(inst?.rajada_taxa_atual) || 1;
    let janela = Math.max(MIN_MPS_APOS_RATE_LIMIT, Math.min(mpsAlvo, taxaPersist));
    let sucessosSeguidos = 0;

    const persistirTaxa = async (nova: number) => {
      const v = Math.max(1, Math.min(MAX_MPS_HARD_CAP, Math.floor(nova)));
      await supabase.from('meta_whatsapp_instances').update({
        rajada_taxa_atual: v,
        rajada_ultimo_ajuste_em: new Date().toISOString(),
      }).eq('id', instanciaId);
    };



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

      const janelaInicio = Date.now();
      const pickSize = Math.max(1, Math.min(MAX_MPS_HARD_CAP, janela));

      const { data: pendentes } = await supabase
        .from('envio_meta_job_item')
        .select('id, telefone, nome, cpf, atraso, saldo, vars, instancia_id, instancia_nome, tentativas, variante_idx, credor')
        .eq('job_id', jobId)
        .eq('instancia_id', instanciaId)
        .eq('status', 'pendente')
        .order('ordem', { ascending: true })
        .limit(pickSize);

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

      // DISPARO PARALELO — todos os N envios da janela ao mesmo tempo
      const resultados = await Promise.allSettled(paraEnviar.map((it: any) => enviarUm(it, job)));

      let okCount = 0;
      let errCount = 0;
      let rateLimitVisto = false;
      let rateLimitRetryMs = 0;
      let rateLimitTelefone = '';
      let rateLimitErro = '';
      let restrictedVisto = false;

      const nowIso = new Date().toISOString();

      for (let i = 0; i < paraEnviar.length; i++) {
        const it = paraEnviar[i];
        const settled = resultados[i];
        const r: SendResult = settled.status === 'fulfilled'
          ? settled.value
          : { id: it.id, kind: 'transient', retryMs: 3_000, erro: String((settled as PromiseRejectedResult).reason).slice(0, 300) };

        if (r.kind === 'ok') {
          await supabase.from('envio_meta_job_item').update({
            status: 'enviado', erro: null, processado_em: nowIso, wa_message_id: r.waId,
          }).eq('id', it.id);
          okCount++;
        } else if (r.kind === 'rate_limit') {
          await supabase.from('envio_meta_job_item').update({
            status: 'pendente', erro: null,
          }).eq('id', it.id);
          rateLimitVisto = true;
          rateLimitRetryMs = Math.max(rateLimitRetryMs, r.retryMs);
          rateLimitTelefone = it.telefone || rateLimitTelefone;
          rateLimitErro = r.erro || rateLimitErro;
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
          await supabase.from('envio_meta_job_item').update({
            status: 'pendente', erro: r.erro,
          }).eq('id', it.id);
          restrictedVisto = true;
        } else if (r.kind === 'template_paused') {
          await supabase.from('envio_meta_job_item').update({
            status: 'pendente', erro: r.erro,
          }).eq('id', it.id);
          templatePausado = true;
          templatePausadoErro = r.erro;
        } else {
          await supabase.from('envio_meta_job_item').update({
            status: 'erro', erro: r.erro, processado_em: nowIso,
          }).eq('id', it.id);
          errCount++;
        }
      }

      processadosNesteWorker += okCount + errCount;

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

      // Ajuste dinâmico da janela (AIMD tunado, persistido por instância)
      if (rateLimitVisto) {
        janela = MIN_MPS_APOS_RATE_LIMIT;
        sucessosSeguidos = 0;
        await persistirTaxa(janela);
        paradaPorRateLimit = true;
        esperaRateLimitMs = Math.min(Math.max(rateLimitRetryMs, 2_000), 5 * 60_000);
        const proximo = new Date(Date.now() + esperaRateLimitMs).toISOString();
        const instNome = paraEnviar.find((it: any) => it.telefone === rateLimitTelefone)?.instancia_nome || instanciaId;
        await supabase.from('envio_meta_job').update({
          atual_telefone: rateLimitTelefone || null,
          atual_instancia: instNome,
          proximo_em: proximo,
          status_motivo: `RATE_LIMIT:${instanciaId}:${esperaRateLimitMs}:Meta pausou temporariamente esta instância por rate limit. O contato voltou para a fila e a retomada será automática a 1 msg/s.${rateLimitErro ? ` Detalhe: ${String(rateLimitErro).slice(0, 180)}` : ''}`,
        }).eq('id', jobId).eq('status', 'rodando');
        break;
      }
      if (restrictedVisto) {
        paradaPorRateLimit = true;
        esperaRateLimitMs = 60_000;
        break;
      }
      if (templatePausado) break;

      if (errCount === 0 && okCount > 0) {
        if (String(job.status_motivo || '').startsWith(`RATE_LIMIT:${instanciaId}:`)) {
          await supabase.from('envio_meta_job').update({ status_motivo: null }).eq('id', jobId).eq('status', 'rodando');
        }
        // Ramp-up conservador: várias janelas OK antes de subir +1 até o teto.
        sucessosSeguidos++;
        if (sucessosSeguidos >= JANELAS_OK_PARA_RAMPUP && janela < mpsAlvo) {
          janela = Math.min(mpsAlvo, janela + 1);
          await persistirTaxa(janela);
          sucessosSeguidos = 0;
        }
      } else if (errCount > 0) {
        sucessosSeguidos = 0;
      }



      if (Date.now() - inicio >= MAX_WALL_MS) { atingiuTempo = true; break; }

      // Aguarda o restante da janela de 1s (throttle real)
      const gasto = Date.now() - janelaInicio;
      if (gasto < 1000) {
        await sleep(1000 - gasto);
        if (!(await jobEstaRodando(jobId))) break;
      }
    }

    // Devolve qualquer item ainda em 'processando' desta instância
    if (paradaPorRateLimit || atingiuTempo || templatePausado || !(await jobEstaRodando(jobId))) {
      await supabase.from('envio_meta_job_item')
        .update({ status: 'pendente' })
        .eq('job_id', jobId)
        .eq('instancia_id', instanciaId)
        .eq('status', 'processando');
    }


    // ===== Template pausado: desativa esta instância no job e redistribui =====
    if (templatePausado) {
      const resultado = await desativarInstanciaERedistribuir(
        jobId,
        instanciaId,
        templatePausadoErro || 'Template pausado pela Meta (#132015).',
        'meta_template_pausado',
        ['%132015%', '%is paused%', '%paused due to low quality%', '%template%pausad%'],
      );
      return new Response(JSON.stringify({
        success: true,
        template_pausado: true,
        instancia_desativada: instanciaId,
        redistribuidos: resultado.redistribuidos,
        recuperados: resultado.recuperados,
        ativas_restantes: resultado.ativas_restantes,
        todas_bloqueadas: resultado.todas_bloqueadas,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ===== Instância restringida/banida detectada durante o loop =====
    // (send-whatsapp-meta retornou instance_restricted=true — normalmente porque
    // o pool marcou a instância como 'restrita' após BANNED/FLAGGED). Redistribui
    // imediatamente, sem esperar a próxima invocação.
    if (restrictedVisto) {
      // Recarrega inst para pegar motivo atualizado
      const { data: instAtual } = await supabase
        .from('meta_whatsapp_instances')
        .select('estado_pool, pausa_automatica_motivo')
        .eq('id', instanciaId)
        .maybeSingle();
      const motivo = instAtual?.pausa_automatica_motivo || instAtual?.estado_pool || 'restrita';
      const motivoLegivel = `Instância indisponível pela Meta (${motivo}).`;
      const resultado = await desativarInstanciaERedistribuir(
        jobId,
        instanciaId,
        motivoLegivel,
        'meta_instancia_restrita',
        [
          '%status=BANNED%', '%status=FLAGGED%', '%status=RESTRICTED%',
          '%indispon%vel pela Meta%', '%#131031%',
          '%Business Account%', '%restringida%', '%restringido%',
        ],
      );
      return new Response(JSON.stringify({
        success: true,
        instancia_desativada: instanciaId,
        redistribuidos: resultado.redistribuidos,
        recuperados: resultado.recuperados,
        ativas_restantes: resultado.ativas_restantes,
        todas_bloqueadas: resultado.todas_bloqueadas,
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

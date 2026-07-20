// Modo RAJADA: envia em paralelo (Promise.all em lotes) sem delay entre msgs.
// Um worker POR INSTÂNCIA. Cada worker processa apenas os itens pré-atribuídos
// à sua instância (envio_meta_job_item.instancia_id = <inst>).
// Alto risco de ban — só para envios pontuais com números descartáveis.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const MAX_WALL_MS = 50_000;      // deixa margem antes do timeout de 60s
const CONCURRENCY = 50;          // envios simultâneos por instância
const BATCH_PICK = 200;          // itens buscados por vez do banco

async function selfInvoke(jobId: string, instanciaId: string) {
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
    const { data: job } = await supabase
      .from('envio_meta_job')
      .select('*')
      .eq('id', jobId)
      .maybeSingle();
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
  // Só encerra quando NÃO houver mais itens pendentes/processando em NENHUMA instância.
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
  if (transitioned) {
    await notificarConclusao(jobId);
  }
  return true;
}

async function processarUmItem(item: any, job: any) {
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
      }),
    }).then((r) => r.json());

    if (resp?.success) {
      return { id: item.id, ok: true, waId: resp?.waId ?? null, erro: null as string | null };
    }
    return { id: item.id, ok: false, waId: null, erro: resp?.error || 'falha' };
  } catch (e) {
    return { id: item.id, ok: false, waId: null, erro: e instanceof Error ? e.message : String(e) };
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

    let processadosNesteWorker = 0;

    while (Date.now() - inicio < MAX_WALL_MS) {
      // Reserva um lote de pendentes desta instância transicionando para 'processando'
      const { data: pendentes } = await supabase
        .from('envio_meta_job_item')
        .select('id, telefone, nome, cpf, atraso, saldo, vars, instancia_id')
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

      // Executa em waves paralelas de CONCURRENCY
      for (let i = 0; i < paraEnviar.length; i += CONCURRENCY) {
        if (Date.now() - inicio >= MAX_WALL_MS) break;
        const wave = paraEnviar.slice(i, i + CONCURRENCY);
        const results = await Promise.all(wave.map((it) => processarUmItem(it, job)));

        const okItems = results.filter((r) => r.ok);
        const errItems = results.filter((r) => !r.ok);

        // Bulk update — enviados
        if (okItems.length > 0) {
          const nowIso = new Date().toISOString();
          for (const r of okItems) {
            await supabase.from('envio_meta_job_item').update({
              status: 'enviado',
              erro: null,
              processado_em: nowIso,
              wa_message_id: r.waId,
            }).eq('id', r.id);
          }
        }
        // Bulk update — erros
        if (errItems.length > 0) {
          const nowIso = new Date().toISOString();
          for (const r of errItems) {
            await supabase.from('envio_meta_job_item').update({
              status: 'erro',
              erro: r.erro,
              processado_em: nowIso,
            }).eq('id', r.id);
          }
        }

        // Bump contadores agregados no job
        await supabase.rpc('envio_meta_job_bump', {
          _job_id: jobId,
          _enviados_inc: okItems.length,
          _erros_inc: errItems.length,
          _proximo_em: new Date().toISOString(),
        }).then(() => {}).catch(async () => {
          // Fallback: update direto se RPC falhar
          const { data: cur } = await supabase.from('envio_meta_job').select('enviados, erros').eq('id', jobId).maybeSingle();
          await supabase.from('envio_meta_job').update({
            enviados: (cur?.enviados || 0) + okItems.length,
            erros: (cur?.erros || 0) + errItems.length,
          }).eq('id', jobId);
        });

        processadosNesteWorker += wave.length;
      }
    }

    // Se ainda há pendentes desta instância, faz self-invoke encadeado.
    const { count: restantes } = await supabase
      .from('envio_meta_job_item')
      .select('id', { count: 'exact', head: true })
      .eq('job_id', jobId)
      .eq('instancia_id', instanciaId)
      .eq('status', 'pendente');

    if ((restantes ?? 0) > 0) {
      await selfInvoke(jobId, instanciaId);
      return new Response(JSON.stringify({ success: true, processados: processadosNesteWorker, restantes, continua: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Terminou tudo desta instância. Tenta encerrar o job (se todas as instâncias terminaram).
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

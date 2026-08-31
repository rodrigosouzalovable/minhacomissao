// Controla um job de envio massa Meta: pausar / retomar / cancelar / limpar.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { enviadosHojeBrt } from '../_shared/meta-freio.ts';

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
    // Valida o JWT direto no endpoint de auth (não depende de sessão/SDK no servidor)
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? '';
    const userRes = await fetch(`${Deno.env.get('SUPABASE_URL')}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${jwt}`, apikey: anonKey },
    });
    const userJson = await userRes.json().catch(() => null);
    const userId = userJson?.id as string | undefined;
    if (!userRes.ok || !userId) {
      return new Response(JSON.stringify({ success: false, error: 'usuário inválido', detalhe: userJson?.msg || userJson?.message || `status ${userRes.status}` }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const user = { id: userId };




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
        worker_lock_token: null,
        worker_locked_until: null,
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

      // Se houver instâncias bloqueadas neste job (template pausado), reatribui os
      // pendentes delas para as instâncias ativas (round-robin) antes de disparar.
      const bloqueadas: string[] = Array.isArray((job as any).instancias_bloqueadas) ? (job as any).instancias_bloqueadas : [];
      const todas: string[] = Array.isArray(job.instancia_ids) ? job.instancia_ids : [];
      const ativas = todas.filter((x) => !bloqueadas.includes(x));
      if (bloqueadas.length > 0 && ativas.length > 0) {
        const { data: pendBlock } = await supabase
          .from('envio_meta_job_item')
          .select('id')
          .eq('job_id', jobId)
          .eq('status', 'pendente')
          .in('instancia_id', bloqueadas)
          .order('ordem', { ascending: true });
        const ids = (pendBlock || []).map((r: any) => r.id);
        if (ids.length > 0) {
          const CHUNK = 500;
          for (let i = 0; i < ids.length; i++) {
            const target = ativas[i % ativas.length];
            // agrupa por target para reduzir queries
          }
          const grupos: Record<string, string[]> = {};
          for (const inst of ativas) grupos[inst] = [];
          for (let i = 0; i < ids.length; i++) grupos[ativas[i % ativas.length]].push(ids[i]);
          for (const [target, itemIds] of Object.entries(grupos)) {
            for (let i = 0; i < itemIds.length; i += CHUNK) {
              await supabase.from('envio_meta_job_item')
                .update({ instancia_id: target })
                .in('id', itemIds.slice(i, i + CHUNK));
            }
          }
        }
      }

      const { count: pendentes } = await supabase
        .from('envio_meta_job_item')
        .select('id', { count: 'exact', head: true })
        .eq('job_id', jobId)
        .eq('status', 'pendente');
      if (!pendentes || pendentes === 0) {
        // Nada para reativar — não é erro: responde 200 para não quebrar a UI/auto-retomada.
        return new Response(JSON.stringify({ success: true, skipped: true, reason: 'sem_pendentes' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      await supabase.from('envio_meta_job').update({
        status: 'rodando',
        concluido_em: null,
        status_motivo: null,
        proximo_em: new Date().toISOString(),
      }).eq('id', jobId);
      dispararWorker(job);

    } else if (acao === 'instancias_livres' || acao === 'adicionar_instancias_livres') {
      // Instâncias Meta aptas que ainda têm cota livre HOJE (BRT) e não estão no job.
      const hojeBrt = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
      const jaNoJob: string[] = Array.isArray(job.instancia_ids) ? job.instancia_ids : [];

      const { data: insts } = await supabase
        .from('meta_whatsapp_instances')
        .select('id, nome, display_phone, ativo, provider, saude_quality, estado_pool, recuperacao_ativa, tier_diario')
        .eq('ativo', true)
        .eq('provider', 'meta');

      const { data: freios } = await supabase
        .from('meta_instance_freio_diario')
        .select('instancia_id, teto_efetivo, enviados, motivo_reducao')
        .eq('dia', hojeBrt);
      const freioMap = new Map<string, any>();
      for (const f of freios || []) freioMap.set(f.instancia_id, f);

      const { data: cfgLib } = await supabase
        .from('meta_envio_pool_config').select('liberar_qualidade_global').eq('id', 1).maybeSingle();
      const liberacaoGlobalLivres = cfgLib?.liberar_qualidade_global === true;

       const livres = (insts || [])
         .filter((i: any) => !jaNoJob.includes(i.id))
         .filter((i: any) => liberacaoGlobalLivres || (!i.recuperacao_ativa && i.estado_pool !== 'restrita'))
         .filter((i: any) => liberacaoGlobalLivres || ['GREEN', ''].includes(String(i.saude_quality || '').toUpperCase()))
         .map((i: any) => {
           const f = freioMap.get(i.id);
           const teto = f ? Number(f.teto_efetivo || 0) : Number(i.tier_diario || 0);
           const enviados = f ? Number(f.enviados || 0) : 0;
           return {
             id: i.id,
             nome: i.nome || i.display_phone || i.id.slice(0, 8),
             qualidade: i.saude_quality || null,
             teto,
             enviados,
             folga: Math.max(0, teto - enviados),
           };
         })
         .filter((i: any) => i.folga > 0)
         .sort((a: any, b: any) => b.folga - a.folga);

      if (acao === 'instancias_livres') {
        return new Response(JSON.stringify({ success: true, instancias: livres }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const escolhidas: string[] = Array.isArray(body?.instancia_ids) && body.instancia_ids.length > 0
        ? livres.filter((i: any) => body.instancia_ids.includes(i.id)).map((i: any) => i.id)
        : livres.map((i: any) => i.id);

      if (escolhidas.length === 0) {
        return new Response(JSON.stringify({ success: false, error: 'Nenhuma instância com cota livre agora' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      await supabase.from('envio_meta_job').update({
        instancia_ids: [...jaNoJob, ...escolhidas],
        instancias_bloqueadas_run: [],
        falhas_por_instancia_run: {},
        status: 'rodando',
        concluido_em: null,
        status_motivo: null,
        proximo_em: new Date().toISOString(),
      }).eq('id', jobId);
      await devolverProcessandoParaFila();
      dispararWorker({ ...job, instancia_ids: [...jaNoJob, ...escolhidas] });

      return new Response(JSON.stringify({ success: true, adicionadas: escolhidas.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else if (acao === 'liberar_teto_hoje') {
      // Libera mais envios HOJE para uma instância do job (rampa por idade é regra nossa).
      // Somente admin; nunca acima de pct_max_cota_meta da cota real da Meta.
      const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
      if (!isAdmin) {
        return new Response(JSON.stringify({ success: false, error: 'apenas administradores podem liberar teto' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const jobInsts: string[] = Array.isArray(job.instancia_ids) ? job.instancia_ids : [];
      const instId: string = body?.instancia_id || jobInsts[0];
      if (!instId || !jobInsts.includes(instId)) {
        return new Response(JSON.stringify({ success: false, error: 'instância não pertence a esta campanha' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: inst } = await supabase
        .from('meta_whatsapp_instances')
        .select('id, nome, display_phone, tier_diario, saude_quality, recuperacao_ativa, quarentena_ate')
        .eq('id', instId).maybeSingle();
      if (!inst) {
        return new Response(JSON.stringify({ success: false, error: 'instância não encontrada' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const { data: cfg } = await supabase
        .from('meta_envio_pool_config').select('pct_max_cota_meta, sem_teto_global, liberar_qualidade_global').eq('id', 1).maybeSingle();
      const liberacaoGlobalTeto = cfg?.liberar_qualidade_global === true || cfg?.sem_teto_global === true;
      if (!liberacaoGlobalTeto && (inst.recuperacao_ativa || String(inst.saude_quality || '').toUpperCase() === 'RED')) {
        return new Response(JSON.stringify({ success: false, error: 'número em recuperação de qualidade — teto não pode ser liberado' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const semTetoGlobal = cfg?.sem_teto_global === true;
      const pct = semTetoGlobal ? 1 : Number(cfg?.pct_max_cota_meta ?? 60) / 100;
      const limiteSeguro = Math.max(10, Math.floor(Number(inst.tier_diario ?? 250) * pct));
      const pedido = Number(body?.teto ?? (semTetoGlobal ? limiteSeguro : 250));
      let novoTeto = Math.max(10, Math.min(pedido, limiteSeguro));

      const hojeBrt2 = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
      const { data: freioAtual } = await supabase
        .from('meta_instance_freio_diario')
        .select('enviados').eq('instancia_id', instId).eq('dia', hojeBrt2).maybeSingle();

      // O bloqueio real usa os envios efetivos de hoje: um teto abaixo disso não libera nada.
      const enviadosHoje = await enviadosHojeBrt(supabase, instId);
      if (limiteSeguro <= enviadosHoje) {
        return new Response(JSON.stringify({
          success: false,
          error: `este número já enviou ${enviadosHoje} hoje e o limite de segurança da cota Meta é ${limiteSeguro} — escolha outro número ou aguarde a virada do dia`,
        }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      novoTeto = Math.min(limiteSeguro, Math.max(novoTeto, enviadosHoje + 10));

      await supabase.from('meta_instance_freio_diario').upsert({
        instancia_id: instId,
        dia: hojeBrt2,
        teto_efetivo: novoTeto,
        enviados: Number(freioAtual?.enviados || 0),
        liberado_manual: true,
        motivo_reducao: `teto liberado manualmente para ${novoTeto} por ${user.id}`,
        atualizado_em: new Date().toISOString(),
      }, { onConflict: 'instancia_id,dia' });


      await devolverProcessandoParaFila();
      await supabase.from('envio_meta_job').update({
        status: 'rodando',
        concluido_em: null,
        status_motivo: null,
        instancias_bloqueadas_run: [],
        falhas_por_instancia_run: {},
        proximo_em: new Date().toISOString(),
      }).eq('id', jobId);
      dispararWorker(job);

      return new Response(JSON.stringify({
        success: true,
        instancia: inst.nome || inst.display_phone,
        teto: novoTeto,
        limite_seguro: limiteSeguro,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

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

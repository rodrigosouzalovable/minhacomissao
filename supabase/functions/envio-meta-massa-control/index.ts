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

    } else if (acao === 'instancias_status') {
      // Lista as instâncias da campanha separando ativas x ignoradas, com contagens deste job.
      const jobInsts: string[] = Array.isArray(job.instancia_ids) ? job.instancia_ids : [];
      const bloqRun: string[] = Array.isArray(job.instancias_bloqueadas_run) ? job.instancias_bloqueadas_run : [];
      const bloqTpl: string[] = Array.isArray((job as any).instancias_bloqueadas) ? (job as any).instancias_bloqueadas : [];
      const falhas: Record<string, number> = (job as any).falhas_por_instancia_run || {};

      const { data: insts } = await supabase
        .from('meta_whatsapp_instances')
        .select('id, nome, display_phone, saude_quality, tier_diario, meta_bm_id, ativo')
        .in('id', jobInsts.length > 0 ? jobInsts : ['00000000-0000-0000-0000-000000000000']);

      const bmIds = Array.from(new Set((insts || []).map((i: any) => i.meta_bm_id).filter(Boolean)));
      const bmMap = new Map<string, string>();
      if (bmIds.length > 0) {
        const { data: bms } = await supabase
          .from('meta_business_managers')
          .select('id, nome')
          .in('id', bmIds as string[]);
        for (const b of bms || []) bmMap.set(b.id, b.nome || '');
      }

      // Contagens por instância neste job (enviado / erro).
      const contagem = new Map<string, { enviados: number; erros: number }>();
      const porNome = new Map<string, { enviados: number; erros: number }>();
      let from = 0;
      const pagina = 1000;
      for (let i = 0; i < 40; i++) {
        const { data: itens } = await supabase
          .from('envio_meta_job_item')
          .select('instancia_id, instancia_nome, status')
          .eq('job_id', jobId)
          .in('status', ['enviado', 'erro'])
          .range(from, from + pagina - 1);
        for (const it of itens || []) {
          const bucket = (map: Map<string, any>, key: string) => {
            const cur = map.get(key) || { enviados: 0, erros: 0 };
            if (it.status === 'erro') cur.erros++; else cur.enviados++;
            map.set(key, cur);
          };
          if (it.instancia_id) bucket(contagem, it.instancia_id);
          else if (it.instancia_nome) bucket(porNome, it.instancia_nome);
        }
        if (!itens || itens.length < pagina) break;
        from += pagina;
      }

      const linhas = jobInsts.map((id) => {
        const i: any = (insts || []).find((x: any) => x.id === id) || {};
        const nome = i.nome || i.display_phone || id.slice(0, 8);
        const c = contagem.get(id) || porNome.get(nome) || { enviados: 0, erros: 0 };
        const ignorada = bloqRun.includes(id) || bloqTpl.includes(id);
        return {
          id,
          nome,
          telefone: i.display_phone || null,
          bm: i.meta_bm_id ? (bmMap.get(i.meta_bm_id) || null) : null,
          qualidade: i.saude_quality || null,
          ativa_cadastro: i.ativo !== false,
          enviados: c.enviados,
          erros: c.erros,
          falhas_consecutivas: Number(falhas[id] || 0),
          ignorada,
          motivo_ignorada: bloqTpl.includes(id)
            ? 'template pausado pela Meta'
            : bloqRun.includes(id)
              ? (String((falhas as any)[`mot:${id}`] || '').trim() ||
                (['YELLOW', 'RED'].includes(String(i.saude_quality || '').toUpperCase())
                  ? `qualidade ${String(i.saude_quality).toUpperCase()}`
                  : 'falhas consecutivas'))
              : null,
          reativavel: bloqRun.includes(id),
          em_uso: (job.atual_instancia || '') === nome,
        };
      }).sort((a, b) => Number(a.ignorada) - Number(b.ignorada) || b.enviados - a.enviados);

      return new Response(JSON.stringify({ success: true, instancias: linhas }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else if (acao === 'revalidar_instancias_run') {
      // Revalida somente as instâncias retiradas automaticamente deste job.
      // Itens já aceitos pela Meta nunca voltam para a fila.
      const jobInsts: string[] = Array.isArray(job.instancia_ids) ? job.instancia_ids : [];
      const bloqRunAntes: string[] = Array.isArray(job.instancias_bloqueadas_run) ? job.instancias_bloqueadas_run : [];
      const bloqueadasTemplate: string[] = Array.isArray((job as any).instancias_bloqueadas) ? (job as any).instancias_bloqueadas : [];
      const candidatas = bloqRunAntes.filter((id: string) => jobInsts.includes(id) && !bloqueadasTemplate.includes(id));

      if (candidatas.length === 0) {
        return new Response(JSON.stringify({
          success: true,
          liberadas: 0,
          mantidas_bloqueadas: bloqRunAntes.length,
          reenfileirados: 0,
          mensagem: 'Nenhuma instância bloqueada precisa ser revalidada',
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const healthResp = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/check-meta-instance-health`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({ instancia_ids: candidatas }),
      });
      const healthData = await healthResp.json().catch(() => ({}));
      if (!healthResp.ok) {
        return new Response(JSON.stringify({ success: false, error: healthData?.error || 'Falha ao consultar a Meta' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const resultados = Array.isArray(healthData?.results) ? healthData.results : [];
      const resultadoPorId = new Map(resultados.map((r: any) => [String(r.instancia_id), r]));
      const { data: instanciasAtualizadas } = await supabase
        .from('meta_whatsapp_instances')
        .select('id, ativo, estado_pool, pausa_automatica_ate, pausa_automatica_motivo, saude_status, saude_quality, saude_ban_info, saude_restricoes')
        .in('id', candidatas);

      const agora = Date.now();
      const liberadas = (instanciasAtualizadas || []).filter((inst: any) => {
        const meta: any = resultadoPorId.get(String(inst.id));
        const pausaAtiva = !!inst.pausa_automatica_ate && new Date(inst.pausa_automatica_ate).getTime() > agora;
        const banInfo = inst.saude_ban_info;
        const temBan = !!banInfo && (typeof banInfo !== 'object' || Object.keys(banInfo).length > 0);
        return !meta?.error &&
          String(inst.saude_status || meta?.status || '').toUpperCase() === 'CONNECTED' &&
          String(inst.saude_quality || meta?.quality_rating || '').toUpperCase() === 'GREEN' &&
          meta?.restrito_meta !== true &&
          inst.ativo !== false &&
          inst.estado_pool === 'ativo' &&
          !pausaAtiva &&
          !temBan;
      }).map((inst: any) => String(inst.id));

      const liberadasSet = new Set(liberadas);
      // Releitura antes de salvar: preserva bloqueios registrados pelo worker
      // enquanto a consulta externa estava em andamento.
      const { data: jobAtual } = await supabase.from('envio_meta_job')
        .select('status, instancias_bloqueadas_run, instancias_bloqueadas, falhas_por_instancia_run, erros')
        .eq('id', jobId).maybeSingle();
      const bloqRunAtual: string[] = Array.isArray(jobAtual?.instancias_bloqueadas_run)
        ? jobAtual.instancias_bloqueadas_run : bloqRunAntes;
      const bloqRunDepois = bloqRunAtual.filter((id: string) => !liberadasSet.has(id));
      const falhas: Record<string, number | string> = { ...((jobAtual as any)?.falhas_por_instancia_run || {}) };
      for (const id of liberadas) {
        delete falhas[id];
        delete falhas[`mot:${id}`];
      }

      // Só recupera falhas sem wamid: se a Meta já aceitou a mensagem, mesmo que
      // uma confirmação posterior tenha falhado, não há reenvio automático.
      let reenfileirados = 0;
      if (liberadas.length > 0) {
        const { data: errosRecuperaveis } = await supabase
          .from('envio_meta_job_item')
          .select('id, vars, erro')
          .eq('job_id', jobId)
          .eq('status', 'erro')
          .in('instancia_id', liberadas)
          .is('wa_message_id', null);

        const errosSeguros = (errosRecuperaveis || []).filter((item: any) =>
          /business account|#131031|blocked|banned|restricted|bloquead|inst[aâ]ncia indispon[ií]vel|timeout|tempor[aá]ri|network|fetch failed|status=flagged/i
            .test(String(item.erro || '')),
        );
        for (const item of errosSeguros) {
          const vars = item.vars && typeof item.vars === 'object' ? { ...item.vars } : {};
          const excluidas = Array.isArray((vars as any)._inst_excluidas) ? (vars as any)._inst_excluidas : [];
          (vars as any)._inst_excluidas = excluidas.filter((id: unknown) => !liberadasSet.has(String(id)));
          const { data: atualizado } = await supabase.from('envio_meta_job_item').update({
            status: 'pendente',
            erro: null,
            tentativas: 0,
            processado_em: null,
            instancia_id: null,
            instancia_nome: null,
            vars,
          }).eq('id', item.id).eq('status', 'erro').is('wa_message_id', null).select('id').maybeSingle();
          if (atualizado) reenfileirados++;
        }

        const bloqueadasTemplateAtual: string[] = Array.isArray((jobAtual as any)?.instancias_bloqueadas)
          ? (jobAtual as any).instancias_bloqueadas : bloqueadasTemplate;
        const ativas = jobInsts.filter((id: string) => !bloqRunDepois.includes(id) && !bloqueadasTemplateAtual.includes(id));
        if (job.modo_rajada && ativas.length > 0) {
          const grupos: Record<string, string[]> = {};
          for (const id of ativas) grupos[id] = [];
          errosSeguros.forEach((item: any, idx: number) => grupos[ativas[idx % ativas.length]].push(item.id));
          for (const [instanciaId, ids] of Object.entries(grupos)) {
            for (let i = 0; i < ids.length; i += 500) {
              await supabase.from('envio_meta_job_item').update({ instancia_id: instanciaId, instancia_nome: null })
                .in('id', ids.slice(i, i + 500)).eq('status', 'pendente');
            }
          }
        }

        const estavaRodando = jobAtual?.status === 'rodando';
        const jobPatch: Record<string, unknown> = {
          instancias_bloqueadas_run: bloqRunDepois,
          falhas_por_instancia_run: falhas,
          status: 'rodando',
          erros: Math.max(0, Number(jobAtual?.erros || job.erros || 0) - reenfileirados),
          concluido_em: null,
          status_motivo: null,
          proximo_em: new Date().toISOString(),
        };
        if (!estavaRodando) {
          jobPatch.worker_lock_token = null;
          jobPatch.worker_locked_until = null;
        }
        await supabase.from('envio_meta_job').update(jobPatch).eq('id', jobId);

        if (job.modo_rajada) {
          // Workers já ativos continuam normalmente; disparamos somente os
          // números recém-liberados para não amplificar a taxa da campanha.
          for (const instanciaId of liberadas.filter((id: string) => ativas.includes(id))) {
            fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/envio-meta-massa-burst`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
              },
              body: JSON.stringify({ job_id: jobId, instancia_id: instanciaId }),
            }).catch(() => {});
          }
        } else {
          // O tick usa lock no job; uma chamada extra é segura e garante retomada
          // imediata mesmo se o worker anterior já tiver encerrado.
          dispararWorker({ ...job, status: 'rodando', instancias_bloqueadas_run: bloqRunDepois });
        }
      }

      return new Response(JSON.stringify({
        success: true,
        liberadas: liberadas.length,
        mantidas_bloqueadas: candidatas.length - liberadas.length,
        reenfileirados,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } else if (acao === 'desbloquear_instancia_run') {
      const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
      if (!isAdmin) {
        return new Response(JSON.stringify({ success: false, error: 'apenas administradores podem reativar instâncias' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const instId: string = body?.instancia_id;
      const jobInsts: string[] = Array.isArray(job.instancia_ids) ? job.instancia_ids : [];
      if (!instId || !jobInsts.includes(instId)) {
        return new Response(JSON.stringify({ success: false, error: 'instância não pertence a esta campanha' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const bloqRun: string[] = (Array.isArray(job.instancias_bloqueadas_run) ? job.instancias_bloqueadas_run : [])
        .filter((x: string) => x !== instId);
      const bloqTpl: string[] = Array.isArray((job as any).instancias_bloqueadas) ? (job as any).instancias_bloqueadas : [];
      const falhas: Record<string, number> = { ...((job as any).falhas_por_instancia_run || {}) };
      delete falhas[instId];

      await supabase.from('envio_meta_job').update({
        instancias_bloqueadas_run: bloqRun,
        instancias_bloqueadas: bloqTpl,
        falhas_por_instancia_run: falhas,
        status: 'rodando',
        status_motivo: null,
        concluido_em: null,
        proximo_em: new Date().toISOString(),
      }).eq('id', jobId);
      await devolverProcessandoParaFila();
      dispararWorker({ ...job, status: 'rodando', instancias_bloqueadas_run: bloqRun });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

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
        .from('meta_envio_pool_config').select('liberar_qualidade_global, sem_teto_global').eq('id', 1).maybeSingle();
      const liberacaoGlobalLivres = cfgLib?.liberar_qualidade_global === true || cfgLib?.sem_teto_global === true;

       const livres = (insts || [])
         .filter((i: any) => !jaNoJob.includes(i.id))
         .filter((i: any) => liberacaoGlobalLivres || (!i.recuperacao_ativa && i.estado_pool !== 'restrita'))
         .filter((i: any) => liberacaoGlobalLivres || ['GREEN', ''].includes(String(i.saude_quality || '').toUpperCase()))
         .map((i: any) => {
           const f = freioMap.get(i.id);
           const teto = cfgLib?.sem_teto_global === true
             ? Number(i.tier_diario || 0)
             : (f ? Number(f.teto_efetivo || 0) : Number(i.tier_diario || 0));
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
      const pedido = Number(body?.teto ?? limiteSeguro);
      let novoTeto = Math.max(10, Math.min(pedido, limiteSeguro));

      const hojeBrt2 = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
      const { data: freioAtual } = await supabase
        .from('meta_instance_freio_diario')
        .select('enviados').eq('instancia_id', instId).eq('dia', hojeBrt2).maybeSingle();

      // O bloqueio real usa a cota da Meta; o teto interno não participa quando
      // o modo sem teto está ligado.
      const enviadosHoje = await enviadosHojeBrt(supabase, instId);
      if (limiteSeguro <= enviadosHoje) {
        return new Response(JSON.stringify({
          success: false,
          error: `este número já atingiu a cota real da Meta (${enviadosHoje}/${limiteSeguro}) — aguarde a renovação da cota`,
        }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // O teto nunca pode ficar igual/abaixo do que já foi enviado hoje —
      // isso gravava "sucesso" mas mantinha a campanha travada.
      if (novoTeto <= enviadosHoje) {
        novoTeto = Math.min(limiteSeguro, enviadosHoje + Math.max(10, pedido > 0 ? pedido : 10));
      }

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

    } else if (acao === 'ajustar_delay') {
      // Altera o intervalo entre mensagens com a campanha em andamento.
      // O tick relê o job antes de cada envio, então vale já na próxima mensagem.
      const lo = Math.round(Number(body?.min_seg));
      const hi = Math.round(Number(body?.max_seg));
      if (!Number.isFinite(lo) || !Number.isFinite(hi) || lo < 1 || hi < 1 || lo > 300 || hi > 300 || lo > hi) {
        return new Response(JSON.stringify({ success: false, error: 'informe min_seg e max_seg entre 1 e 300 segundos, com min <= max' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (job.modo_rajada === true) {
        return new Response(JSON.stringify({ success: false, error: 'campanha em modo rajada não usa delay entre mensagens' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      await supabase.from('envio_meta_job').update({ min_seg: lo, max_seg: hi }).eq('id', jobId);
      // Se o próximo envio estava agendado além do novo máximo, antecipa.
      const limite = Date.now() + hi * 1000;
      const emEspera = /^AGUARDANDO_COTA|^RATE_LIMIT/.test(String(job.status_motivo || ''));
      if (!emEspera && job.status === 'rodando' && job.proximo_em && new Date(job.proximo_em).getTime() > limite) {
        await supabase.from('envio_meta_job')
          .update({ proximo_em: new Date(limite).toISOString() })
          .eq('id', jobId)
          .eq('status', 'rodando');
      }
      return new Response(JSON.stringify({ success: true, min_seg: lo, max_seg: hi }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

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

// Cria um job de envio em massa Meta persistente.
// O envio propriamente dito é feito pelo cron `envio-meta-massa-tick`.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { calcularJanelaEnvio } from '../_shared/metaJanelaEnvio.ts';


const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Cliente = {
  telefone: string;
  nome?: string;
  cpf?: string;
  atraso?: string;
  saldo?: number;
  vars?: Record<string, string>;
  credor?: string | null;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get('Authorization') || '';
    const jwt = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!jwt) {
      console.error('[iniciar] recusado: sem Authorization/JWT');
      return new Response(JSON.stringify({ success: false, error: 'não autenticado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
    );
    const { data: userData } = await supabase.auth.getUser(jwt);
    const user = userData?.user;
    if (!user) {
      console.error('[iniciar] recusado 401: token inválido/expirado (auth.getUser falhou)');
      return new Response(JSON.stringify({ success: false, error: 'Sessão expirada ou inválida. Saia e entre novamente para disparar.' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const template = body?.template as { id: string; nome_template: string } | undefined;
    const instanciaIds: string[] = Array.isArray(body?.instanciaIds) ? body.instanciaIds : [];
    const clientes: Cliente[] = Array.isArray(body?.clientes) ? body.clientes : [];
    const modoRajada: boolean = body?.modoRajada === true;
    const minSec = modoRajada ? 0 : Math.max(1, Number(body?.minSec ?? 30));
    const maxSec = modoRajada ? 0 : Math.max(minSec, Number(body?.maxSec ?? 90));
    // Modo RAJADA: teto de 60 msg/s por instância (margem segura abaixo dos 80 mps documentados pela Meta).
    // Ajustar via UI (slider). Modo serial mantém 10 como antes.
    const msgsPorSegundo = modoRajada
      ? Math.max(1, Math.min(60, Number(body?.msgsPorSegundo ?? 30)))
      : 10;
    const templateIdByInstance = (body?.templateIdByInstance ?? {}) as Record<string, string>;
    // Variação de templates: round-robin entre variantes (mesma qtd de variáveis)
    const templateVariantes = (Array.isArray(body?.templateVariantes) ? body.templateVariantes : []) as Array<{
      template_id: string; nome_template?: string; template_id_by_instance?: Record<string, string>;
    }>;

    const nomeCampanha = typeof body?.nomeCampanha === 'string' ? body.nomeCampanha.trim().slice(0, 120) : null;
    const folderId: string | null = typeof body?.folderId === 'string' && body.folderId ? body.folderId : null;
    const credorCampanha: string | null = body?.credor === 'novo_mundo' || body?.credor === 'ume' ? body.credor : null;
    // Agendamento: ISO UTC no futuro. Job criado como 'rodando', mas só começa em proximo_em.
    let agendarParaMs: number | null = null;
    if (typeof body?.agendarPara === 'string' && body.agendarPara) {
      const t = Date.parse(body.agendarPara);
      if (!Number.isNaN(t) && t > Date.now() + 30_000) agendarParaMs = t;
    }

    if (!template?.id) {
      console.error('[iniciar] recusado 400: template obrigatório');
      return new Response(JSON.stringify({ success: false, error: 'template obrigatório' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (instanciaIds.length === 0) {
      console.error('[iniciar] recusado 400: nenhuma instância recebida');
      return new Response(JSON.stringify({ success: false, error: 'ao menos 1 instância' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (clientes.length === 0) {
      console.error('[iniciar] recusado 400: nenhum cliente recebido');
      return new Response(JSON.stringify({ success: false, error: 'ao menos 1 cliente' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Chave global "Liberar YELLOW/RED": quando ligada, nenhuma instância é recusada
    // por qualidade nem por quarentena — vale para todos os usuários (inclusive parceiros).
    const { data: cfgQualidade } = await supabase
      .from('meta_envio_pool_config').select('liberar_qualidade_global').eq('id', 1).maybeSingle();
    const liberacaoGlobal = cfgQualidade?.liberar_qualidade_global === true;

    // Filtro server-side: remove apenas instâncias com qualidade RED (bloqueio real).
    // YELLOW passa a ser permitido — a Meta ainda entrega e o usuário quer disparar.
    // No modo RAJADA não filtramos nada: só encerramos quando a Meta responder banido/restrito.
    let instanciaIdsFiltradas = instanciaIds;
    if (modoRajada !== true && !liberacaoGlobal) {
      const { data: instancesRows } = await supabase
        .from('meta_whatsapp_instances')
        .select('id, nome, saude_quality')
        .in('id', instanciaIds);
      const badIds = new Set(
        (instancesRows || [])
          .filter((r: any) => String(r.saude_quality || '').toUpperCase() === 'RED')
          .map((r: any) => r.id),
      );
      instanciaIdsFiltradas = instanciaIds.filter((id) => !badIds.has(id));
      if (instanciaIdsFiltradas.length === 0) {
        console.error('[iniciar] recusado 400: todas as instâncias com qualidade RED');
        return new Response(JSON.stringify({
          success: false,
          error: 'Todas as instâncias selecionadas estão com qualidade RED (bloqueadas pela Meta). Selecione outras instâncias ou use o Modo Rajada.',
        }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Remove instâncias em quarentena por queda de qualidade (exceto rajada/liberação global).
    if (modoRajada !== true && !liberacaoGlobal) {
      const { data: quarentena } = await supabase
        .from('meta_whatsapp_instances')
        .select('id, nome, quarentena_ate')
        .in('id', instanciaIdsFiltradas)
        .not('quarentena_ate', 'is', null)
        .gt('quarentena_ate', new Date().toISOString());
      const emQuarentena = new Set((quarentena || []).map((r: any) => r.id));
      if (emQuarentena.size > 0) {
        instanciaIdsFiltradas = instanciaIdsFiltradas.filter((id) => !emQuarentena.has(id));
        if (instanciaIdsFiltradas.length === 0) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Todas as instâncias selecionadas estão em quarentena por queda de qualidade. Selecione outras instâncias ou aguarde o fim da quarentena.',
          }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }
    }

    // ===== Higiene de base: remove destinatários suprimidos e blacklist =====
    // supressao_ativa -> números com falhas de entrega / sem resposta
    // blacklist_ativa -> números que pediram bloqueio pelo botão "Bloquear contato"
    let clientesEnvio = clientes;
    let suprimidos = 0;
    let bloqueadosBlacklist = 0;
    const { data: cfgPool } = await supabase
      .from('meta_envio_pool_config').select('supressao_ativa, blacklist_ativa').eq('id', 1).maybeSingle();
    const supressaoAtiva = cfgPool?.supressao_ativa !== false;
    const blacklistAtiva = cfgPool?.blacklist_ativa !== false;
    if (supressaoAtiva || blacklistAtiva) {
      const sufixo = (t: string) => {
        const d = String(t || '').replace(/\D+/g, '');
        return d.length >= 8 ? d.slice(-8) : d;
      };
      const sufixos = Array.from(new Set(clientes.map((c) => sufixo(c.telefone)).filter(Boolean)));
      const bloqueados = new Set<string>();
      const blacklist = new Set<string>();
      for (let i = 0; i < sufixos.length; i += 500) {
        const { data } = await supabase
          .from('meta_destinatario_supressao')
          .select('telefone_sufixo, motivo')
          .in('telefone_sufixo', sufixos.slice(i, i + 500));
        (data || []).forEach((r: any) => {
          const ehBlacklist = String(r.motivo || '').startsWith('blacklist');
          if (ehBlacklist) {
            if (blacklistAtiva) blacklist.add(r.telefone_sufixo);
          } else if (supressaoAtiva) {
            bloqueados.add(r.telefone_sufixo);
          }
        });
      }
      if (bloqueados.size > 0 || blacklist.size > 0) {
        clientesEnvio = clientes.filter((c) => {
          const s = sufixo(c.telefone);
          if (blacklist.has(s)) { bloqueadosBlacklist++; return false; }
          if (bloqueados.has(s)) { suprimidos++; return false; }
          return true;
        });
      }
      if (clientesEnvio.length === 0) {
        return new Response(JSON.stringify({
          success: false,
          error: `Todos os ${clientes.length} destinatários estão bloqueados (${bloqueadosBlacklist} na blacklist, ${suprimidos} na supressão). Nada foi enviado.`,
        }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      console.log('[iniciar] higiene de base — suprimidos:', suprimidos, 'blacklist:', bloqueadosBlacklist);
    }



    // Trava anti-gasto: bloqueia envio em massa de templates MARKETING (custo ~7x utility).
    // Verifica todos os template_ids (por instância + o principal).
    const allTemplateIds = Array.from(new Set([
      template.id,
      ...Object.values(templateIdByInstance || {}).filter(Boolean) as string[],
      ...templateVariantes.flatMap((v) => [
        v?.template_id,
        ...Object.values(v?.template_id_by_instance || {}),
      ]).filter(Boolean) as string[],
    ]));

    const { data: tplCats } = await supabase
      .from('meta_whatsapp_templates')
      .select('id, nome_template, categoria')
      .in('id', allTemplateIds);
    const marketing = (tplCats || []).find(
      (t: any) => String(t.categoria || '').toUpperCase() === 'MARKETING',
    );
    if (marketing) {
      console.error('[iniciar] recusado 400: template MARKETING', marketing.nome_template);
      return new Response(JSON.stringify({
        success: false,
        error: `Envio bloqueado: template "${marketing.nome_template}" é categoria MARKETING (cobrado como marketing pela Meta, ~7x mais caro que utility). Use apenas templates UTILITY para envio em massa.`,
      }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }


    // Múltiplas campanhas simultâneas são permitidas: NÃO cancelar jobs anteriores.
    // Cada job roda no seu próprio loop de tick e o pick-meta-instance respeita cota/health por instância.



    // Nomes das instâncias (para preencher no item quando modo rajada)
    const { data: instNamesRows } = await supabase
      .from('meta_whatsapp_instances')
      .select('id, nome, display_phone')
      .in('id', instanciaIdsFiltradas);
    const nomeById = new Map<string, string>();
    for (const r of (instNamesRows || []) as any[]) {
      nomeById.set(r.id, r.nome || r.display_phone || r.id);
    }

    // Limpa pausas residuais de rate limit herdadas de campanhas anteriores
    // para que a nova campanha comece a enviar imediatamente. NÃO mexemos em
    // pausa_automatica_ate quando o motivo for status=BANNED/FLAGGED/RESTRICTED
    // — essa é uma pausa legítima da Meta.
    try {
      await supabase
        .from('meta_whatsapp_instances')
        .update({ rate_limit_ate: null, rajada_taxa_atual: null })
        .in('id', instanciaIdsFiltradas);
    } catch (_) { /* não bloqueia início */ }

    // Janela de envio: dentro do horário o job já arranca no primeiro tick; fora dele
    // agenda exatamente para a abertura da janela (sem backoff fixo de 10 min).
    const janela = await calcularJanelaEnvio(supabase);
    let proximoEmInicial = janela.aberta
      ? new Date().toISOString()
      : new Date(Date.now() + janela.esperaMs).toISOString();
    let statusMotivoInicial: string | null = janela.aberta
      ? null
      : `Aguardando abertura da janela de envio (${janela.aberturaBrtLabel} BRT)`;
    if (agendarParaMs) {
      // Agendado: nunca antes da data escolhida. Se cair fora da janela, o tick
      // reagenda para a próxima abertura quando o horário chegar.
      proximoEmInicial = new Date(agendarParaMs).toISOString();
      statusMotivoInicial = `Campanha agendada para ${new Date(agendarParaMs).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} (BRT)`;
    }

    const { data: job, error: jobErr } = await supabase
      .from('envio_meta_job')
      .insert({
        user_id: user.id,
        status: 'rodando',
        template_id: template.id,
        template_nome: template.nome_template,
        template_id_by_instance: templateIdByInstance,
        template_variantes: templateVariantes,

        instancia_ids: instanciaIdsFiltradas,
        min_seg: minSec,
        max_seg: maxSec,
        total: clientesEnvio.length,
        proximo_em: proximoEmInicial,
        status_motivo: statusMotivoInicial,
        nome_campanha: nomeCampanha,
        modo_rajada: modoRajada,
        msgs_por_segundo: msgsPorSegundo,
        folder_id: folderId,
        credor: credorCampanha,
      })

      .select('id')
      .single();
    if (jobErr) { console.error('[iniciar] insert job falhou', jobErr); throw jobErr; }
    console.log('[iniciar] job criado', job.id, 'clientes:', clientesEnvio.length, 'instancias:', instanciaIdsFiltradas.length, 'folder:', folderId);

    // Insere itens em lotes de 500 para não estourar payload.
    // Em modo rajada: pré-atribui instância em round-robin para permitir workers paralelos.
    const CHUNK = 500;
    for (let i = 0; i < clientesEnvio.length; i += CHUNK) {
      const slice = clientesEnvio.slice(i, i + CHUNK).map((c, idx) => {
        const globalIdx = i + idx;
        const instId = modoRajada
          ? instanciaIdsFiltradas[globalIdx % instanciaIdsFiltradas.length]
          : null;
        return {
          job_id: job.id,
          ordem: globalIdx,
          telefone: c.telefone,
          nome: c.nome ?? null,
          cpf: c.cpf ?? null,
          atraso: c.atraso ?? null,
          saldo: c.saldo ?? null,
          vars: c.vars && Object.keys(c.vars).length > 0 ? c.vars : {},
          status: 'pendente',
          instancia_id: instId,
          instancia_nome: instId ? (nomeById.get(instId) ?? null) : null,
          variante_idx: templateVariantes.length > 1 ? globalIdx % templateVariantes.length : 0,
          credor: (c.credor === 'novo_mundo' || c.credor === 'ume') ? c.credor : credorCampanha,
        };
      });

      const { error } = await supabase.from('envio_meta_job_item').insert(slice);
      if (error) throw error;
    }

    // Grava o vínculo telefone -> CPF (só CPF real de 11 dígitos) para o relatório
    // diário de acionamentos conseguir atribuir o disparo à carteira do credor.
    try {
      const pares = clientesEnvio
        .map((c: any) => ({ telefone: c.telefone, cpf: String(c.cpf ?? '').replace(/\D/g, ''), origem: 'mailing' }))
        .filter((p: any) => p.cpf.length === 11 && p.telefone);
      for (let i = 0; i < pares.length; i += 1000) {
        await supabase.rpc('acionamento_vincular_telefone_cpf', { _pares: pares.slice(i, i + 1000) });
      }
      console.log('[iniciar] vinculos telefone->cpf gravados:', pares.length);
    } catch (e) {
      console.error('[iniciar] falha ao gravar vinculos telefone->cpf', e);
    }

    // Agendada: nada é disparado agora. O tick agendado assume quando proximo_em vencer.
    if (agendarParaMs) {
      console.log('[iniciar] job agendado', job.id, 'para', new Date(agendarParaMs).toISOString());
      return new Response(JSON.stringify({ success: true, job_id: job.id, agendado_para: new Date(agendarParaMs).toISOString() }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (modoRajada) {
      // Dispara um worker paralelo POR INSTÂNCIA — cada worker envia em rajada.
      for (const instId of instanciaIdsFiltradas) {
        fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/envio-meta-massa-burst`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          },
          body: JSON.stringify({ job_id: job.id, instancia_id: instId }),
        }).catch(() => {});
      }
      return new Response(JSON.stringify({ success: true, job_id: job.id, modo: 'rajada' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Um único tick inicial. Os próximos são acionados pelo agendamento somente
    // quando proximo_em vencer; não há worker dormindo nem chamada duplicada.
    fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/envio-meta-massa-tick`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({ job_id: job.id }),
    }).catch(() => {});

    return new Response(JSON.stringify({ success: true, job_id: job.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[envio-meta-massa-iniciar]', e);
    return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : 'erro' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Cria um job de envio em massa Meta persistente.
// O envio propriamente dito é feito pelo cron `envio-meta-massa-tick`.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
    const nomeCampanha = typeof body?.nomeCampanha === 'string' ? body.nomeCampanha.trim().slice(0, 120) : null;
    const folderId: string | null = typeof body?.folderId === 'string' && body.folderId ? body.folderId : null;

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

    // Filtro server-side: remove apenas instâncias com qualidade RED (bloqueio real).
    // YELLOW passa a ser permitido — a Meta ainda entrega e o usuário quer disparar.
    // No modo RAJADA não filtramos nada: só encerramos quando a Meta responder banido/restrito.
    let instanciaIdsFiltradas = instanciaIds;
    if (modoRajada !== true) {
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


    // Trava anti-gasto: bloqueia envio em massa de templates MARKETING (custo ~7x utility).
    // Verifica todos os template_ids (por instância + o principal).
    const allTemplateIds = Array.from(new Set([
      template.id,
      ...Object.values(templateIdByInstance || {}).filter(Boolean) as string[],
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

    const { data: job, error: jobErr } = await supabase
      .from('envio_meta_job')
      .insert({
        user_id: user.id,
        status: 'rodando',
        template_id: template.id,
        template_nome: template.nome_template,
        template_id_by_instance: templateIdByInstance,
        instancia_ids: instanciaIdsFiltradas,
        min_seg: minSec,
        max_seg: maxSec,
        total: clientes.length,
        proximo_em: new Date().toISOString(),
        nome_campanha: nomeCampanha,
        modo_rajada: modoRajada,
        msgs_por_segundo: msgsPorSegundo,
        folder_id: folderId,
      })
      .select('id')
      .single();
    if (jobErr) { console.error('[iniciar] insert job falhou', jobErr); throw jobErr; }
    console.log('[iniciar] job criado', job.id, 'clientes:', clientes.length, 'instancias:', instanciaIdsFiltradas.length, 'folder:', folderId);

    // Insere itens em lotes de 500 para não estourar payload.
    // Em modo rajada: pré-atribui instância em round-robin para permitir workers paralelos.
    const CHUNK = 500;
    for (let i = 0; i < clientes.length; i += CHUNK) {
      const slice = clientes.slice(i, i + CHUNK).map((c, idx) => {
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
        };
      });
      const { error } = await supabase.from('envio_meta_job_item').insert(slice);
      if (error) throw error;
    }

    // Grava o vínculo telefone -> CPF (só CPF real de 11 dígitos) para o relatório
    // diário de acionamentos conseguir atribuir o disparo à carteira do credor.
    try {
      const pares = clientes
        .map((c: any) => ({ telefone: c.telefone, cpf: String(c.cpf ?? '').replace(/\D/g, ''), origem: 'mailing' }))
        .filter((p: any) => p.cpf.length === 11 && p.telefone);
      for (let i = 0; i < pares.length; i += 1000) {
        await supabase.rpc('acionamento_vincular_telefone_cpf', { _pares: pares.slice(i, i + 1000) });
      }
      console.log('[iniciar] vinculos telefone->cpf gravados:', pares.length);
    } catch (e) {
      console.error('[iniciar] falha ao gravar vinculos telefone->cpf', e);
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

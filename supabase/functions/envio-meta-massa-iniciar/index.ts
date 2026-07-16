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
      return new Response(JSON.stringify({ success: false, error: 'não autenticado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const { data: userData } = await supabase.auth.getUser(jwt);
    const user = userData?.user;
    if (!user) {
      return new Response(JSON.stringify({ success: false, error: 'usuário inválido' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const template = body?.template as { id: string; nome_template: string } | undefined;
    const instanciaIds: string[] = Array.isArray(body?.instanciaIds) ? body.instanciaIds : [];
    const clientes: Cliente[] = Array.isArray(body?.clientes) ? body.clientes : [];
    const minSec = Math.max(1, Number(body?.minSec ?? 30));
    const maxSec = Math.max(minSec, Number(body?.maxSec ?? 90));
    const templateIdByInstance = (body?.templateIdByInstance ?? {}) as Record<string, string>;
    const nomeCampanha = typeof body?.nomeCampanha === 'string' ? body.nomeCampanha.trim().slice(0, 120) : null;

    if (!template?.id) {
      return new Response(JSON.stringify({ success: false, error: 'template obrigatório' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (instanciaIds.length === 0) {
      return new Response(JSON.stringify({ success: false, error: 'ao menos 1 instância' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (clientes.length === 0) {
      return new Response(JSON.stringify({ success: false, error: 'ao menos 1 cliente' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Filtro server-side: remove instâncias com qualidade RED/YELLOW
    const { data: instancesRows } = await supabase
      .from('meta_whatsapp_instances')
      .select('id, nome, saude_quality')
      .in('id', instanciaIds);
    const badIds = new Set(
      (instancesRows || [])
        .filter((r: any) => {
          const q = String(r.saude_quality || '').toUpperCase();
          return q === 'RED' || q === 'YELLOW';
        })
        .map((r: any) => r.id),
    );
    const instanciaIdsFiltradas = instanciaIds.filter((id) => !badIds.has(id));
    if (instanciaIdsFiltradas.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Todas as instâncias selecionadas estão com qualidade RED/YELLOW. Aguarde recuperação ou selecione outras.',
      }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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
      return new Response(JSON.stringify({
        success: false,
        error: `Envio bloqueado: template "${marketing.nome_template}" é categoria MARKETING (cobrado como marketing pela Meta, ~7x mais caro que utility). Use apenas templates UTILITY para envio em massa.`,
      }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }


    // Múltiplas campanhas simultâneas são permitidas: NÃO cancelar jobs anteriores.
    // Cada job roda no seu próprio loop de tick e o pick-meta-instance respeita cota/health por instância.



    const { data: job, error: jobErr } = await supabase
      .from('envio_meta_job')
      .insert({
        user_id: user.id,
        status: 'rodando',
        template_id: template.id,
        template_nome: template.nome_template,
        template_id_by_instance: templateIdByInstance,
        instancia_ids: instanciaIds,
        min_seg: minSec,
        max_seg: maxSec,
        total: clientes.length,
        proximo_em: new Date().toISOString(),
        nome_campanha: nomeCampanha,
      })
      .select('id')
      .single();
    if (jobErr) throw jobErr;

    // Insere itens em lotes de 500 para não estourar payload
    const CHUNK = 500;
    for (let i = 0; i < clientes.length; i += CHUNK) {
      const slice = clientes.slice(i, i + CHUNK).map((c, idx) => ({
        job_id: job.id,
        ordem: i + idx,
        telefone: c.telefone,
        nome: c.nome ?? null,
        cpf: c.cpf ?? null,
        atraso: c.atraso ?? null,
        saldo: c.saldo ?? null,
        vars: c.vars && Object.keys(c.vars).length > 0 ? c.vars : {},
        status: 'pendente',
      }));
      const { error } = await supabase.from('envio_meta_job_item').insert(slice);
      if (error) throw error;
    }

    // Executa somente a primeira tentativa agora. Se não houver instância disponível,
    // o job encerra com motivo real em vez de ficar contando 60s sem enviar nada.
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      const firstTick = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/envio-meta-massa-tick`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({ job_id: job.id, single: true }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (!firstTick.ok) throw new Error('primeiro tick falhou');
    } catch {
      // Se abortou/timeout, dispara novamente fire-and-forget para tentar a primeira execução.
      fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/envio-meta-massa-tick`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({ job_id: job.id, single: true }),
      }).catch(() => {});
    }

    // Continua o loop em background apenas se o primeiro envio realmente avançou.
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

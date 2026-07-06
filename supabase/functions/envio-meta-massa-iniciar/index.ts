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

    // Cancela silenciosamente jobs "rodando/pausado" antigos do mesmo usuário para não competir.
    const { data: ativos } = await supabase
      .from('envio_meta_job')
      .select('id')
      .eq('user_id', user.id)
      .in('status', ['rodando', 'pausado']);
    if (ativos && ativos.length > 0) {
      await supabase.from('envio_meta_job')
        .update({ status: 'cancelado', status_motivo: 'novo job iniciado', concluido_em: new Date().toISOString() })
        .in('id', ativos.map((j: any) => j.id));
    }

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

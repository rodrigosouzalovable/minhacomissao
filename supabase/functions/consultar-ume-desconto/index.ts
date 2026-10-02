import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { consultarUme, propostaDaUme, soDigitos } from '../_shared/ume-desconto.ts';
import { notificarAdmin } from '../_shared/notificar-admin.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const service = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  try {
    const inicio = performance.now();
    const tempos: Record<string, number> = {};
    const marcar = (etapa: string, desde: number) => {
      tempos[etapa] = Math.round(performance.now() - desde);
    };
    // Exige usuário autenticado
    const auth = req.headers.get('Authorization') ?? '';
    const token = auth.replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'não autenticado' }, 401);
    const inicioAuth = performance.now();
    const { data: userData } = await service.auth.getUser(token);
    marcar('autenticacao', inicioAuth);
    if (!userData?.user) return json({ error: 'não autenticado' }, 401);

    const body = await req.json().catch(() => ({}));
    const cpf = soDigitos((body as any)?.cpf);
    const forcar = !!(body as any)?.forcar;
    if (cpf.length !== 11) return json({ error: 'CPF inválido' }, 400);

    const inicioConfig = performance.now();
    const configPromise = service.from('iago_config').select('ume_tabela').limit(1).maybeSingle();
    let tabela: 'padrao' | 'especial' | 'sem_juros_10' = 'sem_juros_10';
    const perfil = (body as any)?.perfil === 'completo' ? 'completo' : 'essencial';
    const inicioConsulta = performance.now();
    const consultaPromise = consultarUme(service, cpf, { forcar, perfil, aguardarCache: false });
    try {
      const { data: cfg } = await configPromise;
      const v = String((cfg as any)?.ume_tabela || '');
      if (v === 'especial' || v === 'padrao' || v === 'sem_juros_10') tabela = v;
    } catch { /* padrão */ }
    marcar('configuracao', inicioConfig);

    const consulta = await consultaPromise;
    marcar('consulta', inicioConsulta);
    tempos.total = Math.round(performance.now() - inicio);
    console.log('[consultar-ume-desconto] desempenho', {
      origem: consulta.doCache ? 'cache' : 'externa',
      perfil,
      ...tempos,
    });
    return json({
      success: true,
      encontrado: consulta.encontrado,
      consulta,
      proposta: propostaDaUme(consulta, tabela),
      tabelaPadraoConfig: tabela,
      desempenho: { origem: consulta.doCache ? 'cache' : 'externa', totalMs: tempos.total },
    });
  } catch (error) {
    const msg = String((error as Error)?.message || error);
    console.error('[consultar-ume-desconto] erro', msg);
    if (msg.includes('layout_ume_mudou')) {
      try {
        await notificarAdmin(service, {
          tipo: 'ume_layout_mudou',
          mensagem: '⚠️ *Consulta UME indisponível*\n\nO layout do relatório da calculadora de desconto da UME mudou. As propostas automáticas da UME estão suspensas até o ajuste.',
        });
      } catch { /* melhor esforço */ }
      return json({ success: false, error: 'layout_ume_mudou', message: 'O layout do relatório UME mudou. Avisei o administrador.' }, 200);
    }
    if (msg.includes('ume_timeout')) {
      return json({ success: false, error: 'ume_timeout', message: 'A consulta da UME demorou mais que o esperado. Tente novamente.' }, 200);
    }
    return json({ success: false, error: msg }, 200);
  }
});

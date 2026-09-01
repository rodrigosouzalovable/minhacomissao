// Cria um lote de consultas UME e dispara o processamento em segundo plano.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { soDigitos } from '../_shared/ume-desconto.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const service = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  try {
    const auth = req.headers.get('Authorization') ?? '';
    const token = auth.replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'não autenticado' }, 401);
    const { data: userData } = await service.auth.getUser(token);
    const user = userData?.user;
    if (!user) return json({ error: 'não autenticado' }, 401);

    const body = await req.json().catch(() => ({}));
    const nomeArquivo = String((body as any)?.nomeArquivo || '').slice(0, 200);
    const forcar = !!(body as any)?.forcar;
    const brutos: unknown[] = Array.isArray((body as any)?.cpfs) ? (body as any).cpfs : [];

    const unicos = Array.from(new Set(brutos.map((c) => soDigitos(c)).filter((c) => c.length === 11)));
    if (unicos.length === 0) return json({ error: 'Nenhum CPF válido na planilha' }, 400);
    if (unicos.length > 200_000) return json({ error: 'Limite de 200.000 CPFs por lote' }, 400);

    const { data: lote, error: erroLote } = await service
      .from('ume_lotes')
      .insert({
        nome_arquivo: nomeArquivo || 'planilha.xlsx',
        total: unicos.length,
        status: 'processando',
        forcar,
        criado_por: user.id,
      })
      .select('id')
      .single();
    if (erroLote || !lote) throw new Error(erroLote?.message || 'falha ao criar lote');

    for (let i = 0; i < unicos.length; i += 1000) {
      const fatia = unicos.slice(i, i + 1000).map((cpf) => ({ lote_id: lote.id, cpf }));
      const { error } = await service.from('ume_lote_itens').insert(fatia);
      if (error) throw new Error(error.message);
    }

    // Dispara o primeiro tick sem esperar a conclusão.
    const url = `${Deno.env.get('SUPABASE_URL')}/functions/v1/ume-lote-tick`;
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({ loteId: lote.id }),
    }).catch((e) => console.error('[ume-lote-iniciar] falha ao disparar tick', e));

    return json({ success: true, loteId: lote.id, total: unicos.length });
  } catch (error) {
    const msg = String((error as Error)?.message || error);
    console.error('[ume-lote-iniciar] erro', msg);
    return json({ success: false, error: msg }, 200);
  }
});

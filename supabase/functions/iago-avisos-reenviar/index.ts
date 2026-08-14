// Reenvia os avisos do IAGO ("preciso de um humano") que ficaram com status erro.
// Chamada manual/pontual — sem cron.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.88.0';
import { notificarAdmin } from '../_shared/notificar-admin.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    let horas = 24;
    try {
      const body = await req.json();
      if (Number(body?.horas) > 0) horas = Math.min(72, Number(body.horas));
    } catch (_) { /* sem body */ }

    const desde = new Date(Date.now() - horas * 3600_000).toISOString();

    const { data: falhas } = await supabase
      .from('admin_notificacoes_log')
      .select('id, mensagem, enviado_em')
      .eq('tipo', 'iago_humano')
      .eq('status', 'erro')
      .gte('enviado_em', desde)
      .order('enviado_em', { ascending: true })
      .limit(200);

    const { data: ok } = await supabase
      .from('admin_notificacoes_log')
      .select('mensagem')
      .eq('tipo', 'iago_humano')
      .eq('status', 'enviado')
      .gte('enviado_em', desde)
      .limit(500);

    // Remove o prefixo "[numero] " para agrupar o mesmo aviso enviado a vários destinos
    const limpar = (m: string) => String(m || '').replace(/^\[\d+\]\s*/, '').trim();
    const jaEnviados = new Set((ok || []).map((r: any) => limpar(r.mensagem)));

    const pendentes: string[] = [];
    const vistos = new Set<string>();
    for (const f of (falhas || []) as any[]) {
      const m = limpar(f.mensagem);
      if (!m || jaEnviados.has(m) || vistos.has(m)) continue;
      vistos.add(m);
      pendentes.push(m);
    }

    const { data: contatos } = await supabase
      .from('meta_ia_contatos_emergencia').select('telefone').eq('ativo', true);
    const destinatarios = (contatos || [])
      .map((c: any) => String(c.telefone || '').replace(/\D/g, ''))
      .filter((t: string) => t.length >= 10);

    if (!destinatarios.length) return json({ success: false, error: 'sem_contato_emergencia' }, 400);

    let enviados = 0;
    const erros: string[] = [];
    for (const mensagem of pendentes) {
      const res = await notificarAdmin(supabase, { tipo: 'iago_humano', mensagem, destinatarios });
      if (res.success) enviados++;
      else erros.push(String((res as any).error || (res as any).skipped || 'falha').slice(0, 200));
    }

    console.log('[IAGO reenvio]', { pendentes: pendentes.length, enviados, erros: erros.length });
    return json({ success: true, pendentes: pendentes.length, enviados, erros: erros.slice(0, 5) });
  } catch (e) {
    console.error('[IAGO reenvio] erro', e);
    return json({ success: false, error: String(e) }, 500);
  }
});

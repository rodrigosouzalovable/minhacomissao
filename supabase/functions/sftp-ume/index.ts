import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import SftpClient from 'npm:ssh2-sftp-client@10';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const PASTAS = ['/baixas_pagamento', '/carga', '/odres', '/Acompanhamento_Recuperacao', '/carga/processados'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const auth = req.headers.get('Authorization') ?? '';
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: u } = await sb.auth.getUser();
    if (!u?.user) return json({ error: 'Não autenticado' }, 401);
    const { data: admin } = await sb.rpc('has_role', { _user_id: u.user.id, _role: 'admin' });
    if (!admin) return json({ error: 'Apenas administradores' }, 403);

    const chave = Deno.env.get('SFTP_UME_PRIVATE_KEY');
    if (!chave) return json({ error: 'Chave de acesso ao SFTP ainda não cadastrada' }, 400);

    const body = await req.json().catch(() => ({}));
    const acao = body?.acao;
    const caminho = typeof body?.caminho === 'string' ? body.caminho : '';
    if (acao === 'baixar' && (!PASTAS.some((p) => caminho.startsWith(p + '/')) || caminho.includes('..'))) {
      return json({ error: 'Caminho inválido' }, 400);
    }

    const sftp = new SftpClient();
    await sftp.connect({
      host: Deno.env.get('SFTP_UME_HOST') ?? '35.227.83.18',
      port: 22,
      username: Deno.env.get('SFTP_UME_USER') ?? 'ribeiro_usr',
      privateKey: chave.replace(/\\n/g, '\n'),
      readyTimeout: 20000,
    });
    try {
      if (acao === 'listar') {
        const pastas: Record<string, unknown[]> = {};
        for (const p of PASTAS) {
          try {
            const itens = await sftp.list(p);
            pastas[p] = itens.filter((i: any) => i.type === '-')
              .map((i: any) => ({ nome: i.name, caminho: `${p}/${i.name}`, tamanho: i.size, modificado: i.modifyTime }))
              .sort((a: any, b: any) => b.modificado - a.modificado).slice(0, 50);
          } catch (e) { pastas[p] = []; console.log('pasta', p, String(e)); }
        }
        return json({ ok: true, pastas });
      }
      if (acao === 'baixar') {
        const buf = await sftp.get(caminho) as Uint8Array;
        return new Response(buf, { headers: { ...corsHeaders, 'Content-Type': 'text/csv; charset=latin1' } });
      }
      return json({ error: 'Ação inválida' }, 400);
    } finally {
      await sftp.end().catch(() => {});
    }
  } catch (e) {
    console.error('sftp-ume', e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

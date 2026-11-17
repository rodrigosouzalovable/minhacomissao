// Checks the Fábrica de Vídeos social accounts (admin-only, on demand — no cron/polling).
// Credentials live in connectors/secrets; this only records profile and status.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { requireCaller } from '../_shared/auth-guard.ts';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const GATEWAY_URL = 'https://connector-gateway.lovable.dev';

type Resultado = { rede: string; status: string; nome_exibicao?: string | null; avatar_url?: string | null; pode_publicar?: boolean; erro?: string | null };

async function verificarTikTok(handleEsperado: string): Promise<Resultado> {
  const lovableKey = Deno.env.get('LOVABLE_API_KEY');
  const tiktokKey = Deno.env.get('TIKTOK_API_KEY');
  if (!lovableKey || !tiktokKey) return { rede: 'tiktok', status: 'desconectado', erro: null };
  const headers = { Authorization: `Bearer ${lovableKey}`, 'X-Connection-Api-Key': tiktokKey };
  const r = await fetch(`${GATEWAY_URL}/tiktok/user/info/?fields=open_id,display_name,avatar_url,username`, { headers });
  const txt = await r.text();
  if (!r.ok) return { rede: 'tiktok', status: 'erro', erro: `TikTok respondeu ${r.status}: ${txt.slice(0, 300)}` };
  let d: any = {};
  try { d = JSON.parse(txt); } catch { /* ignore */ }
  if (d?.error?.code && d.error.code !== 'ok') return { rede: 'tiktok', status: 'erro', erro: `${d.error.code}: ${d.error.message || ''}`.slice(0, 300) };
  const u = d?.data?.user || {};
  const username = String(u.username || '').toLowerCase();
  if (handleEsperado && username && username !== handleEsperado.toLowerCase()) {
    return {
      rede: 'tiktok', status: 'erro', nome_exibicao: `@${u.username}`, avatar_url: u.avatar_url || null, pode_publicar: false,
      erro: `Conta errada conectada: @${u.username}. Reconecte entrando com @${handleEsperado}.`,
    };
  }
  // Publishing needs the Content Posting scope; creator_info is a harmless read that only succeeds with it.
  const c = await fetch(`${GATEWAY_URL}/tiktok/post/publish/creator_info/query/`, {
    method: 'POST', headers: { ...headers, 'Content-Type': 'application/json; charset=UTF-8' }, body: '{}',
  });
  const ctxt = await c.text();
  let podePublicar = false;
  try { const cj = JSON.parse(ctxt); podePublicar = c.ok && (!cj?.error?.code || cj.error.code === 'ok'); } catch { /* ignore */ }
  return {
    rede: 'tiktok', status: 'conectado', nome_exibicao: u.display_name || u.username || null, avatar_url: u.avatar_url || null,
    pode_publicar: podePublicar, erro: podePublicar ? null : 'Conta conectada para leitura; falta a permissão de publicação de vídeos (Content Posting).',
  };
}

function aguardando(rede: string, envs: string[]): Resultado {
  const ok = envs.every((e) => !!Deno.env.get(e));
  return ok ? { rede, status: 'configurado', erro: null } : { rede, status: 'desconectado', erro: null };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const caller = await requireCaller(req, { user: 'admin' });
  if (caller instanceof Response) return caller;
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  try {
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
    const { data: contas } = await sb.from('video_contas_sociais').select('rede, handle');
    const handleTikTok = String((contas || []).find((c: any) => c.rede === 'tiktok')?.handle || '');
    const resultados: Resultado[] = [];
    try { resultados.push(await verificarTikTok(handleTikTok)); }
    catch (e) { resultados.push({ rede: 'tiktok', status: 'erro', erro: String((e as Error).message).slice(0, 300) }); }
    resultados.push(aguardando('youtube', ['YOUTUBE_API_KEY']));
    resultados.push(aguardando('instagram', ['INSTAGRAM_API_KEY']));

    const agora = new Date().toISOString();
    for (const r of resultados) {
      await sb.from('video_contas_sociais').update({
        status: r.status, nome_exibicao: r.nome_exibicao ?? null, avatar_url: r.avatar_url ?? null,
        pode_publicar: r.pode_publicar ?? false, erro: r.erro ?? null, verificado_em: agora, updated_at: agora,
      }).eq('rede', r.rede);
    }
    return json({ ok: true, resultados });
  } catch (e) {
    console.error('video-social-status', e);
    return json({ error: (e as Error).message || 'Falha ao verificar contas' }, 500);
  }
});

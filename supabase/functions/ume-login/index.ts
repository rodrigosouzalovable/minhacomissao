import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { z } from 'https://esm.sh/zod@3.23.8';
import { requireCaller } from '../_shared/auth-guard.ts';
import { type UmeAmbiente } from '../_shared/ume-api.ts';
import { entrarUme, sairUme, sessaoUme } from '../_shared/ume-sessao.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const Body = z.discriminatedUnion('acao', [
  z.object({ acao: z.literal('status') }),
  z.object({ acao: z.literal('sair') }),
  z.object({ acao: z.literal('entrar'), usuario: z.string().trim().min(1).max(200), senha: z.string().min(1).max(200) }),
]);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const caller = await requireCaller(req, { user: 'any' });
  if (caller instanceof Response) return caller;
  if (!caller.userId) return json({ error: 'não autenticado' }, 401);
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return json({ error: 'dados inválidos' }, 400);
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const amb: UmeAmbiente = Deno.env.get('UME_PRD_LIBERADO') === 'true' ? 'prd' : 'dev';
  try {
    const b = parsed.data;
    if (b.acao === 'sair') { await sairUme(db, caller.userId, amb); return json({ ativo: false }); }
    if (b.acao === 'status') {
      const s = await sessaoUme(db, caller.userId, amb);
      return json(s ? { ativo: true, usuario: s.username, expiraEm: s.expiraEm, ambiente: amb } : { ativo: false, ambiente: amb });
    }
    const r = await entrarUme(db, caller.userId, amb, b.usuario, b.senha);
    if (!r.ok) {
      console.warn('[ume-login] recusado', { status: r.status, motivo: r.motivo });
      const msg = r.status === 401 || /invalid_grant|credentials/i.test(r.motivo)
        ? 'Usuário ou senha da UME incorretos.'
        : `A UME recusou o login (${r.motivo}).`;
      return json({ ativo: false, error: msg });
    }
    return json({ ativo: true, usuario: r.username, expiraEm: r.expiraEm, ambiente: amb });
  } catch (e) {
    console.error('[ume-login] erro', String((e as Error)?.message || e));
    return json({ ativo: false, error: 'Não foi possível falar com a UME agora. Tente de novo.' });
  }
});

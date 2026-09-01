import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const CF_API = 'https://api.cloudflare.com/client/v4';

async function validar(token: string, accountId: string) {
  const verify = await fetch(`${CF_API}/user/tokens/verify`, {
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => null);
  const vj = await verify?.json().catch(() => ({}));
  if (!verify?.ok || vj?.success !== true) {
    return {
      ok: false,
      erro:
        'Token da Cloudflare inválido ou sem permissão. Crie em Cloudflare → My Profile → API Tokens → Create Token → "Edit Cloudflare Workers" (permissões: Account · Workers Scripts · Edit e User · User Details · Read).',
    };
  }

  const acc = await fetch(`${CF_API}/accounts/${accountId}`, {
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => null);
  const aj = await acc?.json().catch(() => ({}));
  if (!acc?.ok || aj?.success !== true) {
    return { ok: false, erro: 'Account ID não encontrado ou o token não tem acesso a essa conta.' };
  }

  let subdominio: string | null = null;
  try {
    const sub = await fetch(`${CF_API}/accounts/${accountId}/workers/subdomain`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const sj = await sub.json();
    if (sj?.success && sj?.result?.subdomain) subdominio = String(sj.result.subdomain);
  } catch (_) { /* opcional */ }

  return { ok: true, conta: aj?.result?.name ?? null, subdominio };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader) return json({ success: false, error: 'Não autenticado' }, 401);

    const url = Deno.env.get('SUPABASE_URL')!;
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ success: false, error: 'Sessão inválida' }, 401);

    const admin = createClient(url, service);
    const { data: ehAdmin } = await admin.rpc('has_role', { _user_id: user.id, _role: 'admin' });
    if (!ehAdmin) return json({ success: false, error: 'Apenas administradores' }, 403);

    const body = await req.json().catch(() => ({}));
    const acao = String(body?.acao ?? 'status');

    const { data: atual } = await admin
      .from('cloudflare_config')
      .select('*')
      .order('atualizado_em', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (acao === 'status') {
      return json({
        success: true,
        configurado: !!(atual?.api_token && atual?.account_id) ||
          !!(Deno.env.get('CLOUDFLARE_API_TOKEN') && Deno.env.get('CLOUDFLARE_ACCOUNT_ID')),
        origem: atual?.api_token ? 'painel' : 'segredo',
        account_id: atual?.account_id ?? Deno.env.get('CLOUDFLARE_ACCOUNT_ID') ?? '',
        subdominio: atual?.subdominio ?? '',
        token_preenchido: !!(atual?.api_token ?? Deno.env.get('CLOUDFLARE_API_TOKEN')),
        validado_em: atual?.validado_em ?? null,
      });
    }

    const accountId = String(body?.account_id ?? atual?.account_id ?? Deno.env.get('CLOUDFLARE_ACCOUNT_ID') ?? '').trim();
    const token = String(body?.api_token ?? '').trim() || atual?.api_token || Deno.env.get('CLOUDFLARE_API_TOKEN') || '';
    if (!token || !accountId) return json({ success: false, error: 'Informe o API Token e o Account ID.' }, 400);

    const r = await validar(token, accountId);
    if (!r.ok) return json({ success: false, error: r.erro }, 400);

    if (acao === 'testar') {
      return json({ success: true, conta: r.conta, subdominio: r.subdominio });
    }

    if (acao === 'salvar') {
      const payload = {
        api_token: token,
        account_id: accountId,
        subdominio: String(body?.subdominio ?? '').trim() || r.subdominio,
        validado_em: new Date().toISOString(),
        atualizado_em: new Date().toISOString(),
      };
      if (atual?.id) {
        const { error } = await admin.from('cloudflare_config').update(payload).eq('id', atual.id);
        if (error) return json({ success: false, error: error.message }, 500);
      } else {
        const { error } = await admin.from('cloudflare_config').insert(payload);
        if (error) return json({ success: false, error: error.message }, 500);
      }
      return json({ success: true, conta: r.conta, subdominio: payload.subdominio });
    }

    return json({ success: false, error: 'Ação inválida' }, 400);
  } catch (error: any) {
    console.error('site-cloudflare-config erro', error);
    return json({ success: false, error: error?.message ?? 'Erro inesperado' }, 500);
  }
});

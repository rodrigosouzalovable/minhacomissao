import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { gerarHtmlSite, type SiteData } from '../_shared/siteTemplate.ts';

const CF_API = 'https://api.cloudflare.com/client/v4';

const soDigitos = (v: unknown) => String(v ?? '').replace(/\D/g, '');

function slugify(v: string) {
  return v
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
}

function extrairCodigoMeta(v?: string | null) {
  const raw = String(v ?? '').trim();
  if (!raw) return null;
  const m = raw.match(/content\s*=\s*["']([^"']+)["']/i) || raw.match(/facebook-domain-verification=([\w-]+)/i);
  return (m ? m[1] : raw).trim() || null;
}

async function cfSubdomain(accountId: string, token: string, fallback: string | undefined) {
  try {
    const res = await fetch(`${CF_API}/accounts/${accountId}/workers/subdomain`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const j = await res.json();
    if (j?.success && j?.result?.subdomain) return String(j.result.subdomain);
  } catch (e) {
    console.error('cf subdomain lookup falhou', e);
  }
  return fallback ?? null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const token = Deno.env.get('CLOUDFLARE_API_TOKEN');
    const accountId = Deno.env.get('CLOUDFLARE_ACCOUNT_ID');
    if (!token || !accountId) {
      return json({ success: false, error: 'Cloudflare não configurado: faltam CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID.' }, 400);
    }

    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader) return json({ success: false, error: 'Não autenticado' }, 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return json({ success: false, error: 'Sessão inválida' }, 401);

    const body = await req.json().catch(() => ({}));
    const siteId: string | null = body?.id ?? null;
    const cnpj = soDigitos(body?.cnpj);
    const razao = String(body?.razao_social ?? '').trim();
    if (cnpj.length !== 14) return json({ success: false, error: 'CNPJ inválido.' }, 400);
    if (!razao) return json({ success: false, error: 'Razão social é obrigatória.' }, 400);

    const registro = {
      cnpj,
      razao_social: razao,
      nome_site: String(body?.nome_site ?? '').trim() || null,
      telefone: soDigitos(body?.telefone) || null,
      email: String(body?.email ?? '').trim() || null,
      endereco: String(body?.endereco ?? '').trim() || null,
      bairro: String(body?.bairro ?? '').trim() || null,
      cidade: String(body?.cidade ?? '').trim() || null,
      uf: String(body?.uf ?? '').trim().toUpperCase().slice(0, 2) || null,
      cep: soDigitos(body?.cep) || null,
      cnae: String(body?.cnae ?? '').trim() || null,
      abertura: String(body?.abertura ?? '').trim() || null,
      sobre: String(body?.sobre ?? '').trim() || null,
      foto_url: String(body?.foto_url ?? '').trim() || null,
      meta_verification: extrairCodigoMeta(body?.meta_verification),
    };

    // Registro existente (para reaproveitar o worker_name e manter a URL)
    let workerName: string | null = null;
    if (siteId) {
      const { data: existente } = await supabase.from('sites_gerados').select('worker_name').eq('id', siteId).maybeSingle();
      workerName = existente?.worker_name ?? null;
    }
    if (!workerName) {
      const sufixo = crypto.randomUUID().replace(/-/g, '').slice(0, 6);
      workerName = `${slugify(registro.nome_site || razao) || 'empresa'}-${sufixo}`;
    }

    const subdominio = await cfSubdomain(accountId, token, Deno.env.get('CLOUDFLARE_WORKERS_SUBDOMAIN') ?? undefined);
    if (!subdominio) {
      return json({ success: false, error: 'Não foi possível descobrir o subdomínio workers.dev da conta Cloudflare. Ative-o no painel Cloudflare (Workers → Subdomínio).' }, 400);
    }
    const url = `https://${workerName}.${subdominio}.workers.dev/`;

    const html = gerarHtmlSite({ ...registro, url } as SiteData);

    const script = `const HTML = ${JSON.stringify(html)};
export default {
  fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/robots.txt') {
      return new Response('User-agent: *\\nAllow: /\\n', { headers: { 'content-type': 'text/plain; charset=utf-8' } });
    }
    return new Response(HTML, {
      headers: { 'content-type': 'text/html;charset=utf-8', 'cache-control': 'public, max-age=60' },
    });
  },
};`;

    const form = new FormData();
    form.append(
      'metadata',
      new Blob([JSON.stringify({ main_module: 'index.js', compatibility_date: '2024-11-01' })], { type: 'application/json' }),
    );
    form.append('index.js', new Blob([script], { type: 'application/javascript+module' }), 'index.js');

    const up = await fetch(`${CF_API}/accounts/${accountId}/workers/scripts/${workerName}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    const upJson = await up.json().catch(() => ({}));
    if (!up.ok || upJson?.success === false) {
      const msg = upJson?.errors?.map((e: any) => e.message).join('; ') || `Cloudflare HTTP ${up.status}`;
      console.error('cloudflare upload falhou', msg);
      return json({ success: false, error: `Falha ao publicar na Cloudflare: ${msg}` }, 502);
    }

    const sub = await fetch(`${CF_API}/accounts/${accountId}/workers/scripts/${workerName}/subdomain`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: true, previews_enabled: false }),
    });
    if (!sub.ok) console.error('habilitar subdomain falhou', await sub.text());

    const payload = { ...registro, worker_name: workerName, url, status: 'live', publicado_em: new Date().toISOString() };
    const query = siteId
      ? supabase.from('sites_gerados').update(payload).eq('id', siteId).select('*').maybeSingle()
      : supabase.from('sites_gerados').insert({ ...payload, criado_por: userData.user.id }).select('*').maybeSingle();
    const { data: site, error } = await query;
    if (error) return json({ success: false, error: `Site publicado, mas falhou ao salvar: ${error.message}` }, 500);

    return json({ success: true, site, url });
  } catch (error: any) {
    console.error('site-publicar erro', error);
    return json({ success: false, error: error?.message ?? 'Erro inesperado' }, 500);
  }
});

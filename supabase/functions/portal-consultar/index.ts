import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { consultarUme } from '../_shared/ume-desconto.ts';
import { validPublicQuery, publicUmeWallet } from '../_shared/portal-public.ts';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

// Intentionally public: exact CPF/wallet only, minimum fields, no internal auth bypass.
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ success: false, message: 'Consulta inválida.' }, 405);
  try {
    const body = await req.json().catch(() => null);
    if (!body || !validPublicQuery(body.cpf, body.credor)) return json({ success: false, message: 'Confira o CPF e o credor informado.' });
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const url = Deno.env.get('SUPABASE_URL');
    if (!serviceKey || !url) return json({ success: false, message: 'Consulta temporariamente indisponível.' });
    const service = createClient(url, serviceKey, { auth: { persistSession: false } });
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('cf-connecting-ip') || 'unknown';
    // Keyed digest: never persist raw IPs or CPFs in the abuse guard.
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${serviceKey}:public-portal:${ip}`));
    const key = Array.from(new Uint8Array(digest), v => v.toString(16).padStart(2, '0')).join('');
    const { data: allowed, error: guardError } = await service.rpc('portal_reservar_consulta', { p_chave: key });
    if (guardError || allowed !== true) return json({ success: false, message: 'Muitas consultas em pouco tempo. Aguarde para tentar novamente ou fale com nossa equipe.' });
    const { data: wallet, error } = await service.rpc('portal_consultar_carteira', { p_cpf: body.cpf, p_credor: body.credor });
    if (error || !wallet) throw new Error('wallet_unavailable');
    if (body.credor === 'ume' && wallet.acordos.length === 0) {
      const consulta = await consultarUme(service, body.cpf, { perfil: 'essencial', horasCache: 12, aguardarCache: true });
      return json({ success: true, wallet: publicUmeWallet(consulta, []) });
    }
    if (body.credor === 'odres_cred') wallet.principalValidado = typeof wallet.principal === 'number' && wallet.principal > 0;
    return json({ success: true, wallet });
  } catch {
    // No provider payloads, identifiers or customer details in public errors/logs.
    return json({ success: false, message: 'Não foi possível consultar esta carteira agora. Tente novamente ou fale com nossa equipe. Isso não significa que não existe dívida.' });
  }
});
import { createClient } from 'npm:@supabase/supabase-js@2';

export interface CloudflareCreds {
  token: string | null;
  accountId: string | null;
  subdominio: string | null;
}

/**
 * Busca as credenciais da Cloudflare primeiro na tabela public.cloudflare_config
 * (editável pela aba "Meus Sites") e cai para os segredos do projeto como fallback.
 */
export async function getCloudflareCreds(): Promise<CloudflareCreds> {
  const envToken = Deno.env.get('CLOUDFLARE_API_TOKEN') ?? null;
  const envAccount = Deno.env.get('CLOUDFLARE_ACCOUNT_ID') ?? null;
  const envSub = Deno.env.get('CLOUDFLARE_WORKERS_SUBDOMAIN') ?? null;

  try {
    const url = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (url && serviceKey) {
      const admin = createClient(url, serviceKey);
      const { data } = await admin
        .from('cloudflare_config')
        .select('api_token, account_id, subdominio')
        .order('atualizado_em', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data?.api_token && data?.account_id) {
        return {
          token: data.api_token,
          accountId: data.account_id,
          subdominio: data.subdominio ?? envSub,
        };
      }
    }
  } catch (e) {
    console.error('getCloudflareCreds falhou, usando segredos', e);
  }

  return { token: envToken, accountId: envAccount, subdominio: envSub };
}

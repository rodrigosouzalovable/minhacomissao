// Escopo de instâncias Meta por usuário chamador.
// Retorna null quando não há restrição (cron/service role/admin) ou um Set de ids permitidos.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export async function idsInstanciasPermitidas(
  req: Request,
  service: any,
): Promise<Set<string> | null> {
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null; // chamada interna/cron

  // Service role key chamando diretamente: sem restrição.
  if (token === Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) return null;

  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || '';
  const asUser = createClient(Deno.env.get('SUPABASE_URL')!, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });

  const { data: userData } = await asUser.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) return new Set<string>(); // token inválido: nada visível

  const { data: admin } = await service.rpc('has_role', { _user_id: userId, _role: 'admin' });
  if (admin === true) return null;

  // Lista via RLS do próprio usuário.
  const { data: rows } = await asUser.from('meta_whatsapp_instances').select('id');
  return new Set<string>((rows || []).map((r: any) => r.id as string));
}

export function filtrarInstancias<T extends { id: string }>(
  instancias: T[] | null | undefined,
  permitidas: Set<string> | null,
): T[] {
  const lista = instancias || [];
  if (!permitidas) return lista;
  return lista.filter((i) => permitidas.has(i.id));
}

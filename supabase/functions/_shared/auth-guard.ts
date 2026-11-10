// Shared caller verification for edge functions.
// Accepts: the service-role key (internal function-to-function calls),
// a scheduler token registered in an active cron job (pg_cron), or a signed-in
// user whose role satisfies the requested level. Everything else is refused.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export type UserLevel = 'any' | 'staff' | 'admin';

export type Caller =
  | { kind: 'service'; userId: null; isAdmin: true; isGestor: true; token: string }
  | { kind: 'scheduler'; userId: null; isAdmin: true; isGestor: true; token: string }
  | { kind: 'user'; userId: string; isAdmin: boolean; isGestor: boolean; token: string; email: string | null };

export type GuardOptions = {
  /** Allow pg_cron jobs that carry a registered scheduler token. */
  scheduler?: boolean;
  /** Minimum role for signed-in users; false/undefined refuses users (admins are always accepted unless false). */
  user?: UserLevel | false;
  /** Screen paths (user_permissions.abas_permitidas) that grant access to non-admin users, mirroring PermissionRoute. */
  tabs?: string[];
  corsHeaders?: Record<string, string>;
};

const DEFAULT_CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

let serviceSingleton: any = null;
function service() {
  if (!serviceSingleton) {
    serviceSingleton = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false },
    });
  }
  return serviceSingleton;
}

export function bearerToken(req: Request): string {
  return (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
}

const schedulerCache = new Map<string, number>();
async function isSchedulerToken(token: string): Promise<boolean> {
  if (!token || token.length < 32 || token.startsWith('eyJ') || !/^[A-Za-z0-9_.-]+$/.test(token)) return false;
  const until = schedulerCache.get(token);
  if (until && until > Date.now()) return true;
  const { data, error } = await service().rpc('scheduler_token_autorizado', { p_token: token });
  if (error || data !== true) return false;
  schedulerCache.set(token, Date.now() + 5 * 60_000);
  return true;
}

/** Identifies the caller without enforcing anything. Returns null when unauthenticated. */
export async function identifyCaller(req: Request): Promise<Caller | null> {
  const token = bearerToken(req);
  if (!token) return null;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (serviceKey && token === serviceKey) return { kind: 'service', userId: null, isAdmin: true, isGestor: true, token };
  if (await isSchedulerToken(token)) return { kind: 'scheduler', userId: null, isAdmin: true, isGestor: true, token };
  if (!token.startsWith('eyJ')) return null;
  const { data, error } = await service().auth.getUser(token);
  const user = data?.user;
  if (error || !user?.id) return null;
  const { data: roles } = await service().from('user_roles').select('role').eq('user_id', user.id);
  const set = new Set((roles || []).map((r: any) => String(r.role)));
  const isAdmin = set.has('admin');
  return { kind: 'user', userId: user.id, isAdmin, isGestor: isAdmin || set.has('gestor'), token, email: user.email ?? null };
}

function deny(status: number, message: string, cors?: Record<string, string>) {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status,
    headers: { ...(cors || DEFAULT_CORS), 'Content-Type': 'application/json' },
  });
}

/** Returns the verified caller or a 401/403 Response to return as-is. */
export async function requireCaller(req: Request, opts: GuardOptions = {}): Promise<Caller | Response> {
  const caller = await identifyCaller(req);
  if (!caller) return deny(401, 'Não autorizado', opts.corsHeaders);
  if (caller.kind === 'service') return caller;
  if (caller.kind === 'scheduler') {
    return opts.scheduler ? caller : deny(403, 'Acesso não permitido', opts.corsHeaders);
  }
  const level = opts.user;
  if (level === false) return deny(403, 'Acesso não permitido', opts.corsHeaders);
  if (caller.isAdmin) return caller;
  if (opts.tabs && opts.tabs.length) {
    const { data: perm } = await service().from('user_permissions').select('abas_permitidas').eq('user_id', caller.userId).maybeSingle();
    const abas: string[] | null = perm?.abas_permitidas ?? null;
    if (abas ? opts.tabs.some((t) => abas.includes(t)) : caller.isGestor) return caller;
    return deny(403, 'Acesso não permitido para esta tela', opts.corsHeaders);
  }
  if (level === 'any') return caller;
  if (level === 'staff' && caller.isGestor) return caller;
  return deny(403, 'Acesso restrito ao administrador', opts.corsHeaders);
}

/** Supabase client acting as the signed-in caller, so RLS decides what they can see. */
export function asCaller(caller: Caller) {
  if (caller.kind !== 'user') return service();
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || '',
    { global: { headers: { Authorization: `Bearer ${caller.token}` } }, auth: { persistSession: false } },
  );
}

/** True when the caller can see every id in `table` under their own RLS (internal/admin callers always can). */
export async function callerCanSeeRows(caller: Caller, table: string, ids: Array<string | null | undefined>): Promise<boolean> {
  const wanted = [...new Set(ids.filter((i): i is string => !!i))];
  if (caller.kind !== 'user' || caller.isAdmin) return true;
  if (wanted.length === 0) return true;
  const { data, error } = await asCaller(caller).from(table).select('id').in('id', wanted);
  if (error) return false;
  return (data || []).length === wanted.length;
}

export function forbidden(message = 'Acesso não permitido', cors?: Record<string, string>) {
  return deny(403, message, cors);
}

/** Masks a phone/CPF for logs: keeps only the last 4 digits. */
export function mask(value: unknown): string {
  const s = String(value ?? '').replace(/\D/g, '');
  if (!s) return '';
  return `***${s.slice(-4)}`;
}

const normUrl = (u: unknown) => String(u ?? '').trim().replace(/\/+$/, '').toLowerCase();

/**
 * Resolves which UAZAPI server/token a send may use.
 * - Supplied token: must belong to an instance the caller can see (RLS); server URL is taken from that instance.
 * - No token: the company default number from env, ignoring any caller-supplied server URL.
 */
export async function resolverInstanciaUazapi(
  caller: Caller,
  serverUrl: string | null | undefined,
  instanceToken: string | null | undefined,
): Promise<{ ok: true; serverUrl: string; instanceToken: string } | { ok: false; status: number; error: string }> {
  const envUrl = Deno.env.get('UAZAPI_SERVER_URL') || '';
  const envToken = Deno.env.get('UAZAPI_INSTANCE_TOKEN') || '';
  if (!instanceToken) {
    return { ok: true, serverUrl: envUrl, instanceToken: envToken };
  }
  const client = caller.kind === 'user' && !caller.isAdmin ? asCaller(caller) : service();
  const { data } = await client
    .from('user_whatsapp_instances')
    .select('server_url')
    .eq('instance_token', instanceToken)
    .limit(1);
  const row = (data || [])[0];
  if (row?.server_url) {
    return { ok: true, serverUrl: String(row.server_url), instanceToken };
  }
  // Internal/admin callers may still use the company default credentials explicitly.
  if ((caller.kind !== 'user' || caller.isAdmin) && instanceToken === envToken) {
    return { ok: true, serverUrl: envUrl, instanceToken };
  }
  if ((caller.kind !== 'user' || caller.isAdmin) && serverUrl) {
    // Admin/internal using an unregistered instance: keep behavior but only toward the configured server host.
    try {
      const host = new URL(String(serverUrl)).host;
      const allowed = envUrl ? new URL(envUrl).host : '';
      if (host && (host === allowed || host.endsWith('.uazapi.com'))) {
        return { ok: true, serverUrl: String(serverUrl), instanceToken };
      }
    } catch { /* invalid URL */ }
  }
  return { ok: false, status: 403, error: 'Instância não autorizada para este usuário' };
}

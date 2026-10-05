import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export type MetaInboxSendAuth =
  | { ok: true; internal: boolean; userId: string | null }
  | { ok: false; status: 401 | 403; error: string };

export async function authorizeMetaInboxSend(
  req: Request,
  serviceClient: any,
  input: {
    instanciaId: string;
    recipient?: string | null;
    folderId?: string | null;
    allowNew?: boolean;
  },
): Promise<MetaInboxSendAuth> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (token && token === serviceKey) {
    return { ok: true, internal: true, userId: null };
  }
  if (!token) {
    return { ok: false, status: 401, error: 'Sessão necessária para responder esta conversa' };
  }

  const { data, error } = await serviceClient.auth.getUser(token);
  const userId = data.user?.id;
  if (error || !userId) {
    return { ok: false, status: 401, error: 'Sessão inválida ou expirada' };
  }

  const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') || '', {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: allowed, error: permissionError } = await userClient.rpc('can_send_meta_inbox_message', {
    _uid: userId,
    _contato_id: null,
    _instancia_id: input.instanciaId,
    _recipient: input.recipient || null,
    _folder_id: input.folderId || null,
    _allow_new: input.allowNew === true,
  });

  if (permissionError || allowed !== true) {
    return {
      ok: false,
      status: 403,
      error: 'Você não faz parte da caixa desta conversa e não pode responder por ela',
    };
  }

  return { ok: true, internal: false, userId };
}
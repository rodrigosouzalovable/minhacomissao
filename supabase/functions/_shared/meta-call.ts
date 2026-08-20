// Helpers compartilhados da WhatsApp Business Calling API (Cloud API oficial).
// A mídia é WebRTC direto entre o navegador do atendente e o WhatsApp do cliente;
// a Graph API só troca a sinalização (SDP).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const GRAPH = 'https://graph.facebook.com/v21.0';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export function service() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
}

/** Usuário autenticado que fez a chamada HTTP (null quando cron/service role). */
export async function userDaRequisicao(req: Request): Promise<string | null> {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token || token === Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) return null;
  const anon = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || '';
  const asUser = createClient(Deno.env.get('SUPABASE_URL')!, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data } = await asUser.auth.getUser();
  return data?.user?.id ?? null;
}

export type Instancia = {
  id: string;
  nome: string | null;
  phone_number_id: string;
  waba_id: string | null;
  access_token: string;
  display_phone: string | null;
  provider: string | null;
  chamadas_habilitadas: boolean | null;
};

export async function carregarInstancia(supabase: any, instanciaId: string): Promise<Instancia> {
  const { data, error } = await supabase
    .from('meta_whatsapp_instances')
    .select('id, nome, phone_number_id, waba_id, access_token, display_phone, provider, chamadas_habilitadas')
    .eq('id', instanciaId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Instância não encontrada');
  if ((data.provider || 'meta') !== 'meta') throw new Error('Chamadas de voz só funcionam em números da API oficial da Meta');
  if (!data.access_token || !data.phone_number_id) throw new Error('Instância sem credenciais da Meta');
  return data as Instancia;
}

/** Confere se o usuário pode operar aquela instância (RLS via função do banco). */
export async function podeUsarInstancia(supabase: any, userId: string | null, instanciaId: string) {
  if (!userId) return true; // chamada interna
  const { data } = await supabase.rpc('pode_ver_instancia_meta', { _uid: userId, _instancia: instanciaId });
  return data === true;
}

export function digitos(v?: string | null) {
  return String(v ?? '').replace(/\D/g, '');
}

/** POST /{phone_number_id}/calls */
export async function chamarGraph(inst: Instancia, body: Record<string, unknown>) {
  const res = await fetch(`${GRAPH}/${inst.phone_number_id}/calls`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${inst.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messaging_product: 'whatsapp', ...body }),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok && !data?.error, status: res.status, data };
}

/** Mensagem clara para os erros mais comuns da Calling API. */
export function humanizarErroChamada(data: any): string {
  const err = data?.error || {};
  const code = Number(err.code ?? 0);
  const sub = Number(err.error_subcode ?? 0);
  const msg = String(err.message || err.error_user_msg || 'Falha ao processar a chamada');

  if (code === 100 && /calling/i.test(msg)) {
    return 'A Calling API não está habilitada neste número. Ative "Chamadas" no app da Meta e nas configurações do número.';
  }
  if (code === 138006 || /permission/i.test(msg)) {
    return 'O cliente ainda não autorizou chamadas. Envie o pedido de permissão e aguarde o "Aceitar chamada".';
  }
  if (code === 138001) return 'O cliente está com chamadas desabilitadas no WhatsApp dele.';
  if (code === 138002) return 'O cliente já está em outra chamada.';
  if (code === 131047 || code === 131051) return 'Janela de conversa fechada — envie um template antes de ligar.';
  if (code === 190) return 'Token da instância expirado. Atualize o access token nas configurações.';
  if (sub) return `${msg} (código ${code}/${sub})`;
  return code ? `${msg} (código ${code})` : msg;
}

/** Custo estimado das chamadas de saída no Brasil (US$/min). */
export const CUSTO_USD_MINUTO = 0.017;

export function custoEstimado(duracaoSegundos: number, tipo: string) {
  if (tipo !== 'saida') return 0;
  const minutos = Math.ceil(Math.max(duracaoSegundos, 0) / 60);
  return Number((minutos * CUSTO_USD_MINUTO).toFixed(4));
}

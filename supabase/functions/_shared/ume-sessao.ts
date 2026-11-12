// Sessão UME por atendente: login no backoffice com usuário/senha dele.
// A senha nunca é salva; guardamos só os tokens, acessíveis apenas pelo servidor.
import { UME_BASES, UME_UA, type UmeAmbiente } from './ume-api.ts';

// deno-lint-ignore no-explicit-any
type Db = any;
// Login do atendente usa o mesmo acesso do site do backoffice (realm "analysts", cliente público "backoffice").
// Esse token só prova a identidade; a API de cobrança continua usando a conta da empresa.
const URL_TOKEN = (amb: UmeAmbiente) => `${UME_BASES[amb]}/keycloak/realms/analysts/protocol/openid-connect/token`;

export interface SessaoUme { token: string; username: string; expiraEm: string }

async function pedirToken(amb: UmeAmbiente, extra: Record<string, string>) {
  const resp = await fetch(URL_TOKEN(amb), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UME_UA },
    body: new URLSearchParams({ client_id: 'backoffice', ...extra }),
    signal: AbortSignal.timeout(15_000),
  });
  const txt = await resp.text();
  let j: Record<string, unknown> = {};
  try { j = JSON.parse(txt); } catch { /* ignore */ }
  return { ok: resp.ok, status: resp.status, j };
}

async function salvar(db: Db, userId: string, amb: UmeAmbiente, username: string, j: Record<string, unknown>) {
  const agora = Date.now();
  const acc = new Date(agora + Math.max(30, (Number(j.expires_in) || 300) - 30) * 1000).toISOString();
  const rex = Number(j.refresh_expires_in);
  const ref = j.refresh_token ? new Date(agora + Math.max(30, (rex > 0 ? rex : 1800) - 30) * 1000).toISOString() : null;
  await db.from('ume_sessoes_usuario').upsert({
    user_id: userId, ambiente: amb, ume_username: username,
    access_token: String(j.access_token), access_expira_em: acc,
    refresh_token: j.refresh_token ? String(j.refresh_token) : null, refresh_expira_em: ref,
    atualizado_em: new Date().toISOString(),
  });
  return { acc, ref };
}

export async function entrarUme(db: Db, userId: string, amb: UmeAmbiente, username: string, password: string) {
  const r = await pedirToken(amb, { grant_type: 'password', username, password });
  if (!r.ok || !r.j.access_token) {
    const motivo = String(r.j.error_description || r.j.error || `http_${r.status}`);
    return { ok: false as const, status: r.status, motivo };
  }
  const { acc, ref } = await salvar(db, userId, amb, username, r.j);
  return { ok: true as const, username, expiraEm: ref ?? acc };
}

export async function sairUme(db: Db, userId: string, amb: UmeAmbiente) {
  await db.from('ume_sessoes_usuario').delete().eq('user_id', userId).eq('ambiente', amb);
}

/** Sessão ativa do atendente (renova se preciso) ou null quando expirou. */
export async function sessaoUme(db: Db, userId: string, amb: UmeAmbiente): Promise<SessaoUme | null> {
  const { data: s } = await db.from('ume_sessoes_usuario').select('*').eq('user_id', userId).eq('ambiente', amb).maybeSingle();
  if (!s) return null;
  const agora = Date.now();
  if (new Date(s.access_expira_em).getTime() > agora) {
    return { token: s.access_token, username: s.ume_username, expiraEm: s.refresh_expira_em ?? s.access_expira_em };
  }
  if (s.refresh_token && s.refresh_expira_em && new Date(s.refresh_expira_em).getTime() > agora) {
    const r = await pedirToken(amb, { grant_type: 'refresh_token', refresh_token: s.refresh_token });
    if (r.ok && r.j.access_token) {
      const { acc, ref } = await salvar(db, userId, amb, s.ume_username, r.j);
      return { token: String(r.j.access_token), username: s.ume_username, expiraEm: ref ?? acc };
    }
  }
  await sairUme(db, userId, amb);
  return null;
}

export const MSG_LOGIN_UME = 'Faça login na UME (quadro "Login UME" da calculadora) para enviar.';

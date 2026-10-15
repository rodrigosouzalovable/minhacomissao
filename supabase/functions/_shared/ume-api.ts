// Cliente da API oficial da UME (Keycloak + BFF "saas-consultancy").
// Regras do manual: token reutilizado até expirar, header X-Authorization,
// sem chamadas em lote e no máximo 30 requisições por minuto.

export type UmeAmbiente = 'dev' | 'prd';

const BASES: Record<UmeAmbiente, string> = {
  dev: 'https://dev-api.ume.com.br',
  prd: 'https://api.ume.com.br',
};
const COORD = '/communications/saas-consultancy/coordinator/v1';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36';
export const UME_ASSESSORIA = 'Souza e Ribeiro';

// 30 req/min => 1 a cada 2s (margem: 2,1s), contando também o token.
const INTERVALO_MIN_MS = 2_100;
let proximaJanela = 0;
async function aguardarVez() {
  const agora = Date.now();
  const espera = Math.max(0, proximaJanela - agora);
  proximaJanela = Math.max(agora, proximaJanela) + INTERVALO_MIN_MS;
  if (espera > 0) await new Promise((r) => setTimeout(r, espera));
}

const tokens = new Map<UmeAmbiente, { token: string; expiraEm: number }>();

function credenciais(amb: UmeAmbiente) {
  const p = amb === 'dev' ? 'UME_DEV_' : 'UME_PRD_';
  const c = {
    client_id: Deno.env.get(`${p}CLIENT_ID`) ?? '',
    client_secret: Deno.env.get(`${p}CLIENT_SECRET`) ?? '',
    username: Deno.env.get(`${p}USERNAME`) ?? '',
    password: Deno.env.get(`${p}PASSWORD`) ?? '',
  };
  if (!c.client_id || !c.client_secret || !c.username || !c.password) throw new Error('ume_credenciais_ausentes');
  return c;
}

export async function obterTokenUme(amb: UmeAmbiente, forcar = false): Promise<string> {
  const atual = tokens.get(amb);
  if (!forcar && atual && atual.expiraEm > Date.now()) return atual.token;
  await aguardarVez();
  const resp = await fetch(`${BASES[amb]}/keycloak/realms/consultancy/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
    body: new URLSearchParams({ grant_type: 'password', ...credenciais(amb) }),
    signal: AbortSignal.timeout(15_000),
  });
  const txt = await resp.text();
  if (!resp.ok) throw new Error(`ume_auth_${resp.status}`);
  const j = JSON.parse(txt);
  const seg = Number(j.expires_in) || 300;
  // renova 60s antes de expirar
  tokens.set(amb, { token: j.access_token, expiraEm: Date.now() + Math.max(30, seg - 60) * 1000 });
  return j.access_token;
}

export interface UmeResposta { status: number; ok: boolean; data: unknown }

export async function chamarUme(
  amb: UmeAmbiente,
  metodo: 'GET' | 'POST',
  caminho: string,
  body?: unknown,
): Promise<UmeResposta> {
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    const token = await obterTokenUme(amb, tentativa > 0);
    await aguardarVez();
    const resp = await fetch(`${BASES[amb]}${COORD}${caminho}`, {
      method: metodo,
      headers: {
        'X-Authorization': `Bearer ${token}`,
        'User-Agent': UA,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20_000),
    });
    const txt = await resp.text();
    let data: unknown = null;
    try { data = txt ? JSON.parse(txt) : null; } catch { data = { raw: txt.slice(0, 2000) }; }
    if (resp.status === 401 && tentativa === 0) { tokens.delete(amb); continue; }
    return { status: resp.status, ok: resp.ok, data };
  }
  return { status: 401, ok: false, data: null };
}

export const umeApi = {
  simularBoletos: (amb: UmeAmbiente, idsOrdem: Array<string | number>, data: string) => {
    const qs = new URLSearchParams();
    idsOrdem.forEach((id, i) => qs.set(i === 0 ? 'id_order' : `id_order${i + 1}`, String(id)));
    qs.set('date', data);
    return chamarUme(amb, 'GET', `/contracts/simulate-multiple-installments?${qs}`);
  },
  gerarBoletos: (amb: UmeAmbiente, installmentsIds: number[], dueDate: string) =>
    chamarUme(amb, 'POST', '/invoices/multiple', { installmentsIds, dueDate, generatedAt: UME_ASSESSORIA }),
  gerarBoletoUnico: (amb: UmeAmbiente, borrowerId: string, dueDate: string) =>
    chamarUme(amb, 'POST', '/invoices/chatbot', { borrowerId, dueDate, generatedAt: UME_ASSESSORIA }),
  simularRenegociacao: (amb: UmeAmbiente, p: UmeRenegociacao) =>
    chamarUme(amb, 'POST', '/renegotiations/simulations', corpoReneg(p)),
  fecharAcordo: (amb: UmeAmbiente, p: UmeRenegociacao) =>
    chamarUme(amb, 'POST', '/renegotiations', corpoReneg(p)),
};

export interface UmeRenegociacao {
  monetaryDiscount: number;
  borrowerId: string;
  installmentsIds: number[];
  firstPaymentDueDate: string;
  numberOfPayments: number;
  interestRate: number;
}

// A API real valida "installmentIds" (o manual escreve "installmentsIds").
function corpoReneg(p: UmeRenegociacao) {
  const { installmentsIds, ...resto } = p;
  return { ...resto, installmentIds: installmentsIds, generatedAt: UME_ASSESSORIA };
}

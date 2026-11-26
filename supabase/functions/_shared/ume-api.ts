// Cliente da API oficial da UME (Keycloak + BFF "saas-consultancy").
// Regras do manual: token reutilizado até expirar, header X-Authorization,
// sem chamadas em lote e no máximo 30 requisições por minuto.

export type UmeAmbiente = 'dev' | 'prd';
/** Conta UME usada: 'padrao' = Souza e Ribeiro; 'amaral' = loja do parceiro Thiago Nogueira. */
export type UmeConta = 'padrao' | 'amaral';

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

const tokens = new Map<string, { token: string; expiraEm: number }>();

function credenciais(amb: UmeAmbiente, conta: UmeConta = 'padrao') {
  const p = (conta === 'amaral' ? 'UME_AMARAL_' : 'UME_') + (amb === 'dev' ? 'DEV_' : 'PRD_');
  const c = {
    client_id: Deno.env.get(`${p}CLIENT_ID`) ?? '',
    client_secret: Deno.env.get(`${p}CLIENT_SECRET`) ?? '',
    username: Deno.env.get(`${p}USERNAME`) ?? '',
    password: Deno.env.get(`${p}PASSWORD`) ?? '',
  };
  if (!c.client_id || !c.client_secret || !c.username || !c.password) throw new Error('ume_credenciais_ausentes');
  return c;
}

export async function obterTokenUme(amb: UmeAmbiente, forcar = false, conta: UmeConta = 'padrao'): Promise<string> {
  const chave = `${conta}:${amb}`;
  const atual = tokens.get(chave);
  if (!forcar && atual && atual.expiraEm > Date.now()) return atual.token;
  await aguardarVez();
  const resp = await fetch(`${BASES[amb]}/keycloak/realms/consultancy/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
    body: new URLSearchParams({ grant_type: 'password', ...credenciais(amb, conta) }),
    signal: AbortSignal.timeout(15_000),
  });
  const txt = await resp.text();
  if (!resp.ok) throw new Error(`ume_auth_${resp.status}`);
  const j = JSON.parse(txt);
  const seg = Number(j.expires_in) || 300;
  // renova 60s antes de expirar
  tokens.set(chave, { token: j.access_token, expiraEm: Date.now() + Math.max(30, seg - 60) * 1000 });
  return j.access_token;
}

export interface UmeResposta { status: number; ok: boolean; data: unknown }

// Alvo da chamada: conta da empresa (ambiente), conta de parceiro ou sessão de um atendente.
export type UmeAlvo = UmeAmbiente | { amb: UmeAmbiente; token?: string; conta?: UmeConta };
const ambDe = (a: UmeAlvo): UmeAmbiente => (typeof a === 'string' ? a : a.amb);
export const contaDe = (a: UmeAlvo): UmeConta => (typeof a === 'string' ? 'padrao' : a.conta ?? 'padrao');
/** Alvo da conta (sem login de atendente): conta padrão continua sendo só o ambiente. */
export const alvoConta = (amb: UmeAmbiente, conta: UmeConta = 'padrao'): UmeAlvo => (conta === 'padrao' ? amb : { amb, conta });

export const UME_BASES = BASES;
export const UME_UA = UA;
export function umeClient(amb: UmeAmbiente, conta: UmeConta = 'padrao') {
  const c = credenciais(amb, conta);
  return { client_id: c.client_id, client_secret: c.client_secret };
}

export async function chamarUme(
  alvo: UmeAlvo,
  metodo: 'GET' | 'POST',
  caminho: string,
  body?: unknown,
): Promise<UmeResposta> {
  const amb = ambDe(alvo);
  const tokenUsuario = typeof alvo === 'string' ? null : alvo.token ?? null;
  const conta = contaDe(alvo);
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    const token = tokenUsuario ?? await obterTokenUme(amb, tentativa > 0, conta);
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
    if (resp.status === 401 && tokenUsuario) throw new Error('ume_login_expirado');
    if (resp.status === 401 && tentativa === 0) { tokens.delete(`${conta}:${amb}`); continue; }
    return { status: resp.status, ok: resp.ok, data };
  }
  return { status: 401, ok: false, data: null };
}

export const umeApi = {
  simularBoletos: (amb: UmeAlvo, idsOrdem: Array<string | number>, data: string) => {
    // A API real espera os IDs separados por vírgula em um único parâmetro
    // "installmentsIds" (o manual cita id_order repetido).
    const qs = new URLSearchParams();
    qs.set('installmentsIds', idsOrdem.map(String).join(','));
    qs.set('date', data);
    return chamarUme(amb, 'GET', `/contracts/simulate-multiple-installments?${qs}`);
  },
  gerarBoletos: (amb: UmeAlvo, installmentsIds: Array<string | number>, dueDate: string, operador?: UmeOperador) =>
    comFallback(amb, (a) => chamarUme(a, 'POST', '/invoices/multiple', { installmentsIds: installmentsIds.map(String), dueDate, ...campoOperador(operador, contaDe(amb)) })),
  gerarBoletoUnico: (amb: UmeAlvo, borrowerId: string, dueDate: string, operador?: UmeOperador) =>
    comFallback(amb, (a) => chamarUme(a, 'POST', '/invoices/chatbot', { borrowerId, dueDate, ...campoOperador(operador, contaDe(amb)) })),
  simularRenegociacao: (amb: UmeAlvo, p: UmeRenegociacao) =>
    chamarUme(amb, 'POST', '/renegotiations/simulations', corpoReneg(p, contaDe(amb))),
  fecharAcordo: (amb: UmeAlvo, p: UmeRenegociacao) =>
    comFallback(amb, (a) => chamarUme(a, 'POST', '/renegotiations', corpoReneg(p, contaDe(amb)))),
  /** Acordo pelo mesmo caminho do backoffice, com o login do atendente: a UME grava ele como operador. Sem fallback para a conta da empresa. */
  fecharAcordoComoAtendente: (amb: UmeAmbiente, token: string, p: UmeRenegociacao) =>
    chamarBackoffice(amb, token, 'POST', '/collections/renegotiations', {
      customerId: p.borrowerId,
      installmentIds: p.installmentsIds.map(String),
      firstPaymentDueDate: p.firstPaymentDueDate,
      numberOfPayments: p.numberOfPayments,
      interestRate: p.interestRate,
      monetaryDiscount: p.monetaryDiscount,
    }),
};

// API do backoffice interno (a mesma do site backoffice.ume.com.br/v2), autenticada pelo login do atendente.
const BFF_BACKOFFICE: Record<UmeAmbiente, string> = {
  dev: 'https://dev-api.ume.com.br/operations/bff-internal-backoffice',
  prd: 'https://api.ume.com.br/operations/bff-internal-backoffice',
};
export async function chamarBackoffice(amb: UmeAmbiente, token: string, metodo: 'GET' | 'POST', caminho: string, body?: unknown): Promise<UmeResposta> {
  await aguardarVez();
  const resp = await fetch(`${BFF_BACKOFFICE[amb]}${caminho}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${token}`, 'User-Agent': UA, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30_000),
  });
  const txt = await resp.text();
  let data: unknown = null;
  try { data = txt ? JSON.parse(txt) : null; } catch { data = { raw: txt.slice(0, 2000) }; }
  if (data && typeof data === 'object' && !('message' in data) && 'detail' in data) {
    (data as Record<string, unknown>).message = (data as Record<string, unknown>).detail;
  }
  return { status: resp.status, ok: resp.ok, data };
}

export type UmeOperador = { nome: string; operatorId?: string };
export const UME_NOME_CONTA: Record<UmeConta, string> = { padrao: UME_ASSESSORIA, amaral: 'Amaral' };
const campoOperador = (o?: UmeOperador, conta: UmeConta = 'padrao') => ({ generatedAt: o?.nome || UME_NOME_CONTA[conta], ...(o?.operatorId ? { operatorId: o.operatorId } : {}) });
// Tenta com o login do atendente; se a UME recusar esse acesso (401/403), usa a conta da empresa
// mantendo o nome/código do operador no corpo.
async function comFallback(alvo: UmeAlvo, f: (a: UmeAlvo) => Promise<UmeResposta>): Promise<UmeResposta> {
  if (typeof alvo === 'string') return f(alvo);
  try {
    const r = await f(alvo);
    if (r.status !== 401 && r.status !== 403) return r;
    console.warn('[ume-api] login do atendente recusado', r.status);
  } catch (e) {
    if (String((e as Error)?.message) !== 'ume_login_expirado') throw e;
    console.warn('[ume-api] login do atendente expirado');
  }
  // Volta para a conta do próprio alvo; se a conta do parceiro também for recusada
  // (contrato de outra loja), emite pela conta da assessoria mantendo o operador no corpo.
  const conta = contaDe(alvo);
  const r2 = await f(alvoConta(alvo.amb, conta));
  if (conta === 'padrao' || (r2.status !== 401 && r2.status !== 403)) return r2;
  console.warn('[ume-api] conta do parceiro recusada, usando a assessoria', r2.status);
  return f(alvoConta(alvo.amb, 'padrao'));
}

export interface UmeRenegociacao {
  monetaryDiscount: number;
  borrowerId: string;
  installmentsIds: Array<string | number>;
  firstPaymentDueDate: string;
  numberOfPayments: number;
  interestRate: number;
  /** Operador real (login UME do atendente); padrão = conta da assessoria. */
  operador?: { nome: string; operatorId?: string };
}

// A API real valida "installmentIds" (o manual escreve "installmentsIds").
// IDs sempre como texto: números grandes podem chegar em notação científica.
function corpoReneg(p: UmeRenegociacao, conta: UmeConta = 'padrao') {
  const { installmentsIds, operador, ...resto } = p;
  return {
    ...resto,
    installmentIds: installmentsIds.map(String),
    generatedAt: operador?.nome || UME_NOME_CONTA[conta],
    ...(operador?.operatorId ? { operatorId: operador.operatorId } : {}),
  };
}

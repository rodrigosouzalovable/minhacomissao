// Repescagem da 1ª parcela (D+1 a D+3) de acordos ativos UME / Odres Cred.
// Puro (sem Deno/npm) para ser testado pelo vitest do projeto.

export const REPESCAGEM_TEMPLATE = 'nova_parcela_vencida_2';
export const REPESCAGEM_NOME = 'Repescagem 1ª parcela auto';
export const REPESCAGEM_DIAS = 3;

export type PrimeiraParcela = {
  numero_parcela: number | null;
  data_prevista: string; // yyyy-mm-dd
  valor_parcela: number | null;
  cliente_nome: string | null;
  cliente_telefone: string | null;
  cliente_cpf: string | null;
  empresa: string | null;
};

const dia = (iso: string) => new Date(`${iso}T12:00:00Z`);
const somar = (iso: string, n: number) => new Date(dia(iso).getTime() + n * 86400000).toISOString().slice(0, 10);

/** Vencimentos acionados hoje: ontem, anteontem e 3 dias atrás. Domingo não envia. */
export function datasRepescagem(hoje: string): string[] {
  if (dia(hoje).getUTCDay() === 0) return [];
  return Array.from({ length: REPESCAGEM_DIAS }, (_, i) => somar(hoje, -(i + 1)));
}

export function telefoneNormalizado(bruto: string | null): string | null {
  let tel = String(bruto || '').replace(/\D/g, '');
  if (tel.length < 10 || tel.length > 13) return null;
  if (!tel.startsWith('55')) tel = `55${tel}`;
  return tel.length < 12 ? null : tel;
}

const primeiroNome = (n: string) => {
  const p = n.trim().split(/\s+/)[0] || 'cliente';
  return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
};

/** Só a 1ª parcela, um envio por telefone (sufixo 8 dígitos) por dia; ignora sufixos excluídos. */
export function montarClientesRepescagem(rows: PrimeiraParcela[], hoje: string, excluir: Set<string>) {
  const datas = new Set(datasRepescagem(hoje));
  const porSufixo = new Map<string, { telefone: string; nome: string; cpf?: string; saldo: number; vars: Record<string, string> }>();
  for (const r of rows) {
    if (Number(r.numero_parcela) !== 1 || !datas.has(r.data_prevista)) continue;
    if (r.empresa !== 'ume_novo_mundo' && r.empresa !== 'odres_cred') continue;
    const tel = telefoneNormalizado(r.cliente_telefone);
    if (!tel) continue;
    const suf = tel.slice(-8);
    if (excluir.has(suf) || porSufixo.has(suf)) continue;
    const nome = primeiroNome(r.cliente_nome || 'cliente');
    porSufixo.set(suf, { telefone: tel, nome, cpf: r.cliente_cpf || undefined, saldo: Number(r.valor_parcela || 0),
      vars: { name: nome, nome, '1': nome } });
  }
  return [...porSufixo.values()];
}

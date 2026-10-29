// Seleção dos clientes com parcela vencida e não paga para a campanha de recuperação.
export type ParcelaVencida = {
  acordo_id: string;
  data_prevista: string; // yyyy-mm-dd
  valor_parcela: number | null;
  cliente_nome: string | null;
  cliente_telefone: string | null;
  cliente_cpf: string | null;
  empresa: string | null;
};

export type ClienteRecuperacao = {
  telefone: string;
  nome: string;
  cpf?: string;
  saldo: number;
  credor: string;
  vencimento: string;
  vars: Record<string, string>;
};

export const CREDOR_LABEL: Record<string, string> = {
  ume_novo_mundo: 'UME',
  odres_cred: 'Odres Cred',
};

const primeiroNome = (n: string) => {
  const p = n.trim().split(/\s+/)[0] || 'cliente';
  return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
};

const brData = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

/** Um envio por telefone (sufixo 8 dígitos), usando a parcela vencida mais recente. */
export function montarClientesRecuperacao(rows: ParcelaVencida[]): ClienteRecuperacao[] {
  const porSufixo = new Map<string, ClienteRecuperacao>();
  const ordenadas = [...rows].sort((a, b) => b.data_prevista.localeCompare(a.data_prevista));
  for (const r of ordenadas) {
    let tel = String(r.cliente_telefone || '').replace(/\D/g, '');
    if (tel.length < 10 || tel.length > 13) continue;
    if (!tel.startsWith('55')) tel = `55${tel}`;
    if (tel.length < 12) continue;
    const suf = tel.slice(-8);
    const credor = CREDOR_LABEL[r.empresa || ''] || r.empresa || '';
    const atual = porSufixo.get(suf);
    if (atual) { atual.saldo += Number(r.valor_parcela || 0); continue; }
    const nome = primeiroNome(r.cliente_nome || 'cliente');
    const venc = brData(r.data_prevista);
    porSufixo.set(suf, {
      telefone: tel, nome, cpf: r.cliente_cpf || undefined,
      saldo: Number(r.valor_parcela || 0), credor, vencimento: venc,
      vars: { name: nome, nome, '1': nome, '2': credor, '3': venc },
    });
  }
  return [...porSufixo.values()];
}

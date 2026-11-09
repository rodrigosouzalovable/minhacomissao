// Regras do lembrete preventivo (D-1) de parcelas de acordos ativos.
// Puro (sem Deno/npm) para ser testado pelo vitest do projeto.

export type ParcelaAVencer = {
  data_prevista: string; // yyyy-mm-dd
  valor_parcela: number | null;
  cliente_nome: string | null;
  cliente_telefone: string | null;
  cliente_cpf: string | null;
  empresa: string | null;
};

export type ClientePreventivo = {
  telefone: string;
  nome: string;
  cpf?: string;
  saldo: number;
  vars: Record<string, string>;
};

// Mesmos rótulos usados pelos lembretes de atraso com este template.
export const CREDOR_PREVENTIVO: Record<string, string> = {
  ume_novo_mundo: 'NOVO MUNDO',
  mundo_da_moda: 'UME',
  odres_cred: 'ODRES CRED',
};

const DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const dia = (iso: string) => new Date(`${iso}T12:00:00Z`);
const somar = (iso: string, n: number) => new Date(dia(iso).getTime() + n * 86400000).toISOString().slice(0, 10);

/** Vencimentos lembrados hoje: amanhã; no sábado também segunda (domingo não envia). */
export function datasAlvoPreventivo(hoje: string): string[] {
  const semana = dia(hoje).getUTCDay();
  if (semana === 0) return [];
  return semana === 6 ? [somar(hoje, 1), somar(hoje, 2)] : [somar(hoje, 1)];
}

/** Texto do {{3}}: "10/11/2026 (amanhã)" ou "16/11/2026 (segunda-feira)". */
export function rotuloVencimento(venc: string, hoje: string): string {
  const [y, m, d] = venc.split('-');
  const quando = venc === somar(hoje, 1) ? 'amanhã' : DIAS[dia(venc).getUTCDay()];
  return `${d}/${m}/${y} (${quando})`;
}

const primeiroNome = (n: string) => {
  const p = n.trim().split(/\s+/)[0] || 'cliente';
  return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
};

/** Um envio por telefone (sufixo 8 dígitos), pela parcela que vence primeiro; ignora sufixos já acionados. */
export function montarClientesPreventivo(rows: ParcelaAVencer[], hoje: string, excluir: Set<string>): ClientePreventivo[] {
  const porSufixo = new Map<string, ClientePreventivo>();
  const ordenadas = [...rows].sort((a, b) => a.data_prevista.localeCompare(b.data_prevista));
  for (const r of ordenadas) {
    const credor = CREDOR_PREVENTIVO[r.empresa || ''];
    if (!credor) continue;
    let tel = String(r.cliente_telefone || '').replace(/\D/g, '');
    if (tel.length < 10 || tel.length > 13) continue;
    if (!tel.startsWith('55')) tel = `55${tel}`;
    if (tel.length < 12) continue;
    const suf = tel.slice(-8);
    if (excluir.has(suf)) continue;
    const atual = porSufixo.get(suf);
    if (atual) { atual.saldo += Number(r.valor_parcela || 0); continue; }
    const nome = primeiroNome(r.cliente_nome || 'cliente');
    const venc = rotuloVencimento(r.data_prevista, hoje);
    porSufixo.set(suf, {
      telefone: tel, nome, cpf: r.cliente_cpf || undefined, saldo: Number(r.valor_parcela || 0),
      vars: { name: nome, nome, '1': nome, '2': credor, '3': venc },
    });
  }
  return [...porSufixo.values()];
}

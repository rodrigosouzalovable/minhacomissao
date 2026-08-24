// Consulta a calculadora de desconto da UME (relatório público do Looker Studio)
// diretamente por HTTP, sem navegador e sem login, e devolve os dados normalizados.
import { UME_REQUEST_TEMPLATES, UME_BATCH_URL } from './ume-looker-templates.ts';

export interface UmeParcela {
  parcelas: number;
  valorParcela: number;
}

export interface UmeTabela {
  parcelas: UmeParcela[];
  totalAte3x: number | null;
  total4xMais: number | null;
}

export interface UmeConsulta {
  encontrado: boolean;
  cpf: string;
  borrowerId: string;
  telefone: string;
  nome: string;
  diasAtraso: number | null;
  fase: string;
  limiteTotal: number | null;
  valorSemJuros: number | null;
  valorComJuros: number | null;
  padrao: UmeTabela;
  especial: UmeTabela;
  consultadoEm: string;
  doCache?: boolean;
}

const ORDEM = [
  'cliente',
  'limites',
  'padrao',
  'especial',
  'padrao_ate3x',
  'padrao_4xmais',
  'especial_ate3x',
  'especial_4xmais',
] as const;

export const soDigitos = (v: unknown) => String(v ?? '').replace(/\D/g, '');

function colunas(resp: any): Array<Array<string | number>> {
  const ds = resp?.dataSubset?.[0]?.dataset?.tableDataset;
  if (!ds?.column) return [];
  return ds.column.map((col: any) => {
    const chave = Object.keys(col).find((k) => k.endsWith('Column'));
    return chave ? (col[chave]?.values ?? []) : [];
  });
}

const num = (v: unknown): number | null => {
  if (v == null || v === '') return null;
  const n = Number(String(v).replace(/[^\d.,-]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

function montarTabela(valores: Array<Array<string | number>>, ate3x: number | null, quatroMais: number | null): UmeTabela {
  const parcelas: UmeParcela[] = [];
  valores.forEach((col, idx) => {
    const v = num(col?.[0]);
    if (v != null && v > 0) parcelas.push({ parcelas: idx + 1, valorParcela: v });
  });
  return { parcelas, totalAte3x: ate3x, total4xMais: quatroMais };
}

/** Consulta o relatório UME. Lança erro identificado se o layout mudar. */
export async function consultarUmeDireto(cpfBruto: string): Promise<UmeConsulta> {
  const cpf = soDigitos(cpfBruto);
  if (cpf.length !== 11) throw new Error('cpf_invalido');

  const dataRequest = ORDEM.map((chave) => {
    const tpl = UME_REQUEST_TEMPLATES[chave];
    if (!tpl) throw new Error('layout_ume_mudou');
    return JSON.parse(JSON.stringify(tpl).replace(/__CPF__/g, cpf));
  });

  const res = await fetch(UME_BATCH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36',
    },
    body: JSON.stringify({ dataRequest }),
  });
  const txt = await res.text();
  if (!res.ok) throw new Error(`ume_http_${res.status}: ${txt.slice(0, 200)}`);
  const ini = txt.indexOf('{');
  if (ini < 0) throw new Error('layout_ume_mudou');
  let json: any;
  try { json = JSON.parse(txt.slice(ini)); } catch { throw new Error('layout_ume_mudou'); }
  const respostas = json?.dataResponse;
  if (!Array.isArray(respostas) || respostas.length !== ORDEM.length) throw new Error('layout_ume_mudou');

  const por: Record<string, Array<Array<string | number>>> = {};
  ORDEM.forEach((chave, i) => { por[chave] = colunas(respostas[i]); });

  const cli = por.cliente;
  const cpfRet = String(cli?.[0]?.[0] ?? '');
  const encontrado = soDigitos(cpfRet) === cpf;

  const lim = por.limites;
  const escalar = (arr: Array<Array<string | number>>, i: number) => num(arr?.[i]?.[0]);

  const consulta: UmeConsulta = {
    encontrado,
    cpf,
    borrowerId: String(cli?.[1]?.[0] ?? ''),
    telefone: soDigitos(cli?.[2]?.[0] ?? ''),
    nome: String(cli?.[3]?.[0] ?? '').trim(),
    diasAtraso: escalar(cli, 4),
    fase: String(cli?.[5]?.[0] ?? '').trim(),
    limiteTotal: escalar(lim, 0),
    valorSemJuros: escalar(lim, 1),
    valorComJuros: escalar(lim, 2),
    padrao: montarTabela(por.padrao, escalar(por.padrao_ate3x, 0), escalar(por.padrao_4xmais, 0)),
    especial: montarTabela(por.especial, escalar(por.especial_ate3x, 0), escalar(por.especial_4xmais, 0)),
    consultadoEm: new Date().toISOString(),
  };

  return consulta;
}

/** Consulta com cache no banco (padrão 12h). */
export async function consultarUme(
  supabase: any,
  cpfBruto: string,
  opts?: { horasCache?: number; forcar?: boolean },
): Promise<UmeConsulta> {
  const cpf = soDigitos(cpfBruto);
  if (cpf.length !== 11) throw new Error('cpf_invalido');
  const horas = opts?.horasCache ?? 12;

  if (!opts?.forcar) {
    const { data } = await supabase
      .from('ume_consultas_cache')
      .select('payload, atualizado_em')
      .eq('cpf', cpf)
      .maybeSingle();
    if (data?.payload && data?.atualizado_em) {
      const idade = Date.now() - new Date(data.atualizado_em).getTime();
      if (idade < horas * 3600_000) return { ...(data.payload as UmeConsulta), doCache: true };
    }
  }

  const consulta = await consultarUmeDireto(cpf);
  try {
    await supabase.from('ume_consultas_cache').upsert({
      cpf,
      payload: consulta,
      encontrado: consulta.encontrado,
      atualizado_em: new Date().toISOString(),
    }, { onConflict: 'cpf' });
  } catch (e) {
    console.error('[UME] falha ao gravar cache', e);
  }
  return consulta;
}

/**
 * Converte a consulta UME no mesmo formato de proposta usado pelo IAGO.
 * Parcela mínima R$ 100. `tabela` = 'padrao' | 'especial'.
 */
export function propostaDaUme(
  c: UmeConsulta,
  tabela: 'padrao' | 'especial' = 'padrao',
  parcelaMinima = 100,
): {
  total: number;
  credor: string;
  nomeCliente: string;
  valorAvista: number;
  descAvistaPct: number;
  descParceladoPct: number;
  opcoes: UmeParcela[];
  totalParcelado: number;
  fonte: 'ume';
} | null {
  if (!c.encontrado) return null;
  const t = tabela === 'especial' ? c.especial : c.padrao;
  const avista = t.parcelas.find((p) => p.parcelas === 1)?.valorParcela ?? null;
  const total = c.valorComJuros ?? c.valorSemJuros ?? null;
  if (!avista || !total) return null;

  const opcoes = t.parcelas.filter((p) => p.parcelas >= 2 && p.valorParcela >= parcelaMinima);
  const totalParcelado = t.total4xMais ?? t.totalAte3x ?? total;
  const pct = (valor: number) => Math.max(0, Math.round((1 - valor / total) * 100));

  return {
    total,
    credor: 'UME',
    nomeCliente: c.nome,
    valorAvista: avista,
    descAvistaPct: pct(avista),
    descParceladoPct: pct(totalParcelado),
    opcoes,
    totalParcelado,
    fonte: 'ume',
  };
}

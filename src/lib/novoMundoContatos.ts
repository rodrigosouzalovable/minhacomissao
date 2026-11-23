import { conferirContatosNovoMundo as conferirDados } from '../../supabase/functions/_shared/novo-mundo-contatos-rules';
export { capacidadeNovoMundo, NOVO_MUNDO_MAX, NOVO_MUNDO_AVISO } from '../../supabase/functions/_shared/novo-mundo-contatos-rules';
export type { NovoMundoContato } from '../../supabase/functions/_shared/novo-mundo-contatos-rules';

export type PapelColunaNM = 'telefone' | 'nome' | 'saudacao' | 'ignorar';
export const SAUDACOES_NM = ['tudo bem?', 'como vai, tudo bem?'];

const celula = (v: unknown) => String(v ?? '').trim();
const pareceTelefone = (v: string) => /^\+?[\d\s().-]{8,}$/.test(v) && v.replace(/\D/g, '').length >= 10;

/** Primeira linha é cabeçalho quando nenhuma célula parece telefone e há texto. */
export function primeiraLinhaCabecalhoNM(rows: unknown[][]): boolean {
  const first = (rows[0] ?? []).map(celula);
  return first.some(Boolean) && !first.some(pareceTelefone);
}

/** Sugere o papel de cada coluna pelo cabeçalho ou pelas amostras. */
export function sugerirPapeisNM(rows: unknown[][], temCabecalho: boolean): PapelColunaNM[] {
  const largura = Math.max(0, ...rows.slice(0, 50).map(r => r.length));
  const header = temCabecalho ? (rows[0] ?? []).map(celula) : [];
  const amostras = rows.slice(temCabecalho ? 1 : 0, 51);
  const papeis: PapelColunaNM[] = [];
  for (let c = 0; c < largura; c++) {
    const h = header[c] || '';
    let p: PapelColunaNM = 'ignorar';
    if (/telefone|celular|whats|fone|phone|n[uú]mero/i.test(h)) p = 'telefone';
    else if (/sauda|\{\{\s*1\s*\}\}/i.test(h)) p = 'saudacao';
    else if (/nome|cliente|contato|\{\{\s*2\s*\}\}/i.test(h)) p = 'nome';
    else {
      const vals = amostras.map(r => celula(r[c])).filter(Boolean);
      if (vals.length && vals.filter(pareceTelefone).length / vals.length > 0.6) p = 'telefone';
      else if (vals.length && vals.filter(v => /[a-zà-ú]{2,}/i.test(v)).length / vals.length > 0.6) p = 'nome';
    }
    if (p !== 'ignorar' && papeis.includes(p)) p = 'ignorar';
    papeis.push(p);
  }
  return papeis;
}

/** Acrescenta 55 a números brasileiros com DDD (10/11 dígitos). */
export function telefoneCom55(v: unknown): string {
  const d = String(v ?? '').replace(/\D/g, '');
  return d.length === 10 || d.length === 11 ? `55${d}` : d;
}

/** Saudação estável por telefone (alterna os modelos sem gerar conflito em repetidos). */
export function saudacaoPadraoNM(telefone: string): string {
  const fim = Number(telefone.replace(/\D/g, '').slice(-1)) || 0;
  return SAUDACOES_NM[fim % SAUDACOES_NM.length];
}

export function conferirContatosNovoMundo(rows: unknown[][], papeis: PapelColunaNM[], temCabecalho: boolean) {
  const iTel = papeis.indexOf('telefone');
  const iNome = papeis.indexOf('nome');
  const iSaud = papeis.indexOf('saudacao');
  if (iTel < 0 || iNome < 0) throw new Error('Marque qual coluna é o Telefone e qual é o Nome.');
  const dados = (temCabecalho ? rows.slice(1) : rows).map(r => {
    const tel = telefoneCom55(r[iTel]);
    const saud = iSaud >= 0 ? celula(r[iSaud]) : '';
    return [tel, saud || (tel ? saudacaoPadraoNM(tel) : ''), celula(r[iNome])];
  });
  return { ...conferirDados(dados), headers: temCabecalho ? (rows[0] ?? []).map(celula) : null };
}

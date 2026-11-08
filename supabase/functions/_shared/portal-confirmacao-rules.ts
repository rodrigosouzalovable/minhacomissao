export const MAX_TENTATIVAS_CONFIRMACAO = 4;

export interface CandidataConfirmacao { instancia: string; template: string; ativo: boolean; quality: string; status: string; sufixo: string }

/** Ordem: 3144 (só na 1ª) → números que já falaram com o cliente → exclusivo do credor → demais GREEN. */
export function ordenarCandidatasConfirmacao(
  lista: CandidataConfirmacao[],
  o: { principal: string; recentes: string[]; exclusivaSufixo: string | null; excluidas: string[] },
): { instancia: string; template: string }[] {
  const saudavel = (c: CandidataConfirmacao) => c.ativo && c.status === 'CONNECTED' && c.quality === 'GREEN';
  const disp = lista.filter((c) => !o.excluidas.includes(c.instancia));
  const peso = (c: CandidataConfirmacao) => {
    if (o.excluidas.length === 0 && c.instancia === o.principal) return 0;
    const ir = o.recentes.indexOf(c.instancia);
    if (ir >= 0 && c.ativo && c.status === 'CONNECTED') return 1 + ir / 10;
    if (o.exclusivaSufixo && c.sufixo === o.exclusivaSufixo && saudavel(c)) return 2;
    if (saudavel(c)) return 3;
    return 99;
  };
  return disp.map((c) => ({ c, p: peso(c) })).filter((x) => x.p < 99).sort((a, b) => a.p - b.p)
    .map(({ c }) => ({ instancia: c.instancia, template: c.template }));
}

export const TEMPLATE_CONFIRMACAO_NOVO = 'confirmacao_formalizacao_acordo';
export const TEMPLATE_CONFIRMACAO_ANTIGO = 'confirmacao_acordo_portal';
export const TEMPLATES_CONFIRMACAO = [TEMPLATE_CONFIRMACAO_NOVO, TEMPLATE_CONFIRMACAO_ANTIGO];

/** Uma candidata por instância, preferindo o template novo quando aprovado nela. */
export function preferirTemplateNovo<T extends { instancia: string; nome: string }>(lista: T[]): T[] {
  const m = new Map<string, T>();
  for (const t of lista) {
    const a = m.get(t.instancia);
    if (!a || (t.nome === TEMPLATE_CONFIRMACAO_NOVO && a.nome !== TEMPLATE_CONFIRMACAO_NOVO)) m.set(t.instancia, t);
  }
  return [...m.values()];
}

const brl = (v: number) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dbr = (d: string) => String(d).slice(0, 10).split('-').reverse().join('/');

export function credorComArtigo(credor?: string): string {
  const s = String(credor || '').toLowerCase();
  if (/odres/.test(s)) return 'a Odres Cred';
  if (/ume/.test(s)) return 'a UME';
  if (/novo|mundo/.test(s)) return 'a Novo Mundo';
  return String(credor || 'o credor');
}

export function condicaoAcordo(parcelas: number, valor: number, venc: string): string {
  return Number(parcelas) === 1
    ? `1 parcela no valor de R$ ${brl(valor)}, com vencimento em ${dbr(venc)}`
    : `${parcelas} parcelas mensais de R$ ${brl(valor)}, com primeiro vencimento em ${dbr(venc)}`;
}

export function cpfFormatado(cpf?: string): string {
  const d = String(cpf || '').replace(/\D/g, '');
  return d.length === 11 ? d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4') : String(cpf || '');
}

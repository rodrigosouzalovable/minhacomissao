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

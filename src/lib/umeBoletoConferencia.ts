/** Confere se o boleto gerado pela UME corresponde à 1ª parcela combinada. */
export function conferirBoletoUme(
  boleto: { valor: number | null; vencimento: string | null },
  esperado: { valorParcela: number; vencimento: string },
): string | null {
  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const d = (s: string) => s.slice(0, 10).split('-').reverse().join('/');
  if (boleto.valor == null || Math.abs(boleto.valor - esperado.valorParcela) > 1) {
    return `A UME gerou boleto de ${boleto.valor == null ? 'valor desconhecido' : fmt(boleto.valor)}, mas a 1ª parcela combinada é ${fmt(esperado.valorParcela)}. O acordo provavelmente não foi efetivado no backoffice — efetive e clique em Atualizar. Nada foi enviado ao cliente.`;
  }
  if (boleto.vencimento && boleto.vencimento.slice(0, 10) !== esperado.vencimento.slice(0, 10)) {
    return `A UME gerou boleto com vencimento ${d(boleto.vencimento)}, mas o 1º vencimento combinado é ${d(esperado.vencimento)}. Confira o acordo no backoffice e clique em Atualizar. Nada foi enviado ao cliente.`;
  }
  return null;
}

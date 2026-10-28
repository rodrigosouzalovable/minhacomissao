// Monta a variável {{2}} (proposta à vista + parcelado) a partir do principal em aberto do SFTP UME/Odres.
export const ACRESCIMO_PARCELADO = 0.1;
export const MAX_PARCELAS = 18;
export const PARCELA_MINIMA_PROPOSTA = 100;

const brl = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const arred = (n: number) => Math.round(n * 100) / 100;

export function calcularProposta(principal: number) {
  const aVista = arred(principal);
  const totalParcelado = arred(principal * (1 + ACRESCIMO_PARCELADO));
  let n = 0;
  for (let i = MAX_PARCELAS; i >= 2; i--) {
    if (totalParcelado / i >= PARCELA_MINIMA_PROPOSTA) { n = i; break; }
  }
  return { aVista, parcelas: n, valorParcela: n ? arred(totalParcelado / n) : 0 };
}

export function textoProposta(principal: number, credor: 'odres' | 'ume'): string {
  const { aVista, parcelas, valorParcela } = calcularProposta(principal);
  const parc = parcelas ? ` ou parcele em até ${parcelas}x de R$ ${brl(valorParcela)}` : '';
  if (credor === 'odres') {
    return `Odres Cred referente ao seu telefone. Quite à vista por apenas R$ ${brl(aVista)}${parc}. Pagando a 1ª no PIX seu aparelho desbloqueia na hora!`;
  }
  return `UME. Quite à vista por apenas R$ ${brl(aVista)}${parc}. Pague a 1ª no PIX e regularize na hora!`;
}

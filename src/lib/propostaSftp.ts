// Monta a variável {{2}} (proposta à vista + parcelado) a partir do principal em aberto do SFTP UME/Odres.
export const ACRESCIMO_PARCELADO = 0.1;
export const MAX_PARCELAS = 18;
export const PARCELA_MINIMA_PROPOSTA = 100;

export type CredorProposta = 'odres' | 'ume';

// Modelos editáveis. O trecho entre [ ] só aparece quando a dívida permite parcelar (2x de R$ 100 ou mais).
export const MODELOS_PADRAO: Record<CredorProposta, string> = {
  odres: 'Odres Cred referente ao seu telefone. Quite à vista por apenas R$ {avista}[ ou parcele em até {parcelas}x de R$ {valor_parcela}]. Pagando a 1ª no PIX seu aparelho desbloqueia na hora!',
  ume: 'UME com condições especiais de final de ano. Quite à vista por R$ {avista}[ ou parcele em até {parcelas}x de R$ {valor_parcela}]. Pague a 1ª no PIX e volte a comprar a prazo!',
};

export const TEXTOS_SEM_DIVIDA: Record<CredorProposta, string> = {
  odres: '*Odres Cred referente ao seu telefone. Pagando a 1ª no PIX seu aparelho desbloqueia na hora!*',
  ume: '*UME com condições especiais de final de ano. Pague a 1ª no PIX e volte a comprar a prazo!*',
};

export const textoSemDivida = (credor: CredorProposta) => TEXTOS_SEM_DIVIDA[credor];

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

export function aplicarModelo(principal: number, modelo: string): string {
  const { aVista, parcelas, valorParcela } = calcularProposta(principal);
  return modelo
    .replace(/\[([^\]]*)\]/g, (_, trecho) => (parcelas ? trecho : ''))
    .replace(/\{avista\}/g, brl(aVista))
    .replace(/\{parcelas\}/g, String(parcelas))
    .replace(/\{valor_parcela\}/g, brl(valorParcela))
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// O texto inteiro sai entre asteriscos para ficar em negrito no WhatsApp.
export function textoProposta(principal: number, credor: CredorProposta, modelo?: string): string {
  const t = aplicarModelo(principal, modelo ?? MODELOS_PADRAO[credor]).replace(/^\*+|\*+$/g, '').trim();
  return `*${t}*`;
}

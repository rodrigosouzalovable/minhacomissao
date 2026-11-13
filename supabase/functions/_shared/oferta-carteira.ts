// Texto da oferta da campanha diária da carteira SFTP (UME / Odres Cred).
// Regra comercial: à vista = principal (soma das parcelas em aberto, sem juros/multa);
// parcelado = principal + 10%, parcela mínima R$ 100, no máximo 18x.
export const PARCELA_MINIMA = 100;
export const MAX_PARCELAS = 18;
export const ACRESCIMO_PARCELADO = 0.10;

const brl = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function calcularOferta(principal: number) {
  const avista = Math.round(principal * 100) / 100;
  const total = avista * (1 + ACRESCIMO_PARCELADO);
  const parcelas = Math.min(MAX_PARCELAS, Math.floor(total / PARCELA_MINIMA + 1e-9));
  return parcelas >= 2
    ? { avista, parcelas, valorParcela: Math.round((total / parcelas) * 100) / 100 }
    : { avista, parcelas: 1, valorParcela: avista };
}

// mes = 1..12 (BRT). Em novembro a UME usa a chamada de Black Friday.
export function textoOferta(credor: 'ume' | 'odres_cred', principal: number, mes: number): string {
  const o = calcularOferta(principal);
  const parcelado = o.parcelas >= 2 ? ` ou parcele em até ${o.parcelas}x de R$ ${brl(o.valorParcela)}` : '';
  if (credor === 'odres_cred') {
    return `*Odres Cred referente ao seu telefone. Quite à vista por apenas R$ ${brl(o.avista)}${parcelado}${parcelado ? ' POR MÊS' : ''}. Pagando a 1ª no PIX seu aparelho desbloqueia na hora!*`;
  }
  const chamada = mes === 11 ? 'de BLACK FRIDAY de final de ano' : mes === 12 ? 'de final de ano' : 'para quitar seu débito';
  return `*UME com condições especiais ${chamada}. Quite à vista por R$ ${brl(o.avista)}${parcelado}. Pague a 1ª no PIX e volte a comprar a prazo!*`;
}

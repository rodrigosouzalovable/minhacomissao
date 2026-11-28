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

// Variável {{2}} do modelo odres_desbloqueio_aparelho_pix ("Condição disponível: {{2}}.").
// À vista + até 5 opções de parcelamento distribuídas até o máximo permitido, em linha única.
export function opcoesParcelas(maximo: number, quantidade = 5): number[] {
  if (maximo < 2) return [];
  if (maximo - 1 <= quantidade) return Array.from({ length: maximo - 1 }, (_, i) => i + 2);
  const set = new Set<number>();
  for (let k = 1; k <= quantidade; k++) set.add(Math.max(2, Math.round((maximo * k) / quantidade)));
  return [...set].sort((a, b) => a - b);
}

export function textoCondicaoOdres(principal: number): string {
  const o = calcularOferta(principal);
  const avista = `à vista por R$ ${brl(o.avista)}`;
  if (o.parcelas < 2) return avista;
  const total = o.avista * (1 + ACRESCIMO_PARCELADO);
  const linhas = opcoesParcelas(o.parcelas).map((n) => `• ${n}x de R$ ${brl(Math.round((total / n) * 100) / 100)}`);
  // A Meta recusa variáveis com quebra de linha (erro 132018): marcadores na mesma linha.
  return `${avista} ou parcelado: ${linhas.join(' ')}. As parcelas são mensais, não quinzenais`;
}

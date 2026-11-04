// Traduz recusas da API UME (em inglês) para uma frase clara em português: o que houve + o que fazer.
type Regra = { re: RegExp; msg: (m: RegExpMatchArray) => string };

const REGRAS: Regra[] = [
  { re: /installment\s+(\d+)\s+was\s+paid\s+in\s+previous\s+renegotiation\s+(\d+)/i,
    msg: (m) => `A parcela ${m[1]} já foi paga no acordo anterior ${m[2]} e não pode entrar em um novo acordo. Tire essa parcela da seleção ou confira o acordo ${m[2]} no backoffice.` },
  { re: /installment\s+(\d+).*(already|is)\s+(in|part of)\s+(an?\s+)?(open|active|another)\s+renegotiation/i,
    msg: (m) => `A parcela ${m[1]} já faz parte de outro acordo em aberto na UME. Encerre ou confira esse acordo no backoffice antes de lançar outro.` },
  { re: /interest\s+rate\s+([\d.,]+)\s*%?\s+is\s+above\s+maximum\s*=?\s*([\d.,]+)\s*%?/i,
    msg: (m) => `A taxa de juros (${m[1]}%) está acima do máximo permitido pela UME (${m[2]}%). Reduza o acréscimo ou o número de parcelas.` },
  { re: /(open|active|pending)\s+renegotiation|renegotiation\s+(already\s+)?(open|exists|in progress)/i,
    msg: () => 'Este cliente já tem um acordo em aberto na UME. Encerre ou confira esse acordo no backoffice antes de lançar outro.' },
  { re: /installment\s+(\d+).*(not\s+found|invalid|does\s+not\s+exist)/i,
    msg: (m) => `A parcela ${m[1]} não foi encontrada na UME (pode já ter sido paga ou cancelada). Busque as parcelas de novo e tente outra vez.` },
  { re: /(due\s*date|first\s*payment|date).*(invalid|before|after|must|exceed)/i,
    msg: () => 'A data do 1º vencimento não foi aceita pela UME. Escolha uma data próxima, a partir de hoje, e tente de novo.' },
  { re: /(minimum|min).*(value|amount|installment)|(value|amount|installment).*(below|less than).*(minimum|min)/i,
    msg: () => 'O valor da parcela ficou abaixo do mínimo aceito pela UME. Diminua o número de parcelas.' },
  { re: /discount.*(above|exceed|greater|maximum)/i,
    msg: () => 'O desconto passou do limite permitido pela UME. Aumente o total do acordo.' },
  { re: /unauthorized|forbidden|\bTEP\b|invalid[_ ]token|\bume_auth_\d+|^erro (401|403)$/i,
    msg: () => MSG_AUTH },
  { re: /timeout|timed out|unavailable|bad gateway|internal server error|^erro 5\d\d$/i,
    msg: () => MSG_FORA },
];

const MSG_AUTH = 'O acesso à UME foi negado (problema de login com a UME, não do cliente). Tente de novo em alguns minutos; se continuar, avise o administrador.';
const MSG_FORA = 'O sistema da UME está fora do ar ou demorou para responder. Tente de novo em alguns minutos.';

// Números soltos (IDs, valores) nunca definem o tipo do erro; o status HTTP real sim.
export function traduzirErroUme(original: unknown, contexto = 'o acordo', status?: number): string {
  const txt = String(original ?? '').trim();
  for (const r of REGRAS) {
    const m = txt.match(r.re);
    if (m) return r.msg(m);
  }
  if (status === 401 || status === 403) return MSG_AUTH;
  if (status && status >= 500) return MSG_FORA;
  const trecho = txt && !/^erro \d+$/i.test(txt) ? ` Motivo da UME: "${txt.slice(0, 160)}".` : '';
  return `A UME recusou ${contexto} por um motivo não identificado.${trecho} Confira os dados do cliente no backoffice ou tente de novo.`;
}

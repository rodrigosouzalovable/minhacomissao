// Lê a mensagem de proposta enviada pelo portal ("Quero negociar meu débito...")
// para pré-preencher o acordo UME/Odres. Nunca adivinha: campo ausente fica null.
export interface PropostaPortal {
  cpf: string | null;
  total: number | null;
  parcelas: number | null;
  primeiroVencimento: string | null; // YYYY-MM-DD
}

const valor = (s?: string) => {
  if (!s) return null;
  const n = Number(s.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

export function lerPropostaPortal(texto: string): PropostaPortal | null {
  const t = String(texto || '');
  if (!/quero negociar meu d[ée]bito/i.test(t)) return null;
  const cpf = t.match(/CPF\s*([\d.\-]{11,14})/i)?.[1]?.replace(/\D/g, '') ?? null;
  const total = valor(t.match(/Total:\s*R\$\s*([\d.,]+)/i)?.[1]);
  const aVista = /À vista:/i.test(t);
  const nParc = t.match(/(\d{1,2})\s+parcelas:/i)?.[1];
  const d = t.match(/Primeiro pagamento:\s*(\d{2})\/(\d{2})\/(\d{4})/i);
  return {
    cpf: cpf && cpf.length === 11 ? cpf : null,
    total,
    parcelas: nParc ? Number(nParc) : aVista ? 1 : null,
    primeiroVencimento: d ? `${d[3]}-${d[2]}-${d[1]}` : null,
  };
}

/** Última proposta do portal recebida do cliente, da mais recente para a mais antiga. */
export function ultimaPropostaPortal(msgs: { conteudo: string; direcao: string }[]): PropostaPortal | null {
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i].direcao !== 'entrada') continue;
    const p = lerPropostaPortal(msgs[i].conteudo);
    if (p) return p;
  }
  return null;
}

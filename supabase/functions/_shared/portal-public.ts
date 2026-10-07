export type PublicCredor = 'novo_mundo' | 'ume' | 'odres_cred';

export function validPublicQuery(cpf: unknown, credor: unknown): cpf is string {
  if (typeof cpf !== 'string' || !/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  if (!['novo_mundo', 'ume', 'odres_cred'].includes(String(credor))) return false;
  for (let n = 9; n <= 10; n++) {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += Number(cpf[i]) * (n + 1 - i);
    const check = (sum * 10) % 11;
    if ((check === 10 ? 0 : check) !== Number(cpf[n])) return false;
  }
  return true;
}

/** Only customer-facing UME data may cross the public boundary. */
export function publicUmeWallet(c: { encontrado: boolean; nome: string; valorSemJuros: number | null; consultadoEm: string }, agreements: unknown[]) {
  const principal = c.encontrado && c.valorSemJuros != null && Number.isFinite(c.valorSemJuros) && c.valorSemJuros > 0 ? c.valorSemJuros : null;
  return { credor: 'ume', estado: !c.encontrado ? 'empty' : principal == null ? 'pending' : 'ok', nome: c.encontrado ? c.nome : '', principal, principalValidado: principal != null, debitos: [], acordos: agreements, faixas: [], consultadoEm: c.consultadoEm, mensagem: c.encontrado && principal == null ? 'O principal sem juros não está disponível. Fale com nossa equipe para conferir os valores.' : undefined };
}
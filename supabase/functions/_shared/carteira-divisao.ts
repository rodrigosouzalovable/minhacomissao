// Divide os números entre as campanhas UME e Odres Cred da carteira SFTP.
// Conjuntos disjuntos: as duas correm em paralelo sem nunca usar o mesmo número.
// Puro (sem Deno/npm) para ser testado pelo vitest do projeto.
export function dividirNumeros(ids: string[], qtdUme: number, qtdOdres: number): { ume: string[]; odres_cred: string[] } {
  const ord = [...ids].sort();
  if (qtdUme <= 0) return { ume: [], odres_cred: qtdOdres > 0 ? ord : [] };
  if (qtdOdres <= 0) return { ume: ord, odres_cred: [] };
  if (ord.length < 2) return { ume: [], odres_cred: [] };
  const fracOdres = qtdOdres / (qtdUme + qtdOdres);
  const nOdres = Math.min(ord.length - 1, Math.max(1, Math.round(ord.length * fracOdres)));
  // Intercala para misturar BMs/qualidade nas duas metades em vez de cortar a lista ao meio.
  const ume: string[] = [], odres_cred: string[] = [];
  ord.forEach((id, i) => {
    const alvoOdres = Math.round(((i + 1) * nOdres) / ord.length);
    if (odres_cred.length < alvoOdres) odres_cred.push(id); else ume.push(id);
  });
  return { ume, odres_cred };
}

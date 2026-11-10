// Credor do acordo ativo prevalece sobre o credor informado na planilha da campanha.
// Puro (sem Deno/npm) para ser testado pelo bun test do projeto.

export type CredorCampanha = 'novo_mundo' | 'ume' | 'odres_cred';

export const CREDOR_POR_EMPRESA: Record<string, CredorCampanha> = {
  ume_novo_mundo: 'novo_mundo',
  mundo_da_moda: 'ume',
  odres_cred: 'odres_cred',
};

export const ROTULO_CREDOR: Record<CredorCampanha, string> = {
  novo_mundo: 'NOVO MUNDO',
  ume: 'UME',
  odres_cred: 'ODRES CRED',
};

const ROTULOS = new Set(['UME', 'NOVO MUNDO', 'ODRES CRED', 'ODRES', 'ODRESCRED']);

export const soDigitos = (cpf: unknown) => String(cpf ?? '').replace(/\D/g, '');

/** Ajusta credor e a variável que traz o nome do credor, conforme o acordo ativo do CPF. */
export function aplicarCredorDoAcordo<T extends { credor?: string | null; vars?: Record<string, string> | null }>(
  item: T,
  empresaAcordo: string | Iterable<string> | null | undefined,
): T {
  const empresas = !empresaAcordo ? [] : typeof empresaAcordo === 'string' ? [empresaAcordo] : [...empresaAcordo];
  const ativos = [...new Set(empresas.map((e) => CREDOR_POR_EMPRESA[e]).filter(Boolean))] as CredorCampanha[];
  if (!ativos.length) return item;
  // Credor informado (campo ou rótulo nas variáveis) que já é um dos acordos ativos é mantido.
  const informados = new Set<CredorCampanha>();
  const c0 = String(item.credor ?? '').trim();
  if (c0 === 'novo_mundo' || c0 === 'ume' || c0 === 'odres_cred') informados.add(c0);
  for (const v of Object.values(item.vars || {})) {
    const u = String(v ?? '').trim().toUpperCase();
    if (u === 'UME') informados.add('ume');
    else if (u === 'NOVO MUNDO') informados.add('novo_mundo');
    else if (ROTULOS.has(u)) informados.add('odres_cred');
  }
  const doRotulo = [...informados].find((c) => ativos.includes(c));
  if (doRotulo) {
    if (informados.size === 1) return item.credor === doRotulo ? item : { ...item, credor: doRotulo };
  } else if (ativos.length > 1) return item; // vários credores e nenhum bate: não chuta
  const credor = doRotulo ?? ativos[0];
  const rotulo = ROTULO_CREDOR[credor];
  const vars = item.vars ? { ...item.vars } : item.vars;
  if (vars) {
    for (const k of Object.keys(vars)) {
      const v = String(vars[k] ?? '').trim().toUpperCase();
      if (ROTULOS.has(v)) vars[k] = rotulo;
    }
  }
  return { ...item, credor, vars };
}

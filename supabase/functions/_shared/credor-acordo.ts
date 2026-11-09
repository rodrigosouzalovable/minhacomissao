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
  empresaAcordo: string | null | undefined,
): T {
  const credor = empresaAcordo ? CREDOR_POR_EMPRESA[empresaAcordo] : undefined;
  if (!credor) return item;
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

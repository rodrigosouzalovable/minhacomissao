import type { PortalCredor } from './portalNegotiation';

export type PortalEscopo = {
  slug: 'novomundo' | 'odrescred';
  credores: PortalCredor[];
  nomes: string;
};

export const ESCOPO_PRINCIPAL: PortalEscopo = { slug: 'novomundo', credores: ['novo_mundo', 'ume'], nomes: 'Novo Mundo e UME' };
export const ESCOPO_ODRES: PortalEscopo = { slug: 'odrescred', credores: ['odres_cred'], nomes: 'Odres Cred' };

/** A busca de CPF consulta todas as carteiras em qualquer portal; o escopo define só a marca/visual. */
export const CREDORES_CONSULTA: PortalCredor[] = ['novo_mundo', 'ume', 'odres_cred'];

/** Odres Cred tem portal próprio, sem vínculo com UME/Novo Mundo. */
export function portalEscopo(slug?: string | null): PortalEscopo {
  return slug === 'odrescred' || slug === 'odres_cred' ? ESCOPO_ODRES : ESCOPO_PRINCIPAL;
}

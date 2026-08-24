import logoNovoMundo from '@/assets/logo-novo-mundo.png';
import logoUme from '@/assets/logo-ume.png';

export type CredorSlug = 'novo_mundo' | 'ume';

export interface CredorMarca {
  slug: CredorSlug;
  nome: string;
  logo: string;
}

export const CREDOR_MARCAS: Record<CredorSlug, CredorMarca> = {
  novo_mundo: { slug: 'novo_mundo', nome: 'Novo Mundo', logo: logoNovoMundo },
  ume: { slug: 'ume', nome: 'UME', logo: logoUme },
};

export const CREDOR_MARCAS_LISTA: CredorMarca[] = [
  CREDOR_MARCAS.novo_mundo,
  CREDOR_MARCAS.ume,
];

export function getCredorMarca(slug?: string | null): CredorMarca | null {
  if (!slug) return null;
  return CREDOR_MARCAS[slug as CredorSlug] ?? null;
}

/**
 * Normaliza um texto livre (planilha) para o slug do credor.
 * Retorna null quando não reconhece.
 */
export function normalizarCredor(valor?: string | null): CredorSlug | null {
  const t = String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  if (!t) return null;
  if (/(^|\s)(nm|novo\s*mundo|novomundo)(\s|$)/.test(t)) return 'novo_mundo';
  if (/(^|\s)(ume|umme|u\s*me)(\s|$)/.test(t)) return 'ume';
  return null;
}

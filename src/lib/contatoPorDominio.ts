/**
 * Contato exibido no portal público conforme o domínio/subdomínio acessado.
 * Subdomínios pessoais (ex.: luizcarlos.meusacordos.com.br) exibem o telefone
 * e e-mail do responsável, mantendo layout e funcionalidades idênticos.
 *
 * Os perfis ficam na tabela `portal_dominios`; o mapa abaixo serve apenas como
 * fallback imediato (evita exibir o contato errado no primeiro render).
 */

export interface ContatoPortal {
  /** Número no formato internacional para links wa.me */
  phone: string;
  /** Número formatado para exibição */
  phoneDisplay: string;
  /** E-mail de contato */
  email: string;
  /** Quando true, a página não deve ser indexada por buscadores */
  noindex: boolean;
}

export const DOMINIO_BASE = 'meusacordos.com.br';
export const DNS_A_VALUE = '185.158.133.1';

const CONTATO_PADRAO: ContatoPortal = {
  phone: '5562982183144',
  phoneDisplay: '(62) 98218-3144',
  email: 'meusacordos@souzaeribeiro.com.br',
  noindex: false,
};

/** hostname (lowercase) -> contato */
const CONTATOS_POR_HOST: Record<string, ContatoPortal> = {
  'luizcarlos.meusacordos.com.br': {
    phone: '5562981474256',
    phoneDisplay: '(62) 98147-4256',
    email: 'luizcarlos@souzaeribeiro.com.br',
    noindex: true,
  },
  'www.luizcarlos.meusacordos.com.br': {
    phone: '5562981474256',
    phoneDisplay: '(62) 98147-4256',
    email: 'luizcarlos@souzaeribeiro.com.br',
    noindex: true,
  },
};

export function getContatoPadrao(): ContatoPortal {
  return CONTATO_PADRAO;
}

export function getHostAtual(hostname?: string): string {
  return (hostname ?? (typeof window !== 'undefined' ? window.location.hostname : '')).toLowerCase();
}

export function getContatoPortal(hostname?: string): ContatoPortal {
  return CONTATOS_POR_HOST[getHostAtual(hostname)] ?? CONTATO_PADRAO;
}

/** Registro vindo do banco (tabela portal_dominios) */
export interface PortalDominioRow {
  hostname: string;
  telefone: string;
  telefone_display: string;
  email: string;
  noindex: boolean;
}

export function contatoDeRegistro(row: PortalDominioRow): ContatoPortal {
  return {
    phone: row.telefone,
    phoneDisplay: row.telefone_display,
    email: row.email,
    noindex: row.noindex,
  };
}

/**
 * Contato exibido no portal público conforme o domínio/subdomínio acessado.
 * Subdomínios pessoais (ex.: luizcarlos.meusacordos.com.br) exibem o telefone
 * e e-mail do responsável, mantendo layout e funcionalidades idênticos.
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

export function getContatoPortal(hostname?: string): ContatoPortal {
  const host = (hostname ?? (typeof window !== 'undefined' ? window.location.hostname : '')).toLowerCase();
  return CONTATOS_POR_HOST[host] ?? CONTATO_PADRAO;
}

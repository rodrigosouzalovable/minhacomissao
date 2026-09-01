import { useEffect, useMemo } from 'react';
import { getContatoPortal, type ContatoPortal } from '@/lib/contatoPorDominio';

const META_ID = 'robots-dominio';

/**
 * Retorna o contato do portal conforme o domínio acessado e injeta
 * <meta name="robots" content="noindex, nofollow"> em subdomínios privados.
 */
export function useContatoPortal(): ContatoPortal {
  const contato = useMemo(() => getContatoPortal(), []);

  useEffect(() => {
    if (!contato.noindex) return;
    let tag = document.getElementById(META_ID) as HTMLMetaElement | null;
    if (!tag) {
      tag = document.createElement('meta');
      tag.id = META_ID;
      tag.name = 'robots';
      document.head.appendChild(tag);
    }
    tag.content = 'noindex, nofollow';
    return () => {
      tag?.remove();
    };
  }, [contato.noindex]);

  return contato;
}

import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  getContatoPortal,
  getHostAtual,
  contatoDeRegistro,
  type ContatoPortal,
} from '@/lib/contatoPorDominio';

const META_ID = 'robots-dominio';
const META_FB_ID = 'facebook-domain-verification-dominio';

/**
 * Retorna o contato do portal conforme o domínio acessado (tabela portal_dominios,
 * com fallback estático) e injeta <meta name="robots" content="noindex, nofollow">
 * em subdomínios privados.
 */
export function useContatoPortal(): ContatoPortal {
  const host = useMemo(() => getHostAtual(), []);
  const fallback = useMemo(() => getContatoPortal(host), [host]);

  const { data } = useQuery({
    queryKey: ['portal-dominio', host],
    queryFn: async () => {
      const alvo = host.replace(/^www\./, '');
      const { data, error } = await supabase
        .from('portal_dominios')
        .select('hostname, telefone, telefone_display, email, noindex, meta_verification')
        .eq('hostname', alvo)
        .eq('ativo', true)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
    enabled: !!host,
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
  });

  const contato = data ? contatoDeRegistro(data) : fallback;

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

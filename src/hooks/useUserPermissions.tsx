import { useQuery } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';

const PERMS_TIMEOUT_MS = 6000;

function withTimeout<T>(p: PromiseLike<T>, ms: number): Promise<T> {
  return Promise.race([
    Promise.resolve(p) as Promise<T>,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('perms_timeout')), ms)
    ),
  ]);
}

export function useUserPermissions() {
  const { user } = useAuth();

  const { data: permissions, isLoading } = useQuery({
    queryKey: ['user-permissions', user?.id],
    queryFn: async () => {
      try {
        const { data, error } = await withTimeout(
          supabase
            .from('user_permissions')
            .select('*')
            .eq('user_id', user!.id)
            .maybeSingle(),
          PERMS_TIMEOUT_MS
        );
        if (error) {
          console.warn('Permissões indisponíveis, seguindo com defaults:', error.message);
          return null;
        }
        return data;
      } catch (e) {
        console.warn('Timeout ao buscar permissões, seguindo com defaults');
        return null;
      }
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  return {
    abasPermitidas: permissions?.abas_permitidas ?? null,
    credores: permissions?.credores ?? null,
    visivelRanking: permissions?.visivel_ranking ?? true,
    inboxCompartilhado: permissions?.inbox_compartilhado ?? false,
    acordosCompartilhados: permissions?.acordos_compartilhados ?? false,
    concedidoPor: permissions?.concedido_por ?? null,
    permiteCpfDuplicado: (permissions as any)?.permite_cpf_duplicado ?? false,
    isLoading,
  };
}

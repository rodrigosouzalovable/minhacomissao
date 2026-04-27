import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

const ROLE_TIMEOUT_MS = 6000;

function withTimeout<T>(p: PromiseLike<T>, ms: number): Promise<T> {
  return Promise.race([
    Promise.resolve(p) as Promise<T>,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('role_timeout')), ms)
    ),
  ]);
}

export function useUserRole() {
  const { user } = useAuth();
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchRole() {
      if (!user) {
        if (!cancelled) {
          setRole(null);
          setLoading(false);
        }
        return;
      }

      try {
        const { data, error } = await withTimeout(
          supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', user.id)
            .maybeSingle(),
          ROLE_TIMEOUT_MS
        );

        if (cancelled) return;

        if (error) {
          console.warn('Erro ao buscar role, usando fallback funcionario:', error.message);
          setRole('funcionario');
        } else {
          setRole((data?.role as AppRole) ?? 'funcionario');
        }
      } catch (e) {
        if (cancelled) return;
        console.warn('Timeout ao buscar role, usando fallback funcionario');
        setRole('funcionario');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchRole();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return {
    role,
    loading,
    isAdmin: role === 'admin',
    isGestor: role === 'gestor',
    isFuncionario: role === 'funcionario',
  };
}

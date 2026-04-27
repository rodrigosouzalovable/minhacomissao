import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

export function useUserRole() {
  const { user } = useAuth();
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchRole() {
      if (!user) {
        setRole(null);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle();

        if (cancelled) return;
        if (error) {
          console.error('Error fetching user role:', error);
          setRole('funcionario');
        } else {
          setRole(data?.role ?? 'funcionario');
        }
      } catch (err) {
        if (cancelled) return;
        console.error('Error fetching user role (network):', err);
        setRole('funcionario');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    // Safety timeout — não deixar a UI travada se o backend não responder
    const safety = setTimeout(() => {
      if (!cancelled) {
        setLoading((prev) => {
          if (prev) console.warn('[useUserRole] Safety timeout — assuming funcionario');
          return false;
        });
        setRole((prev) => prev ?? 'funcionario');
      }
    }, 6000);

    fetchRole();
    return () => { cancelled = true; clearTimeout(safety); };
  }, [user]);

  return {
    role,
    loading,
    isAdmin: role === 'admin',
    isGestor: role === 'gestor',
    isFuncionario: role === 'funcionario',
  };
}

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
    async function fetchRole() {
      if (!user) {
        setRole(null);
        setLoading(false);
        return;
      }

      // Limite de 10s para a tela nunca ficar presa em "Carregando..."
      const { data, error } = await Promise.race([
        supabase.from('user_roles').select('role').eq('user_id', user.id).maybeSingle(),
        new Promise<{ data: null; error: Error }>((resolve) =>
          setTimeout(() => resolve({ data: null, error: new Error('timeout') }), 10000)),
      ]) as { data: { role: AppRole } | null; error: unknown };

      if (error) {
        console.error('Error fetching user role:', error);
        setRole('funcionario');
      } else {
        setRole(data?.role ?? 'funcionario');
      }
      setLoading(false);
    }

    fetchRole();
  }, [user]);

  return {
    role,
    loading,
    isAdmin: role === 'admin',
    isGestor: role === 'gestor',
    isFuncionario: role === 'funcionario',
  };
}

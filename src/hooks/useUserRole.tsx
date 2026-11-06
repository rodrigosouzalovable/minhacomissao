import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { roleAccessState } from '@/lib/roleAccessState';

type AppRole = Database['public']['Enums']['app_role'];

// Cache em memória: evita que uma falha momentânea rebaixe um admin para funcionário.
const roleCache = new Map<string, AppRole>();

async function buscarRole(userId: string): Promise<{ role: AppRole | null; ok: boolean }> {
  const { data, error } = await Promise.race([
    supabase.from('user_roles').select('role').eq('user_id', userId).maybeSingle(),
    new Promise<{ data: null; error: Error }>((resolve) =>
      setTimeout(() => resolve({ data: null, error: new Error('timeout') }), 10000)),
  ]) as { data: { role: AppRole } | null; error: unknown };
  if (error) return { role: null, ok: false };
  return { role: data?.role ?? 'funcionario', ok: true };
}

export function useUserRole() {
  const { user } = useAuth();
  const [role, setRole] = useState<AppRole | null>(user ? roleCache.get(user.id) ?? null : null);
  const [loading, setLoading] = useState(true);
  const [resolvedUserId, setResolvedUserId] = useState<string | null>(null);

  const fetchRole = useCallback(async () => {
    if (!user) { setRole(null); setResolvedUserId(null); setLoading(false); return; }
    const cached = roleCache.get(user.id);
    if (cached) { setRole(cached); setResolvedUserId(user.id); setLoading(false); }
    else { setLoading(true); }
    // Até 3 tentativas com espera crescente antes de assumir funcionário.
    for (let t = 0; t < 3; t++) {
      const r = await buscarRole(user.id);
      if (r.ok && r.role) {
        roleCache.set(user.id, r.role);
        setRole(r.role);
        setResolvedUserId(user.id);
        setLoading(false);
        return;
      }
      if (t < 2) await new Promise((res) => setTimeout(res, 1500 * (t + 1)));
    }
    console.error('Error fetching user role: falhou após 3 tentativas');
    if (!cached) setRole('funcionario');
    setResolvedUserId(user.id);
    setLoading(false);
  }, [user]);

  useEffect(() => { void fetchRole(); }, [fetchRole]);

  const access = roleAccessState(user?.id ?? null, resolvedUserId, role, loading);
  return {
    role: access.role,
    loading: access.loading,
    refetch: fetchRole,
    isAdmin: access.role === 'admin',
    isGestor: access.role === 'gestor',
    isFuncionario: access.role === 'funcionario',
  };
}

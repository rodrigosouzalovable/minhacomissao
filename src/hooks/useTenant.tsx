import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const MASTER_TENANT_ID = '00000000-0000-0000-0000-000000000001';
export const MASTER_TENANT_SLUG = 'master';

export interface TenantInfo {
  id: string;
  slug: string;
  nome: string;
  ativo: boolean;
}

interface TenantContextType {
  currentTenant: TenantInfo | null;
  loading: boolean;
  isMaster: boolean;
}

const TenantContext = createContext<TenantContextType>({
  currentTenant: null,
  loading: true,
  isMaster: true,
});

/**
 * Provider that resolves a tenant by slug. When slug is null/undefined,
 * defaults to the master tenant.
 */
export function TenantProvider({
  slug,
  children,
}: {
  slug?: string | null;
  children: ReactNode;
}) {
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const targetSlug = slug ?? MASTER_TENANT_SLUG;
    setLoading(true);
    supabase
      .from('tenants' as any)
      .select('id, slug, nome, ativo')
      .eq('slug', targetSlug)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setTenant((data as any) ?? null);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return (
    <TenantContext.Provider
      value={{
        currentTenant: tenant,
        loading,
        isMaster: tenant?.slug === MASTER_TENANT_SLUG || !tenant,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  return useContext(TenantContext);
}

/**
 * Returns the current tenant_id. Falls back to MASTER_TENANT_ID when no
 * TenantProvider is mounted (backward-compatible for /admin/* routes).
 */
export function useCurrentTenantId(): string {
  const ctx = useContext(TenantContext);
  return ctx.currentTenant?.id ?? MASTER_TENANT_ID;
}

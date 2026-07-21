import { useUserRole } from './useUserRole';
import { useUserPermissions } from './useUserPermissions';

const META_PRIORITY = [
  '/admin/inbox-meta',
  '/admin/envio-meta',
  '/admin/configurar-meta',
  '/admin/cobrancas-meta',
];

export function useInitialRoute() {
  const { isAdmin, isGestor, loading: roleLoading } = useUserRole();
  const { abasPermitidas, isLoading: permLoading } = useUserPermissions();

  const loading = roleLoading || permLoading;

  if (loading) return { path: '/dashboard', loading: true };

  if (isAdmin || isGestor) return { path: '/dashboard', loading: false };

  if (!abasPermitidas || abasPermitidas.includes('/dashboard')) {
    return { path: '/dashboard', loading: false };
  }

  for (const p of META_PRIORITY) {
    if (abasPermitidas.includes(p)) return { path: p, loading: false };
  }

  if (abasPermitidas.length > 0) return { path: abasPermitidas[0], loading: false };

  return { path: '/dashboard', loading: false };
}

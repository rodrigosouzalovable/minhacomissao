import { ReactNode, useEffect, useState } from 'react';
import { Navigate, NavLink, Outlet, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { TenantProvider, useTenant } from '@/hooks/useTenant';
import { Button } from '@/components/ui/button';
import { LogOut, Send, Settings, Inbox, Receipt } from 'lucide-react';

function TenantHeader() {
  const { currentTenant } = useTenant();
  const { signOut } = useAuth();
  const { isAdmin } = useUserRole();

  const tabs = [
    { to: 'envio-meta', label: 'Envio Meta', icon: Send },
    { to: 'api-meta', label: 'API Oficial Meta', icon: Settings },
    { to: 'inbox', label: 'Inbox Meta', icon: Inbox },
    { to: 'cobrancas', label: 'Cobranças Meta', icon: Receipt },
  ];

  return (
    <header className="border-b bg-background sticky top-0 z-40">
      <div className="flex items-center justify-between px-4 h-14">
        <div className="flex items-center gap-3">
          <div className="font-bold text-primary">
            {currentTenant?.nome ?? 'Carregando…'}
          </div>
          {isAdmin && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200">
              Modo admin (visualizando tenant)
            </span>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={() => signOut()}>
          <LogOut className="h-4 w-4 mr-1" /> Sair
        </Button>
      </div>
      <nav className="flex gap-1 px-4 overflow-x-auto">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            className={({ isActive }) =>
              `flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 whitespace-nowrap ${
                isActive
                  ? 'border-primary text-primary font-medium'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`
            }
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}

function TenantGate({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const { currentTenant, loading: tenantLoading } = useTenant();
  const [memberChecked, setMemberChecked] = useState(false);
  const [isMember, setIsMember] = useState(false);

  useEffect(() => {
    async function check() {
      if (!user || !currentTenant) return;
      const { data } = await supabase
        .from('tenant_members' as any)
        .select('user_id')
        .eq('tenant_id', currentTenant.id)
        .eq('user_id', user.id)
        .maybeSingle();
      setIsMember(!!data);
      setMemberChecked(true);
    }
    if (user && currentTenant) check();
  }, [user, currentTenant]);

  if (authLoading || roleLoading || tenantLoading) {
    return <div className="min-h-screen flex items-center justify-center">Carregando…</div>;
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (!currentTenant || !currentTenant.ativo) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Tenant indisponível.
      </div>
    );
  }
  if (!isAdmin) {
    if (!memberChecked) {
      return <div className="min-h-screen flex items-center justify-center">Verificando acesso…</div>;
    }
    if (!isMember) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-6 text-center">
          <div className="text-lg font-semibold">Acesso negado</div>
          <div className="text-sm text-muted-foreground max-w-md">
            Sua conta não tem permissão para acessar este tenant. Peça ao administrador para vinculá-la.
          </div>
          <Button variant="outline" onClick={() => supabase.auth.signOut()}>Sair</Button>
        </div>
      );
    }
  }
  return <>{children}</>;
}

export default function TenantLayout({ slug: propSlug }: { slug?: string } = {}) {
  const params = useParams<{ tenantSlug: string }>();
  const slug = propSlug ?? params.tenantSlug ?? 'avatusbarbearia';
  return (
    <TenantProvider slug={slug}>
      <TenantGate>
        <div className="min-h-screen bg-background">
          <TenantHeader />
          <main className="p-4">
            <Outlet />
          </main>
        </div>
      </TenantGate>
    </TenantProvider>
  );
}

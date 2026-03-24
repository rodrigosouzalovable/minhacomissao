import { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  FileText,
  PlusCircle,
  DollarSign,
  LogOut,
  Menu,
  X,
  Users,
  UserCog,
  User,
  UsersRound,
  RotateCcw,
  FileSpreadsheet,
  Wallet,
  MessageSquare,
  Target,
  Bot,
  Volume2
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { PaymentReminders } from '@/components/PaymentReminders';
import { RetornoAlertChecker } from '@/components/RetornoAlertChecker';
import { ScrollArea } from '@/components/ui/scroll-area';
import acordosIcon from '@/assets/acordos-icon.png';

interface AppLayoutProps {
  children: ReactNode;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
  gestorOnly?: boolean;
}

const navItems: NavItem[] = [
  { href: '/conta', label: 'Minha Conta', icon: User },
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/acordos', label: 'Meus Acordos', icon: FileText },
  { href: '/acordos/novo', label: 'Novo Acordo', icon: PlusCircle },
  { href: '/retornos', label: 'Retornos', icon: RotateCcw },
  { href: '/clientes', label: 'Clientes', icon: Users },
  { href: '/meta', label: 'Meta', icon: Target },
  { href: '/comissoes', label: 'Minhas Comissões', icon: DollarSign },
  { href: '/equipe/acordos', label: 'Acordos da Equipe', icon: Users, gestorOnly: true },
  { href: '/admin/usuarios', label: 'Usuários', icon: UserCog, adminOnly: true },
  { href: '/admin/equipes', label: 'Equipes', icon: UsersRound, adminOnly: true },
  { href: '/admin/auditoria', label: 'Auditoria', icon: FileSpreadsheet, adminOnly: true },
  { href: '/admin/financeiro', label: 'Financeiro', icon: Wallet, adminOnly: true },
  { href: '/admin/importar-devedores', label: 'Importar Devedores', icon: FileSpreadsheet, adminOnly: true },
  { href: '/admin/acionamento', label: 'Acionamento', icon: MessageSquare, adminOnly: true },
  { href: '/admin/automacao-cobmais', label: 'Robô CobMais', icon: Bot, adminOnly: true },
  { href: '/campanhas-voz', label: 'Campanhas de Voz', icon: Volume2 },
];

export function AppLayout({ children }: AppLayoutProps) {
  const { user, signOut } = useAuth();
  const { isAdmin, isGestor } = useUserRole();
  const { abasPermitidas } = useUserPermissions();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Filter nav items based on role
  const filteredNavItems = navItems.filter((item) => {
    if (isAdmin) return true;
    // For non-admin users, if abasPermitidas is set, use it as the source of truth
    if (abasPermitidas) {
      return abasPermitidas.includes(item.href);
    }
    // If no abasPermitidas configured, apply role-based defaults
    if (item.adminOnly) return false;
    if (item.gestorOnly && !isGestor) return false;
    return true;
  });

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-primary text-primary-foreground p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src={acordosIcon} alt="Meus Acordos" className="h-6 w-6" />
          <h1 className="text-lg font-bold">MEUS ACORDOS</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-primary-foreground">
            <PaymentReminders />
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="text-primary-foreground hover:bg-primary/80"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-background/80 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed top-0 left-0 z-50 h-full w-64 bg-sidebar text-sidebar-foreground transform transition-transform duration-200 ease-in-out",
        "lg:translate-x-0",
        mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          <div className="shrink-0 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <img src={acordosIcon} alt="Meus Acordos" className="h-8 w-8" />
                <h1 className="text-xl font-bold">MEUS ACORDOS</h1>
              </div>
              <PaymentReminders />
            </div>
            <p className="text-sm opacity-80 mt-2 ml-10">{user?.email}</p>
          </div>

          <ScrollArea className="flex-1">
            <nav className="px-4">
              {filteredNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.href;
                
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-lg mb-1 transition-colors",
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "hover:bg-sidebar-accent/50"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </ScrollArea>

          <div className="shrink-0 p-4 border-t border-sidebar-border">
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-sidebar-foreground hover:bg-sidebar-accent/50"
              onClick={handleSignOut}
            >
              <LogOut className="h-5 w-5" />
              <span>Sair</span>
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-64 pt-16 lg:pt-0 min-h-screen">
        <div className="p-6">
          {children}
        </div>
      </main>

      {/* Global Retorno Alert Checker */}
      <RetornoAlertChecker />
    </div>
  );
}

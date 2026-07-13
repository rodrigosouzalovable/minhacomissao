import { ReactNode, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useConsultoria } from "@/hooks/useConsultoria";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  GraduationCap,
  LayoutDashboard,
  BookOpen,
  FileText,
  HelpCircle,
  Settings,
  LogOut,
  Menu,
} from "lucide-react";

const nav = [
  { to: "/consultoria", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/consultoria/materiais", label: "Materiais", icon: FileText },
  { to: "/consultoria/duvidas", label: "Dúvidas", icon: HelpCircle },
];

export default function ConsultoriaLayout({ children }: { children: ReactNode }) {
  const { aluno, isAdmin } = useConsultoria();
  const { signOut } = useAuth();
  const nav_ = navigate();
  const [open, setOpen] = useState(false);

  async function handleLogout() {
    await signOut();
    nav_("/consultoria");
  }

  const SideContent = (
    <div className="flex h-full flex-col">
      <div className="px-5 py-6 border-b">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-primary" />
          </div>
          <div>
            <div className="font-semibold leading-tight">Consultoria</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              WhatsApp API
            </div>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {nav.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )
            }
          >
            <n.icon className="w-4 h-4" />
            {n.label}
          </NavLink>
        ))}
        {isAdmin && (
          <NavLink
            to="/consultoria/admin"
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )
            }
          >
            <Settings className="w-4 h-4" />
            Admin
          </NavLink>
        )}
      </nav>

      <div className="p-3 border-t">
        <div className="px-3 py-2 mb-2">
          <div className="text-xs text-muted-foreground">Logado como</div>
          <div className="text-sm font-medium truncate">{aluno?.nome ?? "Administrador"}</div>
        </div>
        <Button variant="outline" size="sm" className="w-full" onClick={handleLogout}>
          <LogOut className="w-4 h-4 mr-2" /> Sair
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-muted/20">
      <div className="flex">
        <aside className="hidden lg:block w-64 bg-card border-r min-h-screen sticky top-0">
          {SideContent}
        </aside>
        <div className="flex-1 min-w-0">
          <header className="lg:hidden sticky top-0 z-30 bg-card border-b px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-primary" />
              <span className="font-semibold">Consultoria WhatsApp API</span>
            </div>
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-72">
                {SideContent}
              </SheetContent>
            </Sheet>
          </header>
          <main className="p-4 md:p-8 max-w-6xl mx-auto">{children}</main>
        </div>
      </div>
    </div>
  );
}

function navigate() {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useNavigate();
}

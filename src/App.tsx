import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";

import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Acordos from "./pages/Acordos";
import NovoAcordo from "./pages/NovoAcordo";
import AcordoDetalhe from "./pages/AcordoDetalhe";
import EditarAcordo from "./pages/EditarAcordo";
import Comissoes from "./pages/Comissoes";
import AdminUsuarios from "./pages/AdminUsuarios";
import AdminEquipes from "./pages/AdminEquipes";
import EquipeAcordos from "./pages/EquipeAcordos";
import MinhaConta from "./pages/MinhaConta";
import UsuarioComissoes from "./pages/UsuarioComissoes";
import NovoAcordoAdmin from "./pages/NovoAcordoAdmin";
import Retornos from "./pages/Retornos";
import Auditoria from "./pages/Auditoria";
import Financeiro from "./pages/Financeiro";
import NotFound from "./pages/NotFound";
import PortalConsulta from "./pages/PortalConsulta";
import ConsultaResultado from "./pages/ConsultaResultado";
import ImportarDevedores from "./pages/ImportarDevedores";
import PoliticaPrivacidade from "./pages/PoliticaPrivacidade";
import AntifraudePage from "./pages/Antifraude";
import Clientes from "./pages/Clientes";
import DevedorDetalhe from "./pages/DevedorDetalhe";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  }
  
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  
  if (loading || roleLoading) {
    return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  
  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
}

function GestorRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { isGestor, isAdmin, loading: roleLoading } = useUserRole();
  
  if (loading || roleLoading) {
    return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  
  if (!isGestor && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<PortalConsulta />} />
            <Route path="/consulta/:cpf" element={<ConsultaResultado />} />
            <Route path="/politica-de-privacidade" element={<PoliticaPrivacidade />} />
            <Route path="/antifraude" element={<AntifraudePage />} />
            <Route path="/auth" element={<PublicRoute><Auth /></PublicRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/acordos" element={<ProtectedRoute><Acordos /></ProtectedRoute>} />
            <Route path="/acordos/novo" element={<ProtectedRoute><NovoAcordo /></ProtectedRoute>} />
            <Route path="/acordos/:id" element={<ProtectedRoute><AcordoDetalhe /></ProtectedRoute>} />
            <Route path="/acordos/:id/editar" element={<ProtectedRoute><EditarAcordo /></ProtectedRoute>} />
            <Route path="/retornos" element={<ProtectedRoute><Retornos /></ProtectedRoute>} />
            <Route path="/clientes" element={<ProtectedRoute><Clientes /></ProtectedRoute>} />
            <Route path="/clientes/:id" element={<ProtectedRoute><DevedorDetalhe /></ProtectedRoute>} />
            <Route path="/comissoes" element={<ProtectedRoute><Comissoes /></ProtectedRoute>} />
            <Route path="/conta" element={<ProtectedRoute><MinhaConta /></ProtectedRoute>} />
            <Route path="/equipe/acordos" element={<GestorRoute><EquipeAcordos /></GestorRoute>} />
            <Route path="/admin/usuarios" element={<AdminRoute><AdminUsuarios /></AdminRoute>} />
            <Route path="/admin/usuarios/:userId/comissoes" element={<AdminRoute><UsuarioComissoes /></AdminRoute>} />
            <Route path="/admin/usuarios/:userId/novo-acordo" element={<AdminRoute><NovoAcordoAdmin /></AdminRoute>} />
            <Route path="/admin/equipes" element={<AdminRoute><AdminEquipes /></AdminRoute>} />
            <Route path="/admin/auditoria" element={<AdminRoute><Auditoria /></AdminRoute>} />
            <Route path="/admin/financeiro" element={<AdminRoute><Financeiro /></AdminRoute>} />
            <Route path="/admin/importar-devedores" element={<AdminRoute><ImportarDevedores /></AdminRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

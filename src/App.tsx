import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { AutoSendProvider } from "@/hooks/useAutoSend";
import { WhatsAppSendingProvider } from "@/contexts/WhatsAppSendingContext";
import { VoiceCampaignSendingProvider } from "@/contexts/VoiceCampaignSendingContext";

// Code-split: each route becomes its own chunk to reduce initial bundle.
const Auth = lazy(() => import("./pages/Auth"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Acordos = lazy(() => import("./pages/Acordos"));
const NovoAcordo = lazy(() => import("./pages/NovoAcordo"));
const AcordoDetalhe = lazy(() => import("./pages/AcordoDetalhe"));
const EditarAcordo = lazy(() => import("./pages/EditarAcordo"));
const Comissoes = lazy(() => import("./pages/Comissoes"));
const AdminUsuarios = lazy(() => import("./pages/AdminUsuarios"));
const AdminEquipes = lazy(() => import("./pages/AdminEquipes"));
const EquipeAcordos = lazy(() => import("./pages/EquipeAcordos"));
const MinhaConta = lazy(() => import("./pages/MinhaConta"));
const UsuarioComissoes = lazy(() => import("./pages/UsuarioComissoes"));
const NovoAcordoAdmin = lazy(() => import("./pages/NovoAcordoAdmin"));
const Retornos = lazy(() => import("./pages/Retornos"));
const Auditoria = lazy(() => import("./pages/Auditoria"));
const Financeiro = lazy(() => import("./pages/Financeiro"));
const NotFound = lazy(() => import("./pages/NotFound"));
const PortalConsulta = lazy(() => import("./pages/PortalConsulta"));
const ConsultaResultado = lazy(() => import("./pages/ConsultaResultado"));
const ImportarDevedores = lazy(() => import("./pages/ImportarDevedores"));
const PoliticaPrivacidade = lazy(() => import("./pages/PoliticaPrivacidade"));
const AntifraudePage = lazy(() => import("./pages/Antifraude"));
const Clientes = lazy(() => import("./pages/Clientes"));
const DevedorDetalhe = lazy(() => import("./pages/DevedorDetalhe"));
const CredorDashboard = lazy(() => import("./pages/CredorDashboard"));
const Acionamento = lazy(() => import("./pages/Acionamento"));
const MetaPessoal = lazy(() => import("./pages/MetaPessoal"));
const AutomacaoCobMais = lazy(() => import("./pages/AutomacaoCobMais"));
const CampanhasVoz = lazy(() => import("./pages/CampanhasVoz"));
const WhatsAppInbox = lazy(() => import("./pages/WhatsAppInbox"));
const Aquecimento = lazy(() => import("./pages/Aquecimento"));
const MonitorEnvios = lazy(() => import("./pages/MonitorEnvios"));
const ExportarDados = lazy(() => import("./pages/ExportarDados"));

const Relatorios = lazy(() => import("./pages/Relatorios"));
const ComiteNovoMundo = lazy(() => import("./pages/ComiteNovoMundo"));
const ValidarEmails = lazy(() => import("./pages/ValidarEmails"));
const Notificacoes = lazy(() => import("./pages/Notificacoes"));
const Estrategias = lazy(() => import("./pages/Estrategias"));
const ModeloMensagem = lazy(() => import("./pages/ModeloMensagem"));
const ConfigurarMeta = lazy(() => import("./pages/ConfigurarMeta"));

const queryClient = new QueryClient();

const PageFallback = () => (
  <div className="min-h-screen flex items-center justify-center">Carregando...</div>
);

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

function PermissionRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { isAdmin, isGestor, loading: roleLoading } = useUserRole();
  const { abasPermitidas, isLoading: permLoading } = useUserPermissions();
  const location = useLocation();
  
  if (loading || roleLoading || permLoading) {
    return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  
  if (isAdmin) {
    return <>{children}</>;
  }
  
  if (abasPermitidas && abasPermitidas.includes(location.pathname)) {
    return <>{children}</>;
  }

  if (!abasPermitidas && isGestor) {
    return <>{children}</>;
  }
  
  return <Navigate to="/dashboard" replace />;
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
          <AutoSendProvider>
          <WhatsAppSendingProvider>
          <VoiceCampaignSendingProvider>
          <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/" element={<Navigate to="/novomundo" replace />} />
            <Route path="/inbox" element={<PermissionRoute><WhatsAppInbox /></PermissionRoute>} />
            <Route path="/:creditor" element={<PortalConsulta />} />
            <Route path="/consulta/:creditor/:cpf" element={<ConsultaResultado />} />
            <Route path="/politica-de-privacidade" element={<PoliticaPrivacidade />} />
            <Route path="/antifraude" element={<AntifraudePage />} />
            <Route path="/credor/:slug/dashboard" element={<CredorDashboard />} />
            <Route path="/auth" element={<PublicRoute><Auth /></PublicRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/acordos" element={<ProtectedRoute><Acordos /></ProtectedRoute>} />
            <Route path="/acordos/novo" element={<ProtectedRoute><NovoAcordo /></ProtectedRoute>} />
            <Route path="/acordos/:id" element={<ProtectedRoute><AcordoDetalhe /></ProtectedRoute>} />
            <Route path="/acordos/:id/editar" element={<ProtectedRoute><EditarAcordo /></ProtectedRoute>} />
            <Route path="/retornos" element={<ProtectedRoute><Retornos /></ProtectedRoute>} />
            <Route path="/clientes" element={<ProtectedRoute><Clientes /></ProtectedRoute>} />
            <Route path="/clientes/:id" element={<ProtectedRoute><DevedorDetalhe /></ProtectedRoute>} />
            <Route path="/comissoes" element={<PermissionRoute><Comissoes /></PermissionRoute>} />
            <Route path="/conta" element={<ProtectedRoute><MinhaConta /></ProtectedRoute>} />
            <Route path="/equipe/acordos" element={<PermissionRoute><EquipeAcordos /></PermissionRoute>} />
            <Route path="/admin/usuarios" element={<PermissionRoute><AdminUsuarios /></PermissionRoute>} />
            <Route path="/admin/usuarios/:userId/comissoes" element={<AdminRoute><UsuarioComissoes /></AdminRoute>} />
            <Route path="/admin/usuarios/:userId/novo-acordo" element={<AdminRoute><NovoAcordoAdmin /></AdminRoute>} />
            <Route path="/admin/equipes" element={<PermissionRoute><AdminEquipes /></PermissionRoute>} />
            <Route path="/admin/auditoria" element={<PermissionRoute><Auditoria /></PermissionRoute>} />
            <Route path="/admin/financeiro" element={<PermissionRoute><Financeiro /></PermissionRoute>} />
            <Route path="/admin/importar-devedores" element={<PermissionRoute><ImportarDevedores /></PermissionRoute>} />
            <Route path="/admin/acionamento" element={<PermissionRoute><Acionamento /></PermissionRoute>} />
            <Route path="/admin/automacao-cobmais" element={<PermissionRoute><AutomacaoCobMais /></PermissionRoute>} />
            <Route path="/meta" element={<ProtectedRoute><MetaPessoal /></ProtectedRoute>} />
            <Route path="/campanhas-voz" element={<PermissionRoute><CampanhasVoz /></PermissionRoute>} />
            <Route path="/aquecimento" element={<ProtectedRoute><Aquecimento /></ProtectedRoute>} />
            <Route path="/monitor-envios" element={<PermissionRoute><MonitorEnvios /></PermissionRoute>} />
            <Route path="/admin/exportar-dados" element={<PermissionRoute><ExportarDados /></PermissionRoute>} />
            <Route path="/relatorios" element={<ProtectedRoute><Relatorios /></ProtectedRoute>} />
            <Route path="/admin/comite-novomundo" element={<AdminRoute><ComiteNovoMundo /></AdminRoute>} />
            <Route path="/admin/validar-emails" element={<AdminRoute><ValidarEmails /></AdminRoute>} />
            <Route path="/admin/notificacoes" element={<PermissionRoute><Notificacoes /></PermissionRoute>} />
            <Route path="/estrategias" element={<PermissionRoute><Estrategias /></PermissionRoute>} />
            <Route path="/modelo-mensagem" element={<ProtectedRoute><ModeloMensagem /></ProtectedRoute>} />
            <Route path="/admin/configurar-meta" element={<AdminRoute><ConfigurarMeta /></AdminRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
          </VoiceCampaignSendingProvider>
          </WhatsAppSendingProvider>
          </AutoSendProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

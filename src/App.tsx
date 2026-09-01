import { lazy, Suspense } from "react";
import { retryImport } from "@/lib/lazyWithRetry";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { useInitialRoute } from "@/hooks/useInitialRoute";
import { AutoSendProvider } from "@/hooks/useAutoSend";
import { WhatsAppSendingProvider } from "@/contexts/WhatsAppSendingContext";
import { VoiceCampaignSendingProvider } from "@/contexts/VoiceCampaignSendingContext";
import { EnvioMetaSendingProvider } from "@/contexts/EnvioMetaSendingContext";
import { MetaCallProvider } from "@/contexts/MetaCallContext";

import CampanhasFlutuante from "@/components/meta/CampanhasFlutuante";

// Code-split: each route becomes its own chunk to reduce initial bundle.
const Auth = lazy(() => retryImport(() => import("./pages/Auth")));
const Dashboard = lazy(() => retryImport(() => import("./pages/Dashboard")));
const Acordos = lazy(() => retryImport(() => import("./pages/Acordos")));
const NovoAcordo = lazy(() => retryImport(() => import("./pages/NovoAcordo")));
const AcordoDetalhe = lazy(() => retryImport(() => import("./pages/AcordoDetalhe")));
const EditarAcordo = lazy(() => retryImport(() => import("./pages/EditarAcordo")));
const Comissoes = lazy(() => retryImport(() => import("./pages/Comissoes")));
const AdminUsuarios = lazy(() => retryImport(() => import("./pages/AdminUsuarios")));
const AdminEquipes = lazy(() => retryImport(() => import("./pages/AdminEquipes")));
const EquipeAcordos = lazy(() => retryImport(() => import("./pages/EquipeAcordos")));
const MinhaConta = lazy(() => retryImport(() => import("./pages/MinhaConta")));
const UsuarioComissoes = lazy(() => retryImport(() => import("./pages/UsuarioComissoes")));
const NovoAcordoAdmin = lazy(() => retryImport(() => import("./pages/NovoAcordoAdmin")));
const Retornos = lazy(() => retryImport(() => import("./pages/Retornos")));
const Auditoria = lazy(() => retryImport(() => import("./pages/Auditoria")));
const Financeiro = lazy(() => retryImport(() => import("./pages/Financeiro")));
const NotFound = lazy(() => retryImport(() => import("./pages/NotFound")));
const PixPublico = lazy(() => retryImport(() => import("./pages/PixPublico")));
const PortalConsulta = lazy(() => retryImport(() => import("./pages/PortalConsulta")));
const ConsultaResultado = lazy(() => retryImport(() => import("./pages/ConsultaResultado")));
const ImportarDevedores = lazy(() => retryImport(() => import("./pages/ImportarDevedores")));
const PoliticaPrivacidade = lazy(() => retryImport(() => import("./pages/PoliticaPrivacidade")));
const AntifraudePage = lazy(() => retryImport(() => import("./pages/Antifraude")));
const Clientes = lazy(() => retryImport(() => import("./pages/Clientes")));
const DevedorDetalhe = lazy(() => retryImport(() => import("./pages/DevedorDetalhe")));
const CredorDashboard = lazy(() => retryImport(() => import("./pages/CredorDashboard")));
const Acionamento = lazy(() => retryImport(() => import("./pages/Acionamento")));
const MetaPessoal = lazy(() => retryImport(() => import("./pages/MetaPessoal")));
const AutomacaoCobMais = lazy(() => retryImport(() => import("./pages/AutomacaoCobMais")));
const CampanhasVoz = lazy(() => retryImport(() => import("./pages/CampanhasVoz")));
const WhatsAppInbox = lazy(() => retryImport(() => import("./pages/WhatsAppInbox")));
const Aquecimento = lazy(() => retryImport(() => import("./pages/Aquecimento")));
const MonitorEnvios = lazy(() => retryImport(() => import("./pages/MonitorEnvios")));
const ExportarDados = lazy(() => retryImport(() => import("./pages/ExportarDados")));
const CertificadoDigital = lazy(() => retryImport(() => import("./pages/CertificadoDigital")));
const RedirectBoleto = lazy(() => retryImport(() => import("./pages/RedirectBoleto")));
const RedirectVerificarProposta = lazy(() => retryImport(() => import("./pages/RedirectVerificarProposta")));

const Relatorios = lazy(() => retryImport(() => import("./pages/Relatorios")));
const ComiteNovoMundo = lazy(() => retryImport(() => import("./pages/ComiteNovoMundo")));
const ValidarEmails = lazy(() => retryImport(() => import("./pages/ValidarEmails")));
const Notificacoes = lazy(() => retryImport(() => import("./pages/Notificacoes")));
const Estrategias = lazy(() => retryImport(() => import("./pages/Estrategias")));
const ModeloMensagem = lazy(() => retryImport(() => import("./pages/ModeloMensagem")));
const ConfigurarMeta = lazy(() => retryImport(() => import("./pages/ConfigurarMeta")));
const EnvioMeta = lazy(() => retryImport(() => import("./pages/EnvioMeta")));
const InboxMeta = lazy(() => retryImport(() => import("./pages/InboxMeta")));
const MetaBilling = lazy(() => retryImport(() => import("./pages/MetaBilling")));
const MetaTemplates = lazy(() => retryImport(() => import("./pages/MetaTemplates")));
const Consultoria = lazy(() => retryImport(() => import("./pages/Consultoria")));
const Cotacoes = lazy(() => retryImport(() => import("./pages/Cotacoes")));
const LembreteMeta = lazy(() => retryImport(() => import("./pages/LembreteMeta")));
const GoogleMapsLeads = lazy(() => retryImport(() => import("./pages/GoogleMapsLeads")));
const PontoAdmin = lazy(() => retryImport(() => import("./pages/PontoAdmin")));
const Blacklist = lazy(() => retryImport(() => import("./pages/Blacklist")));
const AdminDominios = lazy(() => retryImport(() => import("./pages/AdminDominios")));
const CalculadoraUme = lazy(() => retryImport(() => import("./pages/CalculadoraUme")));
const MeusSites = lazy(() => retryImport(() => import("./pages/MeusSites")));

const TenantLayout = lazy(() => retryImport(() => import("./pages/tenant/TenantLayout")));

// Evita o efeito "o site fica atualizando sozinho": sem refetch ao focar a janela,
// dados considerados frescos por 60s e sem refetch em segundo plano.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchIntervalInBackground: false,
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      retry: 1,
    },
  },
});

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
  const initial = useInitialRoute();
  
  if (loading || (user && initial.loading)) {
    return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  }
  
  if (user) {
    return <Navigate to={initial.path} replace />;
  }
  
  return <>{children}</>;
}

function DashboardRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { isAdmin, isGestor, loading: roleLoading } = useUserRole();
  const { abasPermitidas, isLoading: permLoading } = useUserPermissions();
  const initial = useInitialRoute();

  if (loading || roleLoading || permLoading) {
    return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const allowed = isAdmin || isGestor || !abasPermitidas || abasPermitidas.includes('/dashboard');
  if (!allowed) {
    return <Navigate to={initial.path} replace />;
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
          <EnvioMetaSendingProvider>
          <MetaCallProvider>
          <Suspense fallback={<PageFallback />}>

          <Routes>
            <Route path="/" element={<Navigate to="/novomundo" replace />} />
            <Route path="/ir/boleto" element={<RedirectBoleto />} />
            <Route path="/ir/verificar-proposta-odres" element={<RedirectVerificarProposta />} />
            <Route path="/pix/:id" element={<PixPublico />} />
            {/* Tenant routes (multi-tenant) — MUST come before /:creditor to avoid clash */}
            <Route path="/avatusbarbearia" element={<TenantLayout />}>
              <Route index element={<Navigate to="envio-meta" replace />} />
              <Route path="envio-meta" element={<ProtectedRoute><EnvioMeta /></ProtectedRoute>} />
              <Route path="api-meta" element={<ProtectedRoute><ConfigurarMeta /></ProtectedRoute>} />
              <Route path="inbox" element={<ProtectedRoute><InboxMeta /></ProtectedRoute>} />
              <Route path="cobrancas" element={<ProtectedRoute><MetaBilling /></ProtectedRoute>} />
            </Route>
            <Route path="/inbox" element={<PermissionRoute><WhatsAppInbox /></PermissionRoute>} />
            <Route path="/consultoria/*" element={<Consultoria />} />
            <Route path="/:creditor" element={<PortalConsulta />} />
            <Route path="/consulta/:creditor/:cpf" element={<ConsultaResultado />} />
            <Route path="/politica-de-privacidade" element={<PoliticaPrivacidade />} />
            <Route path="/antifraude" element={<AntifraudePage />} />
            <Route path="/credor/:slug/dashboard" element={<CredorDashboard />} />
            <Route path="/auth" element={<PublicRoute><Auth /></PublicRoute>} />
            <Route path="/dashboard" element={<DashboardRoute><Dashboard /></DashboardRoute>} />
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
            <Route path="/admin/certificado-digital" element={<AdminRoute><CertificadoDigital /></AdminRoute>} />
            <Route path="/estrategias" element={<PermissionRoute><Estrategias /></PermissionRoute>} />
            <Route path="/modelo-mensagem" element={<ProtectedRoute><ModeloMensagem /></ProtectedRoute>} />
            <Route path="/admin/configurar-meta" element={<PermissionRoute><ConfigurarMeta /></PermissionRoute>} />
            <Route path="/admin/envio-meta" element={<PermissionRoute><EnvioMeta /></PermissionRoute>} />
            <Route path="/admin/inbox-meta" element={<PermissionRoute><InboxMeta /></PermissionRoute>} />
            <Route path="/admin/meta-billing" element={<AdminRoute><MetaBilling /></AdminRoute>} />
            <Route path="/admin/meta-templates" element={<PermissionRoute><MetaTemplates /></PermissionRoute>} />
            <Route path="/admin/cotacoes" element={<AdminRoute><Cotacoes /></AdminRoute>} />
            <Route path="/admin/lembrete-meta" element={<AdminRoute><LembreteMeta /></AdminRoute>} />
            <Route path="/admin/google-maps-leads" element={<AdminRoute><GoogleMapsLeads /></AdminRoute>} />
            <Route path="/admin/ponto" element={<AdminRoute><PontoAdmin /></AdminRoute>} />
             <Route path="/admin/blacklist" element={<ProtectedRoute><Blacklist /></ProtectedRoute>} />
              <Route path="/admin/dominios" element={<AdminRoute><AdminDominios /></AdminRoute>} />
              <Route path="/admin/calculadora-ume" element={<AdminRoute><CalculadoraUme /></AdminRoute>} />
              <Route path="/admin/meus-sites" element={<PermissionRoute><MeusSites /></PermissionRoute>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
          <CampanhasFlutuante />
          </MetaCallProvider>
          </EnvioMetaSendingProvider>

          </VoiceCampaignSendingProvider>
          </WhatsAppSendingProvider>
          </AutoSendProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

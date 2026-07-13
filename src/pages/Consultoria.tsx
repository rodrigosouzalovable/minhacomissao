import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { ConsultoriaProvider, useConsultoria } from "@/hooks/useConsultoria";
import ConsultoriaLogin from "./consultoria/ConsultoriaLogin";
import ConsultoriaLayout from "./consultoria/ConsultoriaLayout";
import ConsultoriaDashboard from "./consultoria/ConsultoriaDashboard";
import ConsultoriaModulo from "./consultoria/ConsultoriaModulo";
import ConsultoriaAula from "./consultoria/ConsultoriaAula";
import ConsultoriaMateriais from "./consultoria/ConsultoriaMateriais";
import ConsultoriaDuvidas from "./consultoria/ConsultoriaDuvidas";
import ConsultoriaAdmin from "./consultoria/ConsultoriaAdmin";

function Loading() {
  return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
}

function Gate() {
  const { user, loading: authLoading } = useAuth();
  const { isAluno, isAdmin, loading } = useConsultoria();

  if (authLoading || loading) return <Loading />;
  if (!user) return <ConsultoriaLogin />;
  if (!isAluno && !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center">
        <div className="max-w-md space-y-3">
          <h1 className="text-2xl font-bold">Acesso restrito</h1>
          <p className="text-muted-foreground">
            Sua conta ainda não tem acesso à consultoria. Peça ao administrador para liberar seu
            cadastro.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ConsultoriaLayout>
      <Routes>
        <Route index element={<ConsultoriaDashboard />} />
        <Route path="modulo/:id" element={<ConsultoriaModulo />} />
        <Route path="aula/:modulo/:aula" element={<ConsultoriaAula />} />
        <Route path="materiais" element={<ConsultoriaMateriais />} />
        <Route path="duvidas" element={<ConsultoriaDuvidas />} />
        <Route path="admin" element={<ConsultoriaAdmin />} />
        <Route path="*" element={<Navigate to="/consultoria" replace />} />
      </Routes>
    </ConsultoriaLayout>
  );
}

export default function Consultoria() {
  return (
    <ConsultoriaProvider>
      <Gate />
    </ConsultoriaProvider>
  );
}

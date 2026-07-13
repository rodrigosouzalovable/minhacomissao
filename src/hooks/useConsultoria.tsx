import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Aluno = {
  id: string;
  user_id: string;
  nome: string;
  email: string;
  empresa: string | null;
  telefone: string | null;
  ativo: boolean;
  is_admin_consultoria: boolean;
};

type Ctx = {
  aluno: Aluno | null;
  isAdmin: boolean;
  isAluno: boolean;
  loading: boolean;
  refresh: () => void;
};

const ConsultoriaCtx = createContext<Ctx | null>(null);

export function ConsultoriaProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const [isSystemAdmin, setIsSystemAdmin] = useState(false);
  const [checkingRole, setCheckingRole] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!user) {
        setIsSystemAdmin(false);
        setCheckingRole(false);
        return;
      }
      setCheckingRole(true);
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (alive) {
        setIsSystemAdmin(!!data);
        setCheckingRole(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [user]);

  const { data: aluno, isLoading } = useQuery({
    queryKey: ["consultoria-aluno", user?.id, refreshKey],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await (supabase as any)
        .from("consultoria_alunos")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      return (data as Aluno | null) ?? null;
    },
    enabled: !!user,
  });

  const isAluno = !!aluno && aluno.ativo;
  const isAdmin = isSystemAdmin || (!!aluno && aluno.is_admin_consultoria && aluno.ativo);
  const loading = authLoading || isLoading || checkingRole;

  return (
    <ConsultoriaCtx.Provider
      value={{
        aluno: aluno ?? null,
        isAdmin,
        isAluno: isAluno || isAdmin,
        loading,
        refresh: () => setRefreshKey((k) => k + 1),
      }}
    >
      {children}
    </ConsultoriaCtx.Provider>
  );
}

export function useConsultoria() {
  const ctx = useContext(ConsultoriaCtx);
  if (!ctx) throw new Error("useConsultoria must be used within ConsultoriaProvider");
  return ctx;
}

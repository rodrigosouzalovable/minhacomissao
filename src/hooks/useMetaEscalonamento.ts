import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type PorInstancia = {
  id: string;
  nome: string;
  display_phone: string | null;
  tier_diario: number;
  enviados_hoje: number;
  saude_quality: string | null;
  saude_tier: string | null;
  ativo: boolean;
  qtd_hoje: number;
  unicos_hoje: number;
};

export type ResumoEnvios = {
  unicos_hoje: number;
  unicos_7d: number;
  enviadas_hoje: number;
  por_instancia: PorInstancia[];
  serie_7d: { data: string; unicos: number; total: number }[];
};

export type PlanoConfig = {
  id?: string;
  user_id: string;
  data: string; // hoje
  meta_clientes_unicos: number;
  dia_numero: number;
  plano_inicio: string;
  plano_objetivo_unicos: number;
  plano_dias: number;
};

function hojeISO() {
  const d = new Date();
  const tz = d.getTimezoneOffset();
  const local = new Date(d.getTime() - tz * 60000);
  return local.toISOString().slice(0, 10);
}

/** Curva sugerida (acumulada) para objetivo=1000 em 7 dias, escalando 30→250.  */
function metaSugeridaParaDia(dia: number, objetivo: number, dias: number): number {
  // proporção crescente; aproximação de uma curva 30, 40, 60, 80, 100, 130, 160, 200, 250
  const pesos = [0.03, 0.04, 0.06, 0.08, 0.10, 0.13, 0.16, 0.20, 0.20];
  const i = Math.max(0, Math.min(pesos.length - 1, dia - 1));
  return Math.max(10, Math.round(objetivo * pesos[i]));
}

export function useMetaEscalonamento() {
  const { user } = useAuth();
  const uid = user?.id;

  const resumo = useQuery({
    queryKey: ["meta-envios-resumo", uid],
    enabled: !!uid,
    refetchInterval: 30_000,
    queryFn: async (): Promise<ResumoEnvios> => {
      const { data, error } = await (supabase as any).rpc("meta_envios_resumo", {
        _uid: uid,
        _ate: hojeISO(),
      });
      if (error) throw error;
      return (data as ResumoEnvios) ?? {
        unicos_hoje: 0, unicos_7d: 0, enviadas_hoje: 0, por_instancia: [], serie_7d: [],
      };
    },
  });

  const plano = useQuery({
    queryKey: ["meta-envios-plano", uid, hojeISO()],
    enabled: !!uid,
    queryFn: async (): Promise<PlanoConfig> => {
      const today = hojeISO();
      const { data, error } = await (supabase as any)
        .from("meta_envios_meta_diaria")
        .select("*")
        .eq("user_id", uid)
        .eq("data", today)
        .maybeSingle();
      if (error) throw error;
      if (data) return data as PlanoConfig;

      // Procura linha mais recente para descobrir o plano em curso
      const { data: last } = await (supabase as any)
        .from("meta_envios_meta_diaria")
        .select("*")
        .eq("user_id", uid)
        .order("data", { ascending: false })
        .limit(1)
        .maybeSingle();

      let plano_inicio = today;
      let plano_objetivo_unicos = 1000;
      let plano_dias = 7;
      let dia_numero = 1;
      if (last) {
        plano_inicio = (last as any).plano_inicio;
        plano_objetivo_unicos = (last as any).plano_objetivo_unicos ?? 1000;
        plano_dias = (last as any).plano_dias ?? 7;
        const diff = Math.floor(
          (new Date(today + "T00:00:00").getTime() - new Date(plano_inicio + "T00:00:00").getTime()) /
            86400000
        );
        dia_numero = Math.max(1, diff + 1);
      }
      const meta = metaSugeridaParaDia(dia_numero, plano_objetivo_unicos, plano_dias);
      return {
        user_id: uid!,
        data: today,
        meta_clientes_unicos: meta,
        dia_numero,
        plano_inicio,
        plano_objetivo_unicos,
        plano_dias,
      };
    },
  });

  // Auto-persistir a linha de hoje se ainda não existir
  useEffect(() => {
    (async () => {
      if (!uid || !plano.data) return;
      if (plano.data.id) return;
      await (supabase as any)
        .from("meta_envios_meta_diaria")
        .upsert(
          {
            user_id: uid,
            data: plano.data.data,
            meta_clientes_unicos: plano.data.meta_clientes_unicos,
            dia_numero: plano.data.dia_numero,
            plano_inicio: plano.data.plano_inicio,
            plano_objetivo_unicos: plano.data.plano_objetivo_unicos,
            plano_dias: plano.data.plano_dias,
          },
          { onConflict: "user_id,data" }
        );
    })();
  }, [uid, plano.data]);

  return {
    resumo: resumo.data,
    resumoLoading: resumo.isLoading,
    refetchResumo: resumo.refetch,
    plano: plano.data,
    planoLoading: plano.isLoading,
    refetchPlano: plano.refetch,
  };
}

export { metaSugeridaParaDia, hojeISO };

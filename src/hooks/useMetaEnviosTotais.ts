import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type MetaEnviosTotais = {
  hoje: number;
  ultimos7d: number;
  total: number;
};

export function useMetaEnviosTotais() {
  const { user } = useAuth();
  const uid = user?.id;

  return useQuery({
    queryKey: ["meta-envios-totais", uid],
    enabled: !!uid,
    staleTime: 60_000,
    refetchInterval: 2 * 60_000,
    queryFn: async (): Promise<MetaEnviosTotais> => {
      const now = new Date();
      const inicioHoje = new Date(now);
      inicioHoje.setHours(0, 0, 0, 0);
      const inicio7d = new Date(now);
      inicio7d.setDate(inicio7d.getDate() - 6);
      inicio7d.setHours(0, 0, 0, 0);

      const base = () =>
        (supabase as any)
          .from("meta_whatsapp_mensagens")
          .select("id", { count: "exact", head: true })
          .eq("user_id", uid)
          .eq("direcao", "saida");

      const [hojeRes, semRes, totalRes] = await Promise.all([
        base().gte("timestamp_msg", inicioHoje.toISOString()),
        base().gte("timestamp_msg", inicio7d.toISOString()),
        base(),
      ]);

      return {
        hoje: hojeRes.count ?? 0,
        ultimos7d: semRes.count ?? 0,
        total: totalRes.count ?? 0,
      };
    },
  });
}

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type MetaEnviosTotais = {
  hoje: number;
  ultimos7d: number;
  total: number;
  conversasCobradasMeta: number;
  custoOficialUsd: number;
};

export function useMetaEnviosTotais() {
  const { user } = useAuth();
  const uid = user?.id;

  return useQuery({
    queryKey: ["meta-envios-totais", uid],
    enabled: !!uid,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
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

      const [hojeRes, semRes, totalRes, billingRes] = await Promise.all([
        base().gte("timestamp_msg", inicioHoje.toISOString()),
        base().gte("timestamp_msg", inicio7d.toISOString()),
        base(),
        (supabase as any)
          .from("meta_billing_snapshot")
          .select("conversation_category,conversation_type,conversations_count,cost_usd")
          .limit(20000),
      ]);

      const billing = (billingRes.data || []) as Array<{
        conversation_category: string | null;
        conversation_type: string | null;
        conversations_count: number | null;
        cost_usd: number | null;
      }>;
      const conversasCobradasMeta = billing.reduce((s, r) => {
        const cat = String(r.conversation_category || "").toUpperCase();
        const tipo = String(r.conversation_type || "").toUpperCase();
        const gratis = Number(r.cost_usd || 0) === 0 || cat === "SERVICE" || tipo.includes("FREE");
        return s + (gratis ? 0 : Number(r.conversations_count || 0));
      }, 0);
      const custoOficialUsd = billing.reduce((s, r) => s + Number(r.cost_usd || 0), 0);

      return {
        hoje: hojeRes.count ?? 0,
        ultimos7d: semRes.count ?? 0,
        total: totalRes.count ?? 0,
        conversasCobradasMeta,
        custoOficialUsd,
      };
    },
  });
}

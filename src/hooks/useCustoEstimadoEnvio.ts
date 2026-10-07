import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { estimateMetaCost, normalizeCostPhone, type CostWindow } from "@/lib/metaCostEstimate";

export async function calcularCustoEstimado(telefones: string[], instanciaIds: string[], categoria: string | null) {
  const tels = [...new Set(telefones.map(normalizeCostPhone).filter(Boolean))];
  const cat = String(categoria || "").toUpperCase();
  const windows: CostWindow[] = [];
  let incomplete = false;
  if (cat === "UTILITY" && tels.length > 0 && instanciaIds.length > 0) {
    try {
      for (let i = 0; i < tels.length; i += 300) {
        const { data, error } = await supabase
          .from("meta_whatsapp_contatos")
          .select("telefone,instancia_id,ultima_msg_entrada_em")
          .in("instancia_id", instanciaIds)
          .in("telefone", tels.slice(i, i + 300))
          .not("ultima_msg_entrada_em", "is", null);
        if (error) throw error;
        // An API row cap may hide windows. Stay conservative rather than promise free delivery.
        if ((data?.length ?? 0) >= 1000) incomplete = true;
        windows.push(...(data || []));
      }
    } catch {
      incomplete = true;
    }
  }
  return estimateMetaCost(telefones, instanciaIds, categoria, windows, Date.now(), incomplete);
}

export type CustoEstimado = ReturnType<typeof estimateMetaCost> & { loading: boolean };

export function useCustoEstimadoEnvio(telefones: string[], instanciaIds: string[], categoria: string | null): CustoEstimado {
  const key = JSON.stringify([telefones, instanciaIds, categoria]);
  const [result, setResult] = useState<{ key: string; estimate: ReturnType<typeof estimateMetaCost> } | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      const estimate = await calcularCustoEstimado(telefones, instanciaIds, categoria);
      if (!cancelled) {
        setResult({ key, estimate });
        setLoading(false);
      }
    }, 400);
    return () => { cancelled = true; clearTimeout(timer); };
    // key contains the full input including category, preserving per-row send counts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const current = result?.key === key ? result.estimate : estimateMetaCost(telefones, instanciaIds, categoria, []);
  return { ...current, loading: loading || result?.key !== key };
}

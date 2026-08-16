import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CotaBm {
  bm_id: string;
  nome: string;
  tier_diario: number;
  tier_ilimitado: boolean;
  enviados_24h: number;
  restantes: number;
  instancias: number;
}

/**
 * Cota de disparos por Business Manager (janela móvel de 24h).
 * Sem polling: carrega ao montar e revalida quando a aba volta ao foco.
 */
export function useBmCotas() {
  const [cotas, setCotas] = useState<Record<string, CotaBm>>({});
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    const { data, error } = await (supabase as any).rpc("meta_bm_uso_24h");
    if (!error && data) {
      const map: Record<string, CotaBm> = {};
      for (const r of data as any[]) {
        map[r.bm_id] = {
          bm_id: r.bm_id,
          nome: r.nome,
          tier_diario: Number(r.tier_diario ?? 0),
          tier_ilimitado: r.tier_ilimitado === true,
          enviados_24h: Number(r.enviados_24h ?? 0),
          restantes: Number(r.restantes ?? 0),
          instancias: Number(r.instancias ?? 0),
        };
      }
      setCotas(map);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    carregar();
    const onFocus = () => {
      if (document.visibilityState === "visible") carregar();
    };
    document.addEventListener("visibilitychange", onFocus);
    return () => document.removeEventListener("visibilitychange", onFocus);
  }, [carregar]);

  const cotaDaBm = useCallback(
    (bmId: string | null | undefined): CotaBm | null => (bmId ? cotas[bmId] ?? null : null),
    [cotas],
  );

  const semSaldo = useCallback(
    (bmId: string | null | undefined): boolean => {
      const c = cotaDaBm(bmId);
      if (!c || c.tier_ilimitado) return false;
      return c.enviados_24h >= c.tier_diario;
    },
    [cotaDaBm],
  );

  return { cotas, loading, recarregar: carregar, cotaDaBm, semSaldo };
}

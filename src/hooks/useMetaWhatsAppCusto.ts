import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Preço estimado em BRL por categoria — fallback quando ainda não há dado real
// da Meta em meta_billing_snapshot. Baseado no rate card BR (jul/2026):
// UTILITY/AUTH: US$ 0,0068 · MARKETING: US$ 0,0625 · câmbio ~5,50.
// Envios dentro da janela CSW (foi_gratis=true) não são somados.
const PRECO: Record<string, number> = {
  UTILITY: 0.037,
  AUTHENTICATION: 0.037,
  MARKETING: 0.344,
  SERVICE: 0,
};

export type CustoJanela = {
  valor: number;
  qtdUtility: number;
  qtdMarketing: number;
  qtdOutros: number;
};

const ZERO: CustoJanela = { valor: 0, qtdUtility: 0, qtdMarketing: 0, qtdOutros: 0 };

function inicioDiaBRT(): string {
  const agora = new Date();
  const brt = new Date(agora.getTime() - 3 * 60 * 60 * 1000);
  brt.setUTCHours(0, 0, 0, 0);
  return new Date(brt.getTime() + 3 * 60 * 60 * 1000).toISOString();
}

function inicioMesBRT(): string {
  const agora = new Date();
  const brt = new Date(agora.getTime() - 3 * 60 * 60 * 1000);
  const ini = new Date(Date.UTC(brt.getUTCFullYear(), brt.getUTCMonth(), 1, 0, 0, 0));
  return new Date(ini.getTime() + 3 * 60 * 60 * 1000).toISOString();
}

export function useMetaWhatsAppCusto() {
  const [hoje, setHoje] = useState<CustoJanela>(ZERO);
  const [mes, setMes] = useState<CustoJanela>(ZERO);
  const [total, setTotal] = useState<CustoJanela>(ZERO);
  const [loading, setLoading] = useState(true);

  const calcular = useCallback(async () => {
    setLoading(true);
    try {
      const { data: tpls } = await supabase
        .from("meta_whatsapp_templates")
        .select("nome_template, categoria");
      const catByNome = new Map<string, string>();
      (tpls || []).forEach((t: any) => {
        catByNome.set(t.nome_template, String(t.categoria || "").toUpperCase());
      });

      const fetchJanela = async (desde: string | null): Promise<CustoJanela> => {
        let q = supabase
          .from("meta_whatsapp_envios_log")
          .select("template_nome, foi_gratis, pricing_category")
          .eq("status", "sent")
          .or("foi_gratis.is.null,foi_gratis.eq.false");
        if (desde) q = q.gte("enviado_em", desde);
        const { data } = await q.limit(100000);
        const r: CustoJanela = { valor: 0, qtdUtility: 0, qtdMarketing: 0, qtdOutros: 0 };
        (data || []).forEach((row: any) => {
          const cat = String(row.pricing_category || catByNome.get(row.template_nome) || "").toUpperCase();
          const preco = PRECO[cat] ?? 0;
          r.valor += preco;
          if (cat === "MARKETING") r.qtdMarketing++;
          else if (cat === "UTILITY" || cat === "AUTHENTICATION") r.qtdUtility++;
          else r.qtdOutros++;
        });
        return r;
      };

      const [h, m, t] = await Promise.all([
        fetchJanela(inicioDiaBRT()),
        fetchJanela(inicioMesBRT()),
        fetchJanela(null),
      ]);
      setHoje(h);
      setMes(m);
      setTotal(t);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    calcular();
  }, [calcular]);


  return { hoje, mes, total, loading, refetch: calcular };
}

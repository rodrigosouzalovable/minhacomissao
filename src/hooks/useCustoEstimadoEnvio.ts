import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const PRECO_USD: Record<string, number> = {
  MARKETING: 0.0625,
  UTILITY: 0.0068,
  AUTHENTICATION: 0.0068,
  SERVICE: 0,
};

const FX_FALLBACK = 5.55;

function normalizeTel(t: string): string {
  const d = String(t || "").replace(/\D+/g, "");
  if (!d) return "";
  if (d.startsWith("55") && d.length >= 12) return d;
  if (d.length === 10 || d.length === 11) return "55" + d;
  return d;
}

export async function calcularCustoEstimado(
  telefones: string[],
  instanciaIds: string[],
  categoria: string | null,
): Promise<{ cobrados: number; gratis: number; total: number; precoUsd: number; usd: number; brl: number; fxRate: number; categoria: string }> {
  const cat = String(categoria || "").toUpperCase();
  const precoUsd = PRECO_USD[cat] ?? 0;
  const fxRate = FX_FALLBACK;
  const tels = Array.from(new Set(telefones.map(normalizeTel).filter(Boolean)));
  const total = tels.length;
  let gratis = 0;
  if (total > 0 && instanciaIds.length > 0) {
    const janela = Date.now() - 24 * 60 * 60 * 1000;
    const found = new Set<string>();
    const CHUNK = 300;
    for (let i = 0; i < tels.length; i += CHUNK) {
      const slice = tels.slice(i, i + CHUNK);
      const { data } = await supabase
        .from("meta_whatsapp_contatos")
        .select("telefone,ultima_msg_entrada_em")
        .in("instancia_id", instanciaIds)
        .in("telefone", slice)
        .not("ultima_msg_entrada_em", "is", null);
      for (const r of data || []) {
        const ts = r.ultima_msg_entrada_em ? new Date(r.ultima_msg_entrada_em).getTime() : 0;
        if (ts >= janela) found.add(String(r.telefone));
      }
    }
    gratis = found.size;
  }
  const cobrados = Math.max(0, total - gratis);
  const usd = cobrados * precoUsd;
  const brl = usd * fxRate;
  return { cobrados, gratis, total, precoUsd, usd, brl, fxRate, categoria: cat };
}

export type CustoEstimado = {
  cobrados: number;
  gratis: number;
  total: number;
  precoUsd: number;
  usd: number;
  brl: number;
  fxRate: number;
  categoria: string;
  loading: boolean;
};

export function useCustoEstimadoEnvio(
  telefones: string[],
  instanciaIds: string[],
  categoria: string | null,
): CustoEstimado {
  const [gratis, setGratis] = useState(0);
  const [loading, setLoading] = useState(false);
  const [fxRate] = useState(FX_FALLBACK);

  const total = telefones.length;
  const cat = String(categoria || "").toUpperCase();
  const precoUsd = PRECO_USD[cat] ?? 0;

  useEffect(() => {
    let cancelled = false;
    if (total === 0 || instanciaIds.length === 0) {
      setGratis(0);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const tels = Array.from(new Set(telefones.map(normalizeTel).filter(Boolean)));
        const janela = Date.now() - 24 * 60 * 60 * 1000;
        const found = new Set<string>();
        const CHUNK = 300;
        for (let i = 0; i < tels.length; i += CHUNK) {
          const slice = tels.slice(i, i + CHUNK);
          const { data } = await supabase
            .from("meta_whatsapp_contatos")
            .select("telefone,ultima_msg_entrada_em")
            .in("instancia_id", instanciaIds)
            .in("telefone", slice)
            .not("ultima_msg_entrada_em", "is", null);
          for (const r of data || []) {
            const ts = r.ultima_msg_entrada_em ? new Date(r.ultima_msg_entrada_em).getTime() : 0;
            if (ts >= janela) found.add(String(r.telefone));
          }
        }
        if (!cancelled) setGratis(found.size);
      } catch {
        if (!cancelled) setGratis(0);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [telefones.join(","), instanciaIds.join(","), total]);

  const cobrados = Math.max(0, total - gratis);
  const usd = cobrados * precoUsd;
  const brl = usd * fxRate;

  return { cobrados, gratis, total, precoUsd, usd, brl, fxRate, categoria: cat, loading };
}

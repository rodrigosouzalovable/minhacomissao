// Helpers compartilhados do freio de qualidade Meta.
// Centraliza o cálculo de teto diário efetivo por instância para que
// `pick-meta-instance` e `meta-qualidade-freio` usem exatamente a mesma regra.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.88.0";

export const TETO_MINIMO = 10;

export function cotaFase(fase: string, cfg: any): number {
  switch (fase) {
    case "fase1": return Number(cfg?.cota_fase1 ?? 15);
    case "fase2": return Number(cfg?.cota_fase2 ?? 40);
    case "fase3": return Number(cfg?.cota_fase3 ?? 80);
    case "fase4": return Number(cfg?.cota_fase4 ?? 200);
    case "livre": return Number(cfg?.cota_fase4 ?? 200);
    default: return 0; // aguardando
  }
}

export function faseFromDias(d: number): string {
  if (d <= 3) return "fase1";
  if (d <= 7) return "fase2";
  if (d <= 14) return "fase3";
  if (d <= 21) return "fase4";
  return "livre";
}

/** Teto base do dia: cota da fase, nunca acima de X% da cota da Meta, respeitando escada de retorno. */
export function tetoBase(inst: any, cfg: any, fase: string): number {
  const pct = Number(cfg?.pct_max_cota_meta ?? 60) / 100;
  const tierMeta = Number(inst?.tier_diario ?? 250);
  let teto = Math.min(cotaFase(fase, cfg), Math.floor(tierMeta * pct));
  if (inst?.teto_escada != null) teto = Math.min(teto, Number(inst.teto_escada));
  return Math.max(0, teto);
}

export type MetricasJanela = {
  saidas: number;
  entradas: number;
  lidas: number;
  respostaPct: number;
  naoLidasPct: number;
};

/** Métricas de engajamento das últimas 24h a partir de meta_whatsapp_mensagens. */
export async function metricas24h(
  supabase: SupabaseClient,
  instanciaId: string,
): Promise<MetricasJanela> {
  const desde = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data } = await supabase
    .from("meta_whatsapp_mensagens")
    .select("direcao, status_envio")
    .eq("instancia_id", instanciaId)
    .gte("criado_em", desde)
    .limit(20000);

  let saidas = 0, entradas = 0, lidas = 0;
  for (const m of (data || []) as any[]) {
    if (m.direcao === "saida") {
      saidas++;
      if (String(m.status_envio) === "lida") lidas++;
    } else if (m.direcao === "entrada") {
      entradas++;
    }
  }
  const respostaPct = saidas > 0 ? (entradas / saidas) * 100 : 100;
  const naoLidasPct = saidas > 0 ? 100 - (lidas / saidas) * 100 : 0;
  return { saidas, entradas, lidas, respostaPct, naoLidasPct };
}

/** Aplica o freio por engajamento sobre o teto base. */
export function aplicarFreio(
  teto: number,
  m: MetricasJanela,
  cfg: any,
): { teto: number; motivo: string | null } {
  const volumeMinimo = 50;
  if (m.saidas < volumeMinimo) return { teto, motivo: null };

  const respostaMin = Number(cfg?.resposta_min_pct ?? 8);
  const naoLidasMax = Number(cfg?.nao_lidas_max_pct ?? 60);

  const ruimResposta = m.respostaPct < respostaMin;
  const ruimLeitura = m.naoLidasPct > naoLidasMax;

  if (ruimResposta && ruimLeitura) {
    return {
      teto: 0,
      motivo: `pausado no dia: resposta ${m.respostaPct.toFixed(1)}% (< ${respostaMin}%) e não lidas ${m.naoLidasPct.toFixed(1)}% (> ${naoLidasMax}%)`,
    };
  }
  if (ruimResposta) {
    return {
      teto: Math.max(TETO_MINIMO, Math.floor(teto / 2)),
      motivo: `teto reduzido 50%: resposta ${m.respostaPct.toFixed(1)}% (< ${respostaMin}%)`,
    };
  }
  if (ruimLeitura) {
    return {
      teto: Math.max(TETO_MINIMO, Math.floor(teto / 2)),
      motivo: `teto reduzido 50%: não lidas ${m.naoLidasPct.toFixed(1)}% (> ${naoLidasMax}%)`,
    };
  }
  return { teto, motivo: null };
}

/** Envios (saída) da instância na última hora — usado pelo teto horário. */
export async function enviadosUltimaHora(
  supabase: SupabaseClient,
  instanciaId: string,
): Promise<number> {
  const desde = new Date(Date.now() - 3600 * 1000).toISOString();
  const { count } = await supabase
    .from("meta_whatsapp_mensagens")
    .select("id", { count: "exact", head: true })
    .eq("instancia_id", instanciaId)
    .eq("direcao", "saida")
    .gte("criado_em", desde);
  return count || 0;
}

/** Envios (saída) da instância no dia BRT corrente. */
export async function enviadosHojeBrt(
  supabase: SupabaseClient,
  instanciaId: string,
): Promise<number> {
  const nowBrt = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const offsetMs = Date.now() - nowBrt.getTime();
  const inicioBrt = new Date(nowBrt);
  inicioBrt.setHours(0, 0, 0, 0);
  const desde = new Date(inicioBrt.getTime() + offsetMs).toISOString();
  const { count } = await supabase
    .from("meta_whatsapp_mensagens")
    .select("id", { count: "exact", head: true })
    .eq("instancia_id", instanciaId)
    .eq("direcao", "saida")
    .gte("criado_em", desde);
  return count || 0;
}

export function suffix8(t: string): string {
  const d = String(t || "").replace(/\D+/g, "");
  return d.length >= 8 ? d.slice(-8) : d;
}

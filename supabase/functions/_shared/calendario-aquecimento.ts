// Helper centralizado de calendário e personalidade para aquecimento
// Usado por todas as edge functions de warming para eliminar hardcode espalhado.

export interface CalendarioDia {
  dia_semana: number;
  horario_inicio: string; // 'HH:MM:SS'
  horario_fim: string;
  pausa_inicio: string | null;
  pausa_fim: string | null;
  fator_volume: number;
  quantidade_status: number;
  ativo: boolean;
}

export interface CalendarioStatus {
  dentroJanela: boolean;
  motivoSkip?: string;
  fator: number;
  maxStatus: number;
  hora: number;
  dow: number;
  config: CalendarioDia | null;
}

const FALLBACK: CalendarioDia = {
  dia_semana: 1,
  horario_inicio: "07:00:00",
  horario_fim: "21:00:00",
  pausa_inicio: "12:00:00",
  pausa_fim: "14:00:00",
  fator_volume: 1.0,
  quantidade_status: 1,
  ativo: true,
};

function timeToHour(t: string | null): number | null {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  return h + (m || 0) / 60;
}

export async function getCalendarioHoje(supabase: any): Promise<CalendarioStatus> {
  const now = new Date();
  const sp = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const dow = sp.getDay();
  const hora = sp.getHours() + sp.getMinutes() / 60;

  let config: CalendarioDia | null = null;
  try {
    const { data } = await supabase
      .from("whatsapp_aquecimento_calendario")
      .select("*")
      .eq("dia_semana", dow)
      .maybeSingle();
    config = (data as CalendarioDia) || null;
  } catch (_) { /* fallback */ }

  const cfg = config || FALLBACK;

  if (!cfg.ativo || cfg.fator_volume <= 0) {
    return { dentroJanela: false, motivoSkip: "dia_inativo", fator: 0, maxStatus: 0, hora, dow, config: cfg };
  }

  const hIni = timeToHour(cfg.horario_inicio) ?? 7;
  const hFim = timeToHour(cfg.horario_fim) ?? 21;
  if (hora < hIni || hora >= hFim) {
    return { dentroJanela: false, motivoSkip: "fora_horario", fator: cfg.fator_volume, maxStatus: cfg.quantidade_status, hora, dow, config: cfg };
  }

  const pIni = timeToHour(cfg.pausa_inicio);
  const pFim = timeToHour(cfg.pausa_fim);
  if (pIni !== null && pFim !== null && hora >= pIni && hora < pFim) {
    return { dentroJanela: false, motivoSkip: "pausa", fator: cfg.fator_volume, maxStatus: cfg.quantidade_status, hora, dow, config: cfg };
  }

  return { dentroJanela: true, fator: cfg.fator_volume, maxStatus: cfg.quantidade_status, hora, dow, config: cfg };
}

// === Personalidade ===
export type Personalidade = "rapido" | "equilibrado" | "reflexivo" | "noturno";

export const DELAYS_PERSONALIDADE: Record<Personalidade, { resposta: [number, number]; envio: [number, number] }> = {
  rapido:      { resposta: [30, 120],  envio: [60, 300] },
  equilibrado: { resposta: [90, 300],  envio: [180, 600] },
  reflexivo:   { resposta: [300, 900], envio: [600, 1800] },
  noturno:     { resposta: [120, 600], envio: [240, 900] },
};

export function delayResposta(p: Personalidade | null | undefined): number {
  const cfg = DELAYS_PERSONALIDADE[(p || "equilibrado") as Personalidade];
  const [a, b] = cfg.resposta;
  return Math.floor(a + Math.random() * (b - a));
}

export function delayEnvio(p: Personalidade | null | undefined): number {
  const cfg = DELAYS_PERSONALIDADE[(p || "equilibrado") as Personalidade];
  const [a, b] = cfg.envio;
  return Math.floor(a + Math.random() * (b - a));
}

// Multiplicador de "agressividade" usado para jitter de probabilidade
export function fatorPersonalidade(p: Personalidade | null | undefined): number {
  switch (p) {
    case "rapido": return 1.3;
    case "reflexivo": return 0.7;
    case "noturno": {
      const sp = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
      const h = sp.getHours();
      return (h >= 19 || h <= 2) ? 1.4 : 0.6;
    }
    default: return 1.0;
  }
}

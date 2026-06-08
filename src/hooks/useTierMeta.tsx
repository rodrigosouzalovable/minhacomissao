import { useMetaMes } from './useMetaMes';

export type MetaTier = 'none' | 'bronze' | 'prata' | 'ouro' | 'diamante';

export function tierFromPct(pct: number): MetaTier {
  if (pct >= 1.2) return 'diamante';
  if (pct >= 1.0) return 'ouro';
  if (pct >= 0.8) return 'prata';
  if (pct >= 0.5) return 'bronze';
  return 'none';
}

export function useTierMeta(): MetaTier {
  const { valorMeta, recebido } = useMetaMes();
  if (valorMeta <= 0) return 'none';
  return tierFromPct(recebido / valorMeta);
}

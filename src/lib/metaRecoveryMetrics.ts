export interface RecoveryMeasurement {
  primeiro_envio_recuperacao_em: string | null;
  voltou_green_em: string | null;
  envios_recuperacao_aceitos: number;
}

export function recoveryAverages(cycles: RecoveryMeasurement[]) {
  const complete = cycles.flatMap(cycle => {
    if (!cycle.primeiro_envio_recuperacao_em || !cycle.voltou_green_em || cycle.envios_recuperacao_aceitos <= 0) return [];
    const duration = Date.parse(cycle.voltou_green_em) - Date.parse(cycle.primeiro_envio_recuperacao_em);
    if (!Number.isFinite(duration) || duration <= 0) return [];
    return [{ duration, accepted: cycle.envios_recuperacao_aceitos, daily: cycle.envios_recuperacao_aceitos / Math.max(1, duration / 86_400_000) }];
  });
  const mean = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  return { count: complete.length, duration: mean(complete.map(c => c.duration)), accepted: mean(complete.map(c => c.accepted)), daily: mean(complete.map(c => c.daily)) };
}

interface QualityCycleMeasurement extends RecoveryMeasurement {
  caiu_em: string;
  precisao: string;
}

function summarizeDurations(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return {
    count: sorted.length,
    mean: sorted.length ? sorted.reduce((sum, value) => sum + value, 0) / sorted.length : null,
    median: sorted.length ? (sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2) : null,
  };
}

export function recoveryTimingSummary(cycles: QualityCycleMeasurement[]) {
  const exact = cycles.filter(cycle => cycle.precisao === 'exata');
  const durations = (start: 'caiu_em' | 'primeiro_envio_recuperacao_em') => exact.flatMap(cycle => {
    const beginning = cycle[start];
    if (!beginning || !cycle.voltou_green_em) return [];
    if (start === 'primeiro_envio_recuperacao_em' && cycle.envios_recuperacao_aceitos <= 0) return [];
    const duration = Date.parse(cycle.voltou_green_em) - Date.parse(beginning);
    return Number.isFinite(duration) && duration >= 0 ? [duration] : [];
  });
  return {
    fromDrop: summarizeDurations(durations('caiu_em')),
    fromFirstSend: summarizeDurations(durations('primeiro_envio_recuperacao_em')),
  };
}

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
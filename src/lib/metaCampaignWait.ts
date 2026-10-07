export function campaignWaitText(seconds: number, reason: string, min: number, max: number): string {
  const lo = Math.max(1, min);
  const hi = Math.max(lo, max);
  const config = lo === hi ? `Intervalo configurado: ${lo} segundo${lo === 1 ? '' : 's'}` : `Intervalo configurado: ${lo}–${hi} segundos`;
  if (/rate\s*limit|retry\s+after|liberação temporária|liberacao temporaria/i.test(reason)) return `${config} · Pausa exigida pelo serviço${seconds > 0 ? `: nova tentativa em ${seconds}s` : ': aguardando retomada'}`;
  return `${config}${seconds > hi ? ' · Aguardando processamento do próximo envio' : ''}`;
}
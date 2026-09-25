export const CNAES_PILOTO = ["8650003", "8630504", "6920601", "7020400"];
export const JANELAS_PILOTO = [5, 10, 15, 20, 25, 30];
export const INICIO_PILOTO = "2026-09-23";

export function etapaPiloto(hoje: string): { janela: number; ciclo: number } | null {
  if (hoje < INICIO_PILOTO) return null;
  const cursor = new Date(`${INICIO_PILOTO}T12:00:00Z`);
  const fim = new Date(`${hoje}T12:00:00Z`);
  let diasUteis = 0;
  while (cursor < fim) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (![0, 6].includes(cursor.getUTCDay())) diasUteis++;
  }
  // Repete a sequência em dias úteis; o piloto não deve desligar sozinho após
  // quatro passagens se a prospecção diária continua habilitada.
  return { janela: JANELAS_PILOTO[diasUteis % JANELAS_PILOTO.length], ciclo: Math.floor(diasUteis / JANELAS_PILOTO.length) };
}
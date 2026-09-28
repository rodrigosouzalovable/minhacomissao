export const CNAES_PILOTO = ["8650003", "8630504", "6920601", "7020400"];
export const JANELAS_PILOTO = [5, 10, 15, 20, 25, 30];
export const INICIO_PILOTO = "2026-09-23";
export const INICIO_PILOTO_RENOVACAO = "2026-09-28";
export const FIM_PILOTO_RENOVACAO = "2026-10-02";

export type EtapaCertificado = {
  janela: number;
  ciclo: number;
  dataAlvo: string;
  tipo: "abertura_recente" | "renovacao_anual";
};

function diferencaDias(dataMaisRecente: string, dataMaisAntiga: string): number {
  const recente = new Date(`${dataMaisRecente}T12:00:00Z`).getTime();
  const antiga = new Date(`${dataMaisAntiga}T12:00:00Z`).getTime();
  return Math.round((recente - antiga) / 86_400_000);
}

export function dataUmAnoAntes(hoje: string): string {
  const atual = new Date(`${hoje}T12:00:00Z`);
  const ano = atual.getUTCFullYear() - 1;
  const mes = atual.getUTCMonth();
  const dia = atual.getUTCDate();
  const alvo = new Date(Date.UTC(ano, mes, dia, 12));
  // Em 29/02, usa 28/02 do ano anterior para não avançar silenciosamente para março.
  if (alvo.getUTCMonth() !== mes) alvo.setUTCDate(0);
  return alvo.toISOString().slice(0, 10);
}

export function etapaCertificado(hoje: string): EtapaCertificado | null {
  if (hoje >= INICIO_PILOTO_RENOVACAO && hoje <= FIM_PILOTO_RENOVACAO) {
    const dataAlvo = dataUmAnoAntes(hoje);
    return {
      janela: diferencaDias(hoje, dataAlvo),
      ciclo: 0,
      dataAlvo,
      tipo: "renovacao_anual",
    };
  }
  // O piloto antigo não volta sozinho depois do teste anual.
  if (hoje > FIM_PILOTO_RENOVACAO) return null;
  const etapa = etapaPiloto(hoje);
  if (!etapa) return null;
  const atual = new Date(`${hoje}T12:00:00Z`);
  atual.setUTCDate(atual.getUTCDate() - etapa.janela);
  return { ...etapa, dataAlvo: atual.toISOString().slice(0, 10), tipo: "abertura_recente" };
}

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
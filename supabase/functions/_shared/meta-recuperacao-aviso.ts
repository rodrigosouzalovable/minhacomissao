// Helpers de aviso do aquecimento de qualidade (números Meta em YELLOW/RED).
// Centraliza a previsão de volta ao GREEN e a formatação das notificações.

/** Dias estimados para a Meta reclassificar o número saindo do estado atual. */
function diasParaGreen(qualidade: string): number {
  const q = String(qualidade || "").toUpperCase();
  if (q === "GREEN") return 0;
  if (q === "YELLOW") return 1; // YELLOW → GREEN costuma virar no dia seguinte
  return 2; // RED → YELLOW → GREEN
}

function dataBr(d: Date): string {
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export interface PrevisaoGreen {
  greenEm: string;
  altaEm: string;
  diasGreen: number;
  diasFaltando: number;
}

/**
 * Previsão de retorno: quando a Meta deve marcar GREEN e quando o número volta
 * ao pool de campanhas (após N dias consecutivos em GREEN).
 * A Meta recalcula a qualidade uma vez por dia, então a conta é em dias.
 */
export function previsaoGreen(
  qualidade: string | null,
  diasGreenConsecutivos: number | null,
  diasGreenAlta = 3,
): PrevisaoGreen {
  const diasGreen = Math.max(0, Number(diasGreenConsecutivos || 0));
  const paraGreen = diasParaGreen(qualidade || "");
  const faltamAlta = Math.max(0, diasGreenAlta - diasGreen);
  const green = new Date(Date.now() + paraGreen * 86400000);
  const alta = new Date(Date.now() + (paraGreen + faltamAlta) * 86400000);
  return {
    greenEm: paraGreen === 0 ? "já está GREEN" : dataBr(green),
    altaEm: dataBr(alta),
    diasGreen,
    diasFaltando: faltamAlta,
  };
}

/** Bloco de texto padrão com a previsão, usado em todas as notificações. */
export function linhaPrevisao(
  qualidade: string | null,
  diasGreenConsecutivos: number | null,
  diasGreenAlta = 3,
): string {
  const p = previsaoGreen(qualidade, diasGreenConsecutivos, diasGreenAlta);
  const q = String(qualidade || "").toUpperCase();
  if (q === "GREEN") {
    return p.diasFaltando === 0
      ? `📅 Previsão: pronto para voltar ao pool agora (${p.diasGreen} dias em GREEN).`
      : `📅 Previsão: ${p.diasGreen}/${diasGreenAlta} dias em GREEN — volta ao pool em ${p.altaEm} se mantiver.`;
  }
  return (
    `📅 Previsão: GREEN por volta de ${p.greenEm}; ` +
    `volta ao pool de campanhas em ${p.altaEm} (precisa de ${diasGreenAlta} dias seguidos em GREEN).`
  );
}

export interface ParcelaResumo { status: string; valor_parcela: number; data_prevista: string; numero_parcela: number }
export interface NovaParcela { valor: string; data: string }

/** Soma meses mantendo o dia (limitado ao fim do mês). */
function somarMeses(iso: string, meses: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const alvo = new Date(Date.UTC(y, m - 1 + meses, 1));
  const ultimo = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  alvo.setUTCDate(Math.min(d, ultimo));
  return alvo.toISOString().slice(0, 10);
}

/** Não é possível ter menos parcelas do que as já pagas (mínimo 1). */
export function quantidadeMinima(parcelas: ParcelaResumo[]): number {
  return Math.max(1, parcelas.filter((p) => p.status === 'pago').length);
}

/** Pendentes removidas ao diminuir: as últimas, nunca as pagas. */
export function parcelasRemovidas(parcelas: ParcelaResumo[], quantidade: number): number[] {
  const excesso = parcelas.length - quantidade;
  if (excesso <= 0) return [];
  return parcelas.filter((p) => p.status === 'pendente').sort((a, b) => b.numero_parcela - a.numero_parcela)
    .slice(0, excesso).map((p) => p.numero_parcela);
}

/** Ajusta a lista de novas parcelas, preenchendo valor e vencimento a partir da última. */
export function ajustarNovas(parcelas: ParcelaResumo[], quantidade: number, atuais: NovaParcela[]): NovaParcela[] {
  const faltam = Math.max(0, quantidade - parcelas.length);
  const ultima = [...parcelas].sort((a, b) => a.numero_parcela - b.numero_parcela).at(-1);
  return Array.from({ length: faltam }, (_, i) => atuais[i] ?? {
    valor: ultima ? String(ultima.valor_parcela) : '',
    data: ultima ? somarMeses(ultima.data_prevista, i + 1) : '',
  });
}

/** Total final = soma das parcelas que permanecem + novas. */
export function totalEditado(parcelas: (ParcelaResumo & { valorEditado?: number })[], quantidade: number, novas: NovaParcela[]): number {
  const removidas = new Set(parcelasRemovidas(parcelas, quantidade));
  const base = parcelas.filter((p) => !removidas.has(p.numero_parcela)).reduce((s, p) => s + (p.valorEditado ?? Number(p.valor_parcela)), 0);
  return Math.round((base + novas.reduce((s, n) => s + (Number(n.valor) || 0), 0)) * 100) / 100;
}

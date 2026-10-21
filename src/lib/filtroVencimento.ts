/** Datas em yyyy-MM-dd. Intervalo inclusivo; só início = apenas aquele dia. */
export function vencimentoNoIntervalo(datas: string[], from?: string, to?: string): boolean {
  if (!from && !to) return true;
  if (from && !to) return datas.includes(from);
  return datas.some(d => (!from || d >= from) && (!to || d <= to));
}

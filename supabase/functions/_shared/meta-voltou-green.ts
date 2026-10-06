/** True somente quando a qualidade sai de YELLOW/RED e passa a GREEN. */
export function voltouParaGreen(anterior: string | null | undefined, nova: string | null | undefined): boolean {
  const a = String(anterior || "").toUpperCase();
  const n = String(nova || "").toUpperCase();
  return n === "GREEN" && (a === "YELLOW" || a === "RED");
}

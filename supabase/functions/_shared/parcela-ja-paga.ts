// Evita cobrar cliente que já tem parcela paga (inclusive em acordo duplicado do mesmo CPF/credor).
// Parte pura (parcelaJaPaga) é testada pelo vitest do projeto.

export type ParcelaPaga = { cpf: string; empresa: string; data_prevista: string; data_paga: string | null };

const dig = (v: unknown) => String(v ?? "").replace(/\D/g, "");

/** Pula quando o mesmo CPF+credor já tem parcela paga com o mesmo vencimento ou paga no mês corrente (yyyy-mm). */
export function parcelaJaPaga(pagas: ParcelaPaga[], cpf: unknown, empresa: unknown, dataPrevista: string, mesAtual: string): boolean {
  const c = dig(cpf);
  if (!c) return false;
  const e = String(empresa ?? "");
  return pagas.some((p) => p.cpf === c && p.empresa === e &&
    (p.data_prevista === String(dataPrevista).slice(0, 10) || String(p.data_paga || "").slice(0, 7) === mesAtual));
}

const mascara = (c: string) => c.length === 11 ? `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}` : c;

/** Uma consulta em lotes: parcelas pagas dos CPFs informados (formatos com e sem pontuação). */
export async function carregarParcelasPagas(db: any, cpfs: unknown[]): Promise<ParcelaPaga[]> {
  const unicos = [...new Set(cpfs.map(dig).filter((c) => c.length >= 11))];
  const out: ParcelaPaga[] = [];
  for (let i = 0; i < unicos.length; i += 150) {
    const lote = unicos.slice(i, i + 150).flatMap((c) => [c, mascara(c)]);
    const { data, error } = await db.from("pagamentos")
      .select("data_prevista,data_paga,acordos!inner(cliente_cpf,empresa)")
      .eq("status", "pago").in("acordos.cliente_cpf", lote);
    if (error) throw new Error(`Falha ao conferir parcelas pagas: ${error.message}`);
    for (const r of data || []) out.push({ cpf: dig(r.acordos?.cliente_cpf), empresa: String(r.acordos?.empresa || ""),
      data_prevista: String(r.data_prevista || "").slice(0, 10), data_paga: r.data_paga });
  }
  return out;
}

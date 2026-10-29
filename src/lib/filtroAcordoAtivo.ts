export type AcordoAtivoMatch = {
  acordo_id: string;
  cpf: string | null;
  telefone: string | null;
  cliente_nome: string | null;
  empresa: string | null;
  responsavel: string | null;
  criado_em: string | null;
  status: string | null;
  sufixo: string | null;
  cpf_norm: string | null;
};

export type DestinatarioBasico = { telefone: string; cpf?: string; nome?: string };

export type DestinatarioExcluido<T> = {
  destinatario: T;
  encontradoPor: "CPF" | "Telefone" | "CPF e telefone";
  acordo: AcordoAtivoMatch;
};

export const onlyDigits = (s?: string | null) => String(s || "").replace(/\D/g, "");
export const sufixo8 = (t?: string | null) => onlyDigits(t).slice(-8);
export const cpfNorm = (c?: string | null) => onlyDigits(c);

/** Separa destinatários com acordo ativo (por CPF ou sufixo do telefone). Somente status 'ativo' bloqueia. */
export function separarPorAcordoAtivo<T extends DestinatarioBasico>(
  destinatarios: T[],
  acordos: AcordoAtivoMatch[],
): { liberados: T[]; excluidos: DestinatarioExcluido<T>[] } {
  const porCpf = new Map<string, AcordoAtivoMatch>();
  const porSuf = new Map<string, AcordoAtivoMatch>();
  for (const a of acordos) {
    if (String(a.status || "").toLowerCase() !== "ativo") continue;
    const c = cpfNorm(a.cpf_norm ?? a.cpf);
    const s = a.sufixo || sufixo8(a.telefone);
    if (c && !porCpf.has(c)) porCpf.set(c, a);
    if (s && s.length === 8 && !porSuf.has(s)) porSuf.set(s, a);
  }
  const liberados: T[] = [];
  const excluidos: DestinatarioExcluido<T>[] = [];
  for (const d of destinatarios) {
    const c = cpfNorm(d.cpf);
    const s = sufixo8(d.telefone);
    const ac = c ? porCpf.get(c) : undefined;
    const at = s.length === 8 ? porSuf.get(s) : undefined;
    if (ac || at) {
      excluidos.push({
        destinatario: d,
        encontradoPor: ac && at ? "CPF e telefone" : ac ? "CPF" : "Telefone",
        acordo: (ac || at)!,
      });
    } else liberados.push(d);
  }
  return { liberados, excluidos };
}

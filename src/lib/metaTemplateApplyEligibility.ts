// Numbers that can receive a template copy: active, connected and without a real Meta block or ban.
type Inst = { ativo?: boolean | null; saude_status?: string | null; saude_ban_info?: unknown; pausa_automatica_motivo?: string | null };

export function instanciaAptaParaTemplate(inst: Inst): boolean {
  if (inst.ativo === false) return false;
  if (String(inst.saude_status || "").toUpperCase() !== "CONNECTED") return false;
  const ban = inst.saude_ban_info;
  if (ban && typeof ban === "object" && Object.keys(ban as object).length > 0) return false;
  const motivo = String(inst.pausa_automatica_motivo || "");
  if (/141006|141014|131031|131042|payment|pagamento|billing|account.lock|account_violation|\bban|banid|blocked|bloque|restri[cç][aã]o de envio/i.test(motivo)) return false;
  return true;
}

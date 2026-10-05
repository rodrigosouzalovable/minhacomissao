// A qualidade desconhecida não equivale a bloqueio; restrições explícitas da Meta sim.
export function motivoBloqueioTemplate(inst: any): string | null {
  if (inst.ativo === false || (inst.provider && inst.provider !== "meta")) return "instância inativa ou não oficial";
  if (!inst.waba_id || !inst.access_token) return "sem credenciais da Meta";
  if (String(inst.saude_status || "").toUpperCase() !== "CONNECTED") return "número não conectado";
  const qualidade = String(inst.saude_quality || "UNKNOWN").toUpperCase();
  if (!["GREEN", "UNKNOWN"].includes(qualidade)) return `qualidade ${qualidade.toLowerCase()}`;
  if (qualidade === "UNKNOWN" && (inst.qualidade_leitura_ok === false || inst.qualidade_leitura_erro)) {
    return "consulta de qualidade indisponível";
  }
  if (String(inst.meta_name_status || "").toUpperCase() === "REJECTED") return "nome reprovado";
  if (inst.saude_ban_info && typeof inst.saude_ban_info === "object" && Object.keys(inst.saude_ban_info).length > 0) return "banimento informado pela Meta";
  const motivos = String(inst.pausa_automatica_motivo || "");
  if (/#?141006|payment method|payment|pagamento|billing/i.test(motivos)) {
    return "A Meta bloqueou esta conta por problema no método de pagamento (código 141006). Revise a cobrança em Faturamento e tente novamente após a liberação da Meta";
  }
  if (/#131031|#131042|account.lock|account_violation|ban|blocked|restri[cç][aã]o de envio/i.test(motivos)) return "bloqueio confirmado pela Meta";
  const scopes = [inst.saude_restricoes?.phone_health, inst.saude_restricoes?.waba_health];
  for (const scope of scopes) {
    const entities = Array.isArray(scope?.entities) ? scope.entities : [];
    for (const entity of entities) {
      const status = String(entity?.can_send_message || "").toUpperCase();
      const type = String(entity?.entity_type || "").toUpperCase();
      if (!["PHONE_NUMBER", "WABA", "BUSINESS"].includes(type)) continue;
      const detail = Array.isArray(entity?.additional_info)
        ? entity.additional_info.map((item: unknown) => String(item)).join(" ")
        : String(entity?.additional_info || "");
      if (/#?141006|payment method|payment|pagamento|billing/i.test(detail)) {
        return "A Meta bloqueou esta conta por problema no método de pagamento (código 141006). Revise a cobrança em Faturamento e tente novamente após a liberação da Meta";
      }
      if (["BLOCKED", "UNAVAILABLE", "RESTRICTED"].includes(status)) return `envio bloqueado na ${type}`;
      if (status === "LIMITED") {
        if (!/display name has not been approved|quality|reputation|messaging limit/i.test(detail)) return `envio limitado na ${type}`;
      }
    }
    if (["BLOCKED", "UNAVAILABLE", "RESTRICTED"].includes(String(scope?.can_send_message || "").toUpperCase())) return "envio bloqueado na Meta";
  }
  if (inst.templates_auto_status === "PAUSADO_REJEICOES") return "fila pausada por reprovações";
  if (inst.templates_auto_pausado_ate && new Date(inst.templates_auto_pausado_ate) > new Date()) return "fila pausada temporariamente";
  return null;
}
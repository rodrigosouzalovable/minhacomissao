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
  const restriction = metaMessagingRestriction(inst);
  if (restriction) return restriction;
  if (inst.templates_auto_status === "PAUSADO_REJEICOES") return "fila pausada por reprovações";
  if (inst.templates_auto_pausado_ate && new Date(inst.templates_auto_pausado_ate) > new Date()) return "fila pausada temporariamente";
  return null;
}

export function metaMessagingRestriction(inst: any): string | null {
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
      const errors = Array.isArray(entity?.errors) ? entity.errors : [];
      const errorDetail = errors.map((error: any) =>
        [error?.error_code, error?.error_description, error?.possible_solution].filter(Boolean).join(" ")
      ).join(" ");
      if (["BLOCKED", "UNAVAILABLE", "RESTRICTED", "LIMITED"].includes(status) && /#?141006|payment method|payment|pagamento|billing/i.test(`${detail} ${errorDetail}`)) {
        return "A Meta bloqueou esta conta WhatsApp por problema no método de pagamento (código 141006). Abra Faturamento desta instância, confira o cartão e eventuais pendências da conta WhatsApp vinculada, depois clique em Verificar pagamento. Tente aplicar novamente somente após a Meta confirmar a liberação.";
      }
      if (["BLOCKED", "UNAVAILABLE", "RESTRICTED"].includes(status)) {
        const codes = errors.map((error: any) => String(error?.error_code || "")).filter(Boolean).join(", ");
        const scopeLabel = type === "WABA" ? "conta WhatsApp" : type === "BUSINESS" ? "empresa" : "número";
        return `A Meta restringiu esta ${scopeLabel}${codes ? ` (código ${codes})` : " (sem código informado)"}. Abra WhatsApp Manager desta instância e confira as restrições da conta. Após resolver, verifique a saúde e tente aplicar novamente.`;
      }
      if (status === "LIMITED") {
        if (!/display name has not been approved|quality|reputation|messaging limit/i.test(detail)) return `envio limitado na ${type}`;
      }
    }
    if (["BLOCKED", "UNAVAILABLE", "RESTRICTED"].includes(String(scope?.can_send_message || "").toUpperCase())) return "envio bloqueado na Meta";
  }
  return null;
}
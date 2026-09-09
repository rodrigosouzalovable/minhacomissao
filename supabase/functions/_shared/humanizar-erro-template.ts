// Tradução de erros da Meta na criação de templates + detecção de falha temporária.
// Espelha src/lib/humanizarErroTemplate.ts para uso nas Edge Functions.

/**
 * Erro temporário da Meta: a chamada falhou, o template NÃO foi analisado.
 * Deve ser reenviado automaticamente, sem contar como reprovação.
 */
export function ehErroTemporario(texto?: string | null): boolean {
  const s = String(texto || "").toLowerCase();
  if (!s) return false;
  // Erros de cadastro/permissão nunca são temporários.
  if (
    s.includes("already exists") || s.includes("já existe") ||
    s.includes("invalid_format") || s.includes("invalid format") ||
    s.includes("permission") || s.includes("#190") || s.includes("#200") ||
    s.includes("expired") || s.includes("unauthorized") ||
    s.includes("header") || s.includes("cabeçalho") || s.includes("cabecalho") ||
    s.includes("example") || s.includes("exemplo") ||
    s.includes("category") || s.includes("language")
  ) return false;

  return (
    s.includes("unexpected error") ||
    s.includes("please retry") ||
    s.includes("try again") ||
    s.includes("tente novamente") ||
    s.includes("http 500") || s.includes("http 502") || s.includes("http 503") ||
    s.includes("http 504") || s.includes("http 429") ||
    s.includes("code 2,") || s.includes("code 2]") || s.includes('"code":2') ||
    s.includes("code 4,") || s.includes("code 4]") || s.includes('"code":4') ||
    s.includes("rate limit") || s.includes("too many") ||
    s.includes("timeout") || s.includes("timed out") ||
    s.includes("temporar") ||
    s.includes("network") || s.includes("fetch failed") ||
    s.includes("service unavailable") || s.includes("internal server error")
  );
}

export function humanizarErroTemplate(erroBruto?: string | null): string {
  const raw = (erroBruto || "").toString().trim();
  if (!raw) return "Erro desconhecido ao criar o template.";
  const s = raw.toLowerCase();

  if (ehErroTemporario(raw)) {
    return "Instabilidade momentânea nos servidores da Meta — a Meta pediu para tentar de novo mais tarde. O template não foi analisado nem reprovado.";
  }
  if (
    (s.includes("header") || s.includes("cabeçalho") || s.includes("cabecalho")) &&
    (s.includes("expected") || s.includes("esperad") || s.includes("missing") || s.includes("não contém") || s.includes("nao contem"))
  ) {
    return "O cabeçalho do template está incompleto: preencha o texto do cabeçalho, envie a mídia de amostra, ou salve o template sem cabeçalho.";
  }
  if (s.includes("body") && (s.includes("example") || s.includes("exemplo"))) {
    return "Falta o exemplo de alguma variável do corpo. A Meta exige um valor de exemplo para cada variável.";
  }
  if (s.includes("invalid_format") || s.includes("invalid format")) {
    return "A Meta recusou o formato do template (variável sem exemplo, variável no início/fim, duas variáveis seguidas ou espaços duplicados).";
  }
  if (s.includes("already exists") || s.includes("duplicate") || s.includes("já existe") || s.includes("#2388023")) {
    return "Já existe um template com esse nome e idioma nessa conta.";
  }
  if (s.includes("limit") && s.includes("template")) {
    return "Essa conta atingiu o limite de templates permitido pela Meta.";
  }
  if (s.includes("permission") || s.includes("#200") || s.includes("not have permission")) {
    return "O token dessa instância não tem permissão na conta WhatsApp (WABA) informada.";
  }
  if (s.includes("access token") || s.includes("#190") || s.includes("unauthorized") || s.includes("401")) {
    return "O token de acesso dessa instância está inválido ou expirado. Reconecte a instância.";
  }
  if (s.includes("button") || s.includes("botão") || s.includes("botao")) {
    return "Há problema em algum botão do template: texto vazio, URL inválida ou telefone incorreto.";
  }
  if (s.includes("category")) {
    return "A categoria escolhida não combina com o conteúdo do template.";
  }
  if (s.includes("language")) {
    return "O idioma informado é inválido para essa conta. Use pt_BR.";
  }
  if (s.includes("waba_id") || s.includes("access_token ausente")) {
    return "A instância está sem WABA ID ou sem token cadastrado.";
  }
  return raw.length > 400 ? raw.slice(0, 400) + "…" : raw;
}

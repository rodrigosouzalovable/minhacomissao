// Traduz erros da Meta na criação/aprovação de templates para explicações acionáveis.
export function humanizarErroTemplate(erroBruto?: string | null): string {
  const raw = (erroBruto || "").toString().trim();
  if (!raw) return "Erro desconhecido ao criar o template.";
  const s = raw.toLowerCase();

  if (
    (s.includes("header") || s.includes("cabeçalho") || s.includes("cabecalho")) &&
    (s.includes("expected") || s.includes("esperad") || s.includes("missing") || s.includes("não contém") || s.includes("nao contem"))
  ) {
    return "O cabeçalho do template está incompleto: ele foi marcado como cabeçalho mas está sem texto (ou sem o arquivo de amostra). Preencha o texto do cabeçalho, envie a mídia de amostra, ou salve o template sem cabeçalho.";
  }
  if (s.includes("body") && (s.includes("example") || s.includes("exemplo"))) {
    return "Falta o exemplo de alguma variável do corpo. A Meta exige um valor de exemplo para cada variável ({{1}} ou {{nome}}).";
  }
  if (s.includes("invalid_format") || s.includes("invalid format")) {
    return "A Meta recusou o formato do template. Normalmente é variável sem exemplo, variável no início/fim do texto, duas variáveis seguidas ou espaços duplicados.";
  }
  if (s.includes("already exists") || s.includes("duplicate") || s.includes("já existe") || s.includes("#2388023")) {
    return "Já existe um template com esse nome e idioma nessa conta. Use outro nome ou apague o template antigo na conta da Meta.";
  }
  if (s.includes("#100") && s.includes("param")) {
    return "Um dos campos enviados à Meta é inválido. Revise nome, categoria, idioma, botões e cabeçalho do template.";
  }
  if (s.includes("limit") && s.includes("template")) {
    return "Essa conta atingiu o limite de templates permitido pela Meta. Apague templates não usados antes de criar novos.";
  }
  if (s.includes("permission") || s.includes("#200") || s.includes("not have permission")) {
    return "O token dessa instância não tem permissão na conta WhatsApp (WABA) informada. Reconecte a instância ou revise o WABA ID.";
  }
  if (s.includes("access token") || s.includes("expired") || s.includes("#190") || s.includes("unauthorized") || s.includes("401")) {
    return "O token de acesso dessa instância está inválido ou expirado. Reconecte a instância nas configurações Meta.";
  }
  if (s.includes("button") || s.includes("botão") || s.includes("botao")) {
    return "Há problema em algum botão do template: texto vazio, URL inválida ou telefone em formato incorreto.";
  }
  if (s.includes("category")) {
    return "A categoria escolhida não combina com o conteúdo do template. Textos promocionais só passam como MARKETING.";
  }
  if (s.includes("language")) {
    return "O idioma informado é inválido para essa conta. Use pt_BR.";
  }
  if (s.includes("waba_id") || s.includes("access_token ausente")) {
    return "A instância está sem WABA ID ou sem token cadastrado. Complete o cadastro da instância.";
  }
  if (s.includes("upload") && s.includes("mídia")) {
    return raw; // já é mensagem nossa, detalhada
  }
  if (s.includes("rate limit") || s.includes("#4") || s.includes("too many")) {
    return "A Meta limitou temporariamente as criações de template nessa conta. Aguarde alguns minutos e reenvie as falhas.";
  }

  return raw.length > 400 ? raw.slice(0, 400) + "…" : raw;
}

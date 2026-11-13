// Traduz erros da Meta na criação/aprovação de templates para explicações acionáveis.
export function humanizarErroTemplate(erroBruto?: string | null): string {
  const raw = (erroBruto || "").toString().trim();
  if (!raw) return "Erro desconhecido ao criar o template.";
  const s = raw.toLowerCase();
  if (s === "copia_automatica_desativada") return "A cópia automática de templates está desligada neste número. Use o botão Templates do card para aplicar manualmente.";
  if (s === "instancia_de_teste") return "Este número é de teste do aquecimento e não recebe templates.";
  if (s === "none") return "A Meta recusou um modelo anterior sem informar o motivo. Exclua o modelo recusado na BM e tente aplicar novamente.";

  if (s.includes("141006") || s.includes("payment method") || s.includes("método de pagamento")) {
    return "A Meta informou problema no método de pagamento desta conta WhatsApp (código 141006). Abra Faturamento no card, confira o cartão e eventuais pendências da conta WhatsApp vinculada — não apenas da BM. Depois clique em Verificar pagamento e tente aplicar novamente após a Meta confirmar a liberação.";
  }

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

export type ErroMetaDetalhe = { code?: number; error_subcode?: number; fbtrace_id?: string; message?: string; type?: string };

/** Explicação acionável a partir do código da Meta (Graph API). */
export function explicarErroMetaPorCodigo(e?: ErroMetaDetalhe | null): string | null {
  if (!e) return null;
  const code = Number(e.code ?? 0);
  const sub = Number(e.error_subcode ?? 0);
  const msg = (e.message || "").toLowerCase();
  if (code === 200 && (sub === 5258005 || msg.includes("api access blocked")))
    return "A Meta bloqueou o acesso do APLICATIVO dono deste token (não é o número). Trocar só o token não resolve se for do mesmo app. Faça: 1) developers.facebook.com → seu app → Painel/Alertas: veja se há restrição, verificação da empresa pendente ou app desativado; 2) confira se o app está em modo Ativo (Live); 3) em business.facebook.com → Usuários do sistema, gere o token NO MESMO app vinculado à WABA, com as permissões whatsapp_business_management e whatsapp_business_messaging e acesso total à WABA; 4) se o app estiver restrito, gere o token por outro app ativo da BM e atualize aqui.";
  if (code === 190) return "Token expirado ou inválido. Gere um novo token permanente pelo usuário do sistema da BM e atualize no card.";
  if (code === 10 || code === 200) return "O token não tem permissão para esta WABA/número. Dê ao usuário do sistema acesso total à WABA e as permissões whatsapp_business_management e whatsapp_business_messaging, e gere o token de novo.";
  if (code === 100 || code === 33) return "O ID do número ou da WABA não pertence a este token. Confira o Phone ID e o WABA ID no WhatsApp Manager e se o token é da mesma BM.";
  if (code === 4 || code === 80008 || code === 613) return "Limite de chamadas da Meta atingido. Aguarde alguns minutos e tente de novo.";
  if (code === 368 || code === 131031) return "A conta foi restringida pela Meta. Veja Qualidade da conta no WhatsApp Manager e solicite revisão.";
  return null;
}

export function detalheTecnicoMeta(e?: ErroMetaDetalhe | null): string | null {
  if (!e?.code) return null;
  return `Meta código ${e.code}${e.error_subcode ? ` / subcódigo ${e.error_subcode}` : ""}${e.fbtrace_id ? ` · rastreio ${e.fbtrace_id}` : ""}${e.message ? ` · "${e.message}"` : ""}`;
}

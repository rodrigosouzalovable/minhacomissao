// Traduz erros técnicos de envio para uma explicação amigável ao usuário leigo.
// Mantém o texto original disponível separadamente para debug avançado.

export function humanizarErroEnvio(erroBruto?: string | null): string {
  const raw = (erroBruto || "").toString();
  if (!raw) return "Erro desconhecido durante o envio.";

  const s = raw.toLowerCase();

  if (
    s.includes("not on whatsapp") ||
    s.includes("não está no whatsapp") ||
    s.includes("nao esta no whatsapp") ||
    s.includes("destinatário não tem whatsapp") ||
    s.includes("destinatario nao tem whatsapp") ||
    s.includes("destinatário não tem whatsapp ativo") ||
    s.includes("destinatario nao tem whatsapp ativo") ||
    s.includes("esse destinatário não tem whatsapp") ||
    s.includes("esse destinatario nao tem whatsapp") ||
    s.includes("recusado pela uazapi")
  ) {
    return "A instância UAZAPI está conectada; o problema é o destinatário. Testei os formatos possíveis do número e a UAZAPI recusou esse contato como sem WhatsApp ativo/não respondível. O IAGO não vai insistir automaticamente nesse contato.";
  }

  // #100 — número/objeto inacessível pelo token atual (removido do WABA, migrou de BM
  // ou o app perdeu permissão). Precisa reconectar a instância na Meta.
  if (
    s.includes("unsupported post request") ||
    (s.includes("object with id") && s.includes("does not exist")) ||
    (s.includes("#100") && s.includes("missing permissions"))
  ) {
    return "Esse número não está mais acessível pela API da Meta (#100). Normalmente significa que ele foi removido/desabilitado do WhatsApp Business Account, migrou de Business Manager, ou o token do app perdeu permissão sobre ele. Reconecte a instância (token e Phone Number ID) no Business Manager ou envie por outra instância. O número foi retirado do pool de envios automaticamente.";
  }

  // #131031 — Business Account bloqueada/em revisão pela Meta. Nada passa por esse
  // número enquanto o bloqueio existir (nem resposta na janela de 24h).
  if (s.includes("#131031") || (s.includes("business account") && s.includes("locked"))) {
    return "A conta do Business Manager desta instância está bloqueada pela Meta (#131031). Enquanto o bloqueio existir, a Meta recusa todos os envios desse número — inclusive respostas dentro da janela de 24h. Não é problema de qualidade nem do contato: resolva a restrição no Business Manager (Central de Contas/Qualidade, apelação e método de pagamento) ou responda por outra instância. O número saiu do pool automaticamente e volta sozinho quando a Meta liberar.";
  }

  // #131000 — a Meta aceita a mensagem e rejeita na entrega. Na prática é problema da instância.
  if (s.includes("#131000") || s.includes("something went wrong")) {
    return "A Meta aceitou o envio mas rejeitou a entrega por essa instância (#131000). Quase sempre é problema do próprio número — nome de exibição em análise/reprovado, qualidade rebaixada ou pendência de pagamento no Business Manager — e não do contato. Envie esse contato por outra instância saudável.";
  }

  // Número sem WhatsApp / não entregável
  if (s.includes("message undeliverable") || s.includes("#131026")) {
    return "Não foi possível entregar: o número provavelmente não tem WhatsApp ativo, mudou de titular ou não aceita mensagens de empresas. Não é falha da instância.";
  }
  // Pendência de faturamento na conta Meta
  if (s.includes("business eligibility payment issue") || s.includes("#131042") || s.includes("eligibility")) {
    return "A Business Manager desta instância está com pendência de pagamento/elegibilidade na Meta (#131042). Não é qualidade do número nem problema do contato: a Meta recusa os envios até o faturamento ficar em ordem. No Business Manager, vá em Configurações de pagamento e (1) troque/adicione um cartão de crédito válido com compras internacionais liberadas, (2) pague as faturas em aberto, (3) defina esse cartão como principal, e confirme que a verificação de negócio da BM está concluída. Como a pendência é da BM, resolver isso libera todos os números vinculados a ela. Depois de regularizar, use \"Revalidar na Meta\" no card (ou aguarde a checagem automática): o número volta sozinho para o pool.";
  }

  // Nome de exibição em análise
  if (s.includes("pending_review") || s.includes("display name")) {
    return "O nome de exibição dessa instância está em análise ou foi reprovado pela Meta. Enquanto isso, a entrega pode ser bloqueada. Use outra instância até a aprovação.";
  }


  // HTML retornado ao invés de JSON — instância caiu / Meta devolveu página de erro
  if (s.includes("unexpected token") && (s.includes("<") || s.includes("html"))) {
    return "A instância respondeu com uma página HTML em vez do formato esperado. Geralmente significa que ela ficou fora do ar por alguns segundos ou a Meta devolveu uma página de erro. Tente novamente mais tarde.";
  }
  if (s.includes("not valid json") || s.includes("invalid json") || s.includes("json.parse")) {
    return "A instância devolveu uma resposta fora do formato esperado. Costuma acontecer quando ela fica instável por alguns segundos.";
  }

  // Timeouts / rede
  if (s.includes("timeout") || s.includes("timed out") || s.includes("etimedout")) {
    return "A instância demorou demais para responder e o envio foi cancelado. Provavelmente está sobrecarregada ou com a internet instável.";
  }
  if (s.includes("network") || s.includes("fetch failed") || s.includes("econnreset") || s.includes("econnrefused") || s.includes("enotfound")) {
    return "Não foi possível se conectar com a instância. Verifique se ela está online.";
  }

  // Erros HTTP comuns da Meta / gateway
  if (s.includes("502") || s.includes("bad gateway")) {
    return "O servidor da Meta devolveu um erro temporário (Bad Gateway). Costuma resolver sozinho em alguns minutos.";
  }
  if (s.includes("503") || s.includes("service unavailable")) {
    return "O serviço da Meta está temporariamente indisponível. Aguarde alguns minutos e tente novamente.";
  }
  if (s.includes("504")) {
    return "O servidor da Meta demorou demais para responder (timeout). Tente novamente mais tarde.";
  }
  if (s.includes("429") || s.includes("rate limit") || s.includes("too many requests") || s.includes("#80007") || s.includes("#131056")) {
    return "A Meta limitou os envios dessa instância (Rate limit exceeded). O contato voltou para a fila, a instância pausou automaticamente pelo tempo informado pela Meta e retomará em ritmo mais lento. Use 1 msg/segundo por instância no Modo Rajada.";
  }
  if (s.includes("401") || s.includes("unauthorized") || s.includes("invalid token") || s.includes("access token")) {
    return "O token de acesso dessa instância está inválido ou expirado. Reconecte a instância nas configurações Meta.";
  }
  if (s.includes("403") || s.includes("forbidden")) {
    return "A Meta bloqueou esse envio. Pode ser bloqueio da conta, restrição do template ou permissão insuficiente.";
  }
  if (s.includes("404") || s.includes("not found")) {
    return "A instância ou o template não foi encontrado no servidor da Meta.";
  }

  // Erros de conteúdo/template
  if (s.includes("#131053") || s.includes("media upload error")) {
    return "A Meta não conseguiu baixar a imagem do cabeçalho do template neste envio. É uma falha temporária de mídia — o contato volta para a fila e o sistema tenta novamente automaticamente (a imagem agora é enviada por ID, sem novo download a cada mensagem).";
  }
  if (s.includes("template") && (s.includes("not found") || s.includes("does not exist"))) {

    return "O template usado nesse envio não existe ou não está aprovado para essa instância.";
  }
  if (s.includes("template") && s.includes("paused")) {
    return "O template está pausado pela Meta. Escolha outro template ou aguarde a liberação.";
  }
  if (s.includes("recipient") && (s.includes("invalid") || s.includes("not a valid whatsapp"))) {
    return "O número informado não tem WhatsApp ou está no formato incorreto.";
  }
  if (s.includes("phone number") && s.includes("invalid")) {
    return "Número de telefone em formato inválido.";
  }

  // Restrições/pausa da própria instância
  if (s.includes("restrit") || s.includes("pausada") || s.includes("bloqueada")) {
    return "A instância está restrita/pausada. Aguarde a liberação ou use outra instância.";
  }
  if (s.includes("quality") && (s.includes("red") || s.includes("yellow"))) {
    return "A qualidade da instância caiu (YELLOW/RED) e a Meta está limitando os envios. Deixe descansar antes de enviar de novo.";
  }
  if (s.includes("tier") && s.includes("full")) {
    return "A instância atingiu o limite diário de envios do tier atual.";
  }

  // Fallback — mensagem original enxuta
  const enxuta = raw.length > 200 ? raw.slice(0, 200) + "…" : raw;
  return `Falha no envio: ${enxuta}`;
}

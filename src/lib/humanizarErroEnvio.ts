// Traduz erros técnicos de envio para uma explicação amigável ao usuário leigo.
// Mantém o texto original disponível separadamente para debug avançado.

export function humanizarErroEnvio(erroBruto?: string | null): string {
  const raw = (erroBruto || "").toString();
  if (!raw) return "Erro desconhecido durante o envio.";

  const s = raw.toLowerCase();

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

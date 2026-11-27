/** Caixa USA B2B: IAGO vende criação de sites para empresas de brasileiros nos EUA. */
export const FOLDER_USA_B2B_INBOX = '7b3e9a10-4c2d-4f8e-9a61-0d5e2c8b1a47';

export const PRECO_USA = { site: 297 };

export function promptVendasUsa(persona: string): string {
  return [
    `Você é ${persona}, da equipe de tecnologia da Souza Ribeiro (empresa brasileira), falando por WhatsApp com donos de pequenos negócios de brasileiros nos EUA (Flórida, Massachusetts, Nova Jersey e outros).`,
    'CONTEXTO: enviamos antes "Só passando para confirmar se você recebeu nossa mensagem anterior". A empresa respondeu por curiosidade. Encontramos a empresa no Google Maps e ela NÃO tem site próprio. NÃO é cobrança: nunca fale de dívida, CPF, boleto ou credor.',
    'O QUE VENDEMOS: criação de site profissional (one-page moderno, rápido e bonito no celular) com serviços, fotos, avaliações do Google, localização/mapa, horários e botão direto para o WhatsApp da empresa. Pronto em até 3 dias úteis. O dono só manda logo/fotos/serviços; nós fazemos todo o resto.',
    `PREÇO (em dólar): US$ ${PRECO_USA.site}, pagamento ÚNICO, sem mensalidade obrigatória. Domínio próprio (.com) pode ser registrado à parte pelo cliente; se perguntarem de hospedagem/manutenção, diga que o responsável confirma as opções. Pagamento por Zelle, cartão internacional ou PIX no Brasil. Não invente outros preços, descontos, prazos ou garantias de faturamento.`,
    'ÂNCORA: nos EUA uma agência cobra US$ 1.500 a 3.000 por um site. Cliente americano pesquisa no Google antes de contratar; sem site a empresa perde confiança e clientes para o concorrente.',
    'PRIMEIRA RESPOSTA (a mais importante): DIRETA, em UMA mensagem: peça desculpa pela mensagem direta; diga que encontrou a empresa no Google Maps (elogie a reputação) e notou que ela ainda não tem site; explique o que entregamos (site profissional em até 3 dias, com serviços, fotos, mapa e botão de WhatsApp); o preço de cara: US$ 297 pagamento único; e termine oferecendo uma prévia grátis com o nome da empresa. Exemplo: "Oi! Desculpe a mensagem direta. Encontrei a sua empresa no Google Maps, com ótimas avaliações, mas vi que vocês ainda não têm um site próprio. A gente cria sites profissionais em até 3 dias, com seus serviços, fotos, mapa e botão direto pro seu WhatsApp, passando mais confiança pra novos clientes. Custa só US$ 297, pagamento único. Quer que eu monte uma prévia grátis com o nome da sua empresa?"',
    'ROTEIRO DEPOIS: 1) Responda dúvidas aplicando ao ramo dele. 2) Se aceitar a prévia, peça o nome exato da empresa e, se possível, logo/fotos, e diga que o responsável envia a prévia nesta conversa. 3) Feche: confirme US$ 297 pagamento único e diga que o responsável envia o Zelle/link de pagamento aqui.',
    'OBJEÇÕES: "já tenho Instagram/Facebook" rede social não aparece bem no Google e o cliente americano confia mais em site; o site junta tudo e manda pro WhatsApp. "é caro" um único cliente novo já paga. "não tenho tempo" a gente faz tudo, ele só aprova. "é golpe?" ele vê a prévia antes de pagar qualquer coisa. "tem mensalidade?" não, pagamento único. "fica em inglês?" sim, pode ser em inglês, português ou bilíngue.',
    'RESPOSTA AUTOMÁTICA: se vier saudação automática/menu ("Thanks for contacting", "obrigado pelo contato", "escolha uma opção"), NÃO encerre: responda UMA mensagem curta explicando quem você é e o motivo, porque o dono lê depois. Se vier outra automática depois, encerre.',
    'IDIOMA: respeite o idioma solicitado pelo cliente; caso contrário, use o idioma da última mensagem clara dele, inclusive espanhol, inglês e português. Mensagens ambíguas como "?", "ok" e "no" não mudam o idioma. Sem evidência, comece em inglês. Se disser "No entiendo", "I don’t understand", "Não entendo" ou pedir outro idioma, peça desculpas e reenvie a explicação completa da oferta nesse idioma, com US$ 297, pagamento único, até 3 dias úteis e prévia grátis; não é recusa nem repetição indevida. Continue nesse idioma. Não invente avaliações, licenças ou informações da empresa.',
    'ENCERRAR: marque "encerrar":true e "mensagens":[] quando não tiver interesse, recusar (após no máximo uma tentativa de esclarecer) ou pedir para parar. Não mande despedida.',
    'Escreva como pessoa real: EXATAMENTE 1 mensagem por resposta; a primeira até 5 linhas, as demais até 2 linhas; no máximo 1 emoji; termine com pergunta quando fizer sentido. Não repita o que já foi dito. Nunca diga que é IA ou robô; se perguntarem, diga que é da equipe comercial.',
    'INTERESSE: marque "interessado":true quando demonstrar interesse real (pergunta preço/prazo, aceita prévia, manda fotos/logo, pergunta Zelle/pagamento ou quer fechar). Em "interesse_resumo" resuma em até 15 palavras incluindo o ramo.',
    'Responda SOMENTE com JSON válido: {"mensagens":["texto"],"escalar":false,"motivo":"","interessado":false,"interesse_resumo":"","encerrar":false}',
  ].join('\n');
}

export const FALLBACK_USA = 'Oi! Desculpe a mensagem direta. Encontrei a sua empresa no Google Maps, com ótimas avaliações, mas vi que vocês ainda não têm um site próprio. A gente cria sites profissionais em até 3 dias, com seus serviços, fotos, mapa e botão direto pro seu WhatsApp. Custa só US$ 297, pagamento único. Quer que eu monte uma prévia grátis com o nome da sua empresa?';

export const FALLBACK_USA_EN = "Hi! Sorry for the direct message. I found your business on Google Maps with great reviews, but noticed you don't have a website yet. We build professional websites in up to 3 days, with your services, photos, map and a button straight to your WhatsApp. It's only US$ 297, one-time payment. Want me to make a free preview with your business name?";
/** Heurística simples: a mensagem do cliente parece estar em inglês. */
export function pareceIngles(texto: string): boolean {
  const t = ` ${String(texto || '').toLowerCase().replace(/[^a-z' ]+/g, ' ')} `;
  if (/\benglish\b/.test(t)) return true;
  const en = (t.match(/ (the|you|your|please|what|is|are|we|i|hi|hello|this|who|do|speak|thanks|thank|not|interested|sorry|yes|no) /g) || []).length;
  const pt = (t.match(/ (o|a|voce|nao|sim|que|de|obrigado|oi|ola|bom|dia|tarde|recebi|recebemos) /g) || []).length;
  return en >= 2 && en > pt;
}

export type IdiomaUsa = 'es' | 'en' | 'pt';

function normalizarIdioma(texto: string): string {
  return String(texto || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[’']/g, '').trim();
}

/** Only customer messages establish language; outgoing campaign copy must never override it. */
export function idiomaClienteUsa(texto: string, entradasAnteriores: string[] = []): IdiomaUsa {
  for (const mensagem of [texto, ...entradasAnteriores]) {
    const t = normalizarIdioma(mensagem);
    if (/\b(?:in|en|em|habla|speak|fale|idioma|language)\s+(?:espanol|spanish|castellano)\b|^\s*(?:espanol|spanish|castellano)\s*\??$/.test(t)) return 'es';
    if (/\b(?:in|en|em|habla|speak|fale|idioma|language)\s+(?:english|ingles)\b|^\s*(?:english|ingles)\s*\??$/.test(t)) return 'en';
    if (/\b(?:in|en|em|habla|speak|fale|idioma|language)\s+(?:portugues|portuguese)\b|^\s*(?:portugues|portuguese)\s*\??$/.test(t)) return 'pt';
    if (/\b(entiendo|comprendo|hablo|hola|gracias|quiero|puedes|disculpa|sitio|cuanto|espanol)\b/.test(t)) return 'es';
    if (/\b(entendo|compreendo|nao|voce|obrigado|quero|pode|quanto|oi|ola|sim|portugues)\b/.test(t)) return 'pt';
    if (/\b(understand|english|hello|hi|thanks|please|yes|your|website|how|what|interested)\b/.test(t) || pareceIngles(mensagem)) return 'en';
  }
  return 'en';
}

export function precisaReexplicarIdiomaUsa(texto: string): boolean {
  const t = normalizarIdioma(texto);
  // Explicit refusals and opt-outs never become an excuse to send another offer.
  if (/\b(stop|unsubscribe|sair|pare|no me interesa|not interested|nao tenho interesse)\b/.test(t)) return false;
  return /\b(no (?:entiendo|comprendo)|nao (?:entendo|compreendo)|(?:dont|do not|cant|cannot) understand)\b/.test(t)
    || /\b(espanol|spanish|castellano|english|ingles|portugues|portuguese)\b/.test(t);
}

export const FALLBACK_USA_ES = '¡Hola! Disculpa, te explico en español. Encontramos tu empresa en Google Maps y ofrecemos crear un sitio web profesional con tus servicios, fotos, mapa y un botón de WhatsApp, en hasta 3 días hábiles. El precio es US$ 297, un pago único, sin mensualidad obligatoria. ¿Quieres que preparemos una vista previa gratis con el nombre de tu empresa?';

export function fallbackVendasUsa(idioma: IdiomaUsa): string {
  if (idioma === 'es') return FALLBACK_USA_ES;
  if (idioma === 'pt') return 'Desculpe pela mensagem no outro idioma. Criamos um site profissional com seus serviços, fotos, mapa e botão de WhatsApp em até 3 dias úteis, por US$ 297, pagamento único, sem mensalidade obrigatória. Quer uma prévia grátis com o nome da sua empresa?';
  return 'Sorry about the language mix-up! We create professional websites with your services, photos, map and a WhatsApp button in up to 3 business days for US$ 297, a one-time payment with no mandatory monthly fee. Would you like a free preview with your business name?';
}

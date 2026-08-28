/** Geração 100% local do conteúdo do esboço de site (sem IA, sem custo). */

export interface LeadEsboco {
  nome: string;
  telefone: string | null;
  telefone_internacional: string | null;
  endereco: string | null;
  categoria: string | null;
  avaliacao: number | null;
  total_avaliacoes: number | null;
}

export interface PaletaEsboco {
  primaria: string;
  secundaria: string;
  destaque: string;
  fundo: string;
  fundoAlt: string;
  texto: string;
  textoSuave: string;
  fonteTitulo: string;
}

export type EstiloEsboco = "moderno" | "classico" | "colorido";

export const ESTILOS_ESBOCO: Array<{ valor: EstiloEsboco; label: string }> = [
  { valor: "moderno", label: "Moderno / minimalista" },
  { valor: "classico", label: "Clássico / confiança" },
  { valor: "colorido", label: "Colorido / energia" },
];

const PALETAS: Record<EstiloEsboco, PaletaEsboco> = {
  moderno: {
    primaria: "#1f7a5a",
    secundaria: "#0f3d2e",
    destaque: "#c8e6d5",
    fundo: "#ffffff",
    fundoAlt: "#f5f9f7",
    texto: "#12201a",
    textoSuave: "#5b6b64",
    fonteTitulo: "'Georgia', serif",
  },
  classico: {
    primaria: "#1c3d6e",
    secundaria: "#0d2144",
    destaque: "#dbe6f5",
    fundo: "#ffffff",
    fundoAlt: "#f4f6fa",
    texto: "#141d2b",
    textoSuave: "#5c6779",
    fonteTitulo: "'Times New Roman', serif",
  },
  colorido: {
    primaria: "#e2542c",
    secundaria: "#7a2410",
    destaque: "#ffe0d3",
    fundo: "#ffffff",
    fundoAlt: "#fff6f1",
    texto: "#231208",
    textoSuave: "#6f5147",
    fonteTitulo: "'Trebuchet MS', sans-serif",
  },
};

function hexValido(c: string | undefined): string | null {
  if (!c) return null;
  const v = c.trim();
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v) ? v : null;
}

/** Paleta do estilo, sobrescrita pelas cores reais observadas no nicho quando existirem. */
export function paletaPorEstilo(estilo: EstiloEsboco, paletaNicho?: string[] | null): PaletaEsboco {
  const base = { ...PALETAS[estilo] };
  const cores = (paletaNicho ?? []).map(hexValido).filter((c): c is string => !!c);
  if (cores[0]) base.primaria = cores[0];
  if (cores[1]) base.secundaria = cores[1];
  if (cores[2]) base.destaque = cores[2];
  return base;
}

function soDigitos(v: string | null | undefined): string {
  return (v ?? "").replace(/\D/g, "");
}

export function whatsappLink(l: LeadEsboco): string | null {
  const num = soDigitos(l.telefone_internacional ?? l.telefone);
  if (!num) return null;
  const full = num.startsWith("55") ? num : `55${num}`;
  return `https://wa.me/${full}`;
}

export function telefoneExibicao(l: LeadEsboco): string {
  return l.telefone ?? l.telefone_internacional ?? "(inserir telefone)";
}

interface Servico {
  titulo: string;
  texto: string;
}

interface Faq {
  p: string;
  r: string;
}

export interface ConteudoEsboco {
  categoria: string;
  cidade: string;
  heroTitulo: string;
  heroSubtitulo: string;
  ctaPrincipal: string;
  sobreTitulo: string;
  sobreTexto: string;
  servicos: Servico[];
  passos: Servico[];
  faq: Faq[];
  depoimentos: Array<{ nome: string; texto: string }>;
  notaTexto: string;
  secoes: string[];
}

const SERVICOS_POR_NICHO: Array<{ chaves: string[]; servicos: Servico[]; passos?: Servico[] }> = [
  {
    chaves: ["nutri"],
    servicos: [
      { titulo: "Consulta nutricional completa", texto: "Avaliação detalhada de rotina, histórico e objetivos para montar um plano que caiba na sua vida." },
      { titulo: "Plano alimentar individual", texto: "Cardápio flexível com alimentos que você realmente gosta, sem dietas impossíveis de manter." },
      { titulo: "Acompanhamento contínuo", texto: "Ajustes periódicos e suporte entre as consultas para você não parar no meio do caminho." },
      { titulo: "Avaliação corporal", texto: "Medidas e composição corporal para acompanhar a evolução com dados, não com achismo." },
    ],
  },
  {
    chaves: ["odonto", "dentist"],
    servicos: [
      { titulo: "Avaliação e diagnóstico", texto: "Exame clínico completo com plano de tratamento explicado de forma clara e sem surpresas." },
      { titulo: "Clareamento e estética", texto: "Procedimentos para devolver a confiança no seu sorriso com segurança." },
      { titulo: "Limpeza e prevenção", texto: "Cuidado periódico que evita tratamentos caros no futuro." },
      { titulo: "Urgências", texto: "Atendimento rápido para dor e quebras, com agendamento pelo WhatsApp." },
    ],
  },
  {
    chaves: ["advog", "jurid"],
    servicos: [
      { titulo: "Consultoria jurídica", texto: "Análise do seu caso com orientação objetiva sobre riscos e caminhos possíveis." },
      { titulo: "Atuação contenciosa", texto: "Acompanhamento processual do início ao fim, com atualizações constantes." },
      { titulo: "Acordos e negociações", texto: "Solução rápida quando ela é mais vantajosa que a disputa judicial." },
      { titulo: "Atendimento humanizado", texto: "Linguagem simples, sem juridiquês, para você entender cada etapa." },
    ],
  },
  {
    chaves: ["estetic", "beleza", "salão", "salao", "cabelo", "barbe"],
    servicos: [
      { titulo: "Atendimento personalizado", texto: "Cada procedimento pensado para o seu tipo de pele, cabelo e rotina." },
      { titulo: "Produtos profissionais", texto: "Só trabalhamos com marcas de confiança e protocolos seguros." },
      { titulo: "Ambiente acolhedor", texto: "Espaço tranquilo, higienizado e preparado para você relaxar." },
      { titulo: "Pacotes e sessões", texto: "Planos com melhor custo por sessão para resultados consistentes." },
    ],
  },
  {
    chaves: ["academia", "personal", "pilates", "cross"],
    servicos: [
      { titulo: "Avaliação física", texto: "Ponto de partida claro para montar um treino seguro e eficiente." },
      { titulo: "Treino individualizado", texto: "Programa adaptado ao seu objetivo, nível e tempo disponível." },
      { titulo: "Acompanhamento próximo", texto: "Correção de execução e evolução de carga a cada ciclo." },
      { titulo: "Planos flexíveis", texto: "Horários e frequências que se encaixam na sua rotina." },
    ],
  },
];

const SERVICOS_GENERICOS: Servico[] = [
  { titulo: "Atendimento sob medida", texto: "Entendemos a sua necessidade antes de propor qualquer solução." },
  { titulo: "Equipe experiente", texto: "Profissionais com anos de atuação na região e resultados comprovados." },
  { titulo: "Transparência no orçamento", texto: "Você sabe exatamente o que está contratando, sem custos escondidos." },
  { titulo: "Suporte pelo WhatsApp", texto: "Resposta rápida no canal que você já usa todos os dias." },
];

function servicosPara(categoria: string): Servico[] {
  const cat = categoria.toLowerCase();
  const match = SERVICOS_POR_NICHO.find((n) => n.chaves.some((k) => cat.includes(k)));
  return match ? match.servicos : SERVICOS_GENERICOS;
}

export function montarConteudoEsboco(
  lead: LeadEsboco,
  ctx: { categoriaBusca?: string; localizacao?: string; secoesNicho?: string[] | null },
): ConteudoEsboco {
  const categoria = (lead.categoria ?? ctx.categoriaBusca ?? "Serviços").trim();
  const cidade = (ctx.localizacao ?? "sua região").trim();
  const nota = lead.avaliacao;
  const totalAv = lead.total_avaliacoes;

  const notaTexto =
    nota != null
      ? `${nota.toFixed(1).replace(".", ",")} de 5 no Google${totalAv ? ` · ${totalAv} avaliações reais` : ""}`
      : "Referência em atendimento na região";

  return {
    categoria,
    cidade,
    heroTitulo: `${categoria} em ${cidade} com atendimento de verdade`,
    heroSubtitulo: `A ${lead.nome} cuida de cada cliente com atenção individual, agenda organizada e resultado que você percebe desde o primeiro atendimento.`,
    ctaPrincipal: "Falar no WhatsApp agora",
    sobreTitulo: `Sobre a ${lead.nome}`,
    sobreTexto: `A ${lead.nome} atende em ${cidade} com foco em ${categoria.toLowerCase()}. O trabalho começa ouvindo você: entender a sua rotina, o seu objetivo e o que já tentou antes. A partir disso, montamos um caminho realista, com acompanhamento próximo e comunicação simples pelo WhatsApp. [EDITAR: incluir formação, tempo de atuação e diferenciais reais]`,
    servicos: servicosPara(categoria),
    passos: [
      { titulo: "1. Você chama no WhatsApp", texto: "Conta rapidamente o que precisa e já recebe os horários disponíveis." },
      { titulo: "2. Atendimento agendado", texto: "Avaliação completa e proposta clara, sem enrolação e sem compromisso escondido." },
      { titulo: "3. Acompanhamento", texto: "Você segue com suporte próximo até alcançar o resultado combinado." },
    ],
    faq: [
      { p: "Como faço para agendar?", r: `Basta clicar no botão de WhatsApp e enviar uma mensagem. A ${lead.nome} responde em horário comercial e confirma o melhor horário para você.` },
      { p: "Onde ficam localizados?", r: `${lead.endereco ?? "[EDITAR: endereço completo]"} — fácil acesso e orientação de chegada enviada junto com a confirmação.` },
      { p: "Quais as formas de pagamento?", r: "Pix, dinheiro e cartão de crédito ou débito, com opção de parcelamento. [EDITAR: confirmar condições]" },
      { p: "Preciso levar algum documento ou exame?", r: "Se você já tiver exames ou documentos anteriores, traga — ajuda muito. Caso não tenha, orientamos no atendimento." },
      { p: "Atendem em qual horário?", r: "Segunda a sexta, 08h às 18h, e sábado pela manhã. [EDITAR: ajustar horários reais]" },
    ],
    depoimentos: [
      { nome: "Cliente atendido em " + cidade, texto: "Atendimento excelente do começo ao fim. Me senti realmente ouvido e o resultado apareceu rápido. [DEPOIMENTO — substituir por real e autorizado]" },
      { nome: "Cliente atendido em " + cidade, texto: "Profissionalismo e clareza. Explicaram tudo antes e cumpriram o que combinaram. [DEPOIMENTO — substituir por real e autorizado]" },
      { nome: "Cliente atendido em " + cidade, texto: "Recomendo para qualquer pessoa que procura algo sério em " + cidade + ". [DEPOIMENTO — substituir por real e autorizado]" },
    ],
    notaTexto,
    secoes: (ctx.secoesNicho ?? []).filter(Boolean).slice(0, 12),
  };
}

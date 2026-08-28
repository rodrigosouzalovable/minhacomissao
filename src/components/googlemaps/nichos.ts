export interface Nicho {
  nome: string;
  dica: string;
}

export interface GrupoNicho {
  grupo: string;
  itens: Nicho[];
}

export const NICHOS: GrupoNicho[] = [
  {
    grupo: "Saúde e estética",
    itens: [
      { nome: "clínica odontológica", dica: "Ticket alto e dependência de imagem profissional." },
      { nome: "clínica de estética", dica: "Vende por fotos e antes/depois — site ajuda muito." },
      { nome: "fisioterapia", dica: "Paciente pesquisa no Google antes de agendar." },
      { nome: "psicólogo", dica: "Credibilidade conta muito na escolha." },
      { nome: "clínica veterinária", dica: "Busca local frequente e urgência." },
      { nome: "nutricionista", dica: "Perfil profissional reforça autoridade." },
    ],
  },
  {
    grupo: "Serviços",
    itens: [
      { nome: "advocacia", dica: "Setor que investe em presença digital." },
      { nome: "contabilidade", dica: "Cliente recorrente, ticket mensal." },
      { nome: "arquitetura", dica: "Portfólio visual pede site próprio." },
      { nome: "despachante", dica: "Muita busca local, pouca concorrência online." },
      { nome: "academia", dica: "Precisa mostrar estrutura e planos." },
      { nome: "escola de idiomas", dica: "Captação por formulário funciona bem." },
    ],
  },
  {
    grupo: "Comércio",
    itens: [
      { nome: "pet shop", dica: "Recorrência e público fiel." },
      { nome: "materiais de construção", dica: "Ticket alto, orçamento por WhatsApp." },
      { nome: "floricultura", dica: "Vendas por data comemorativa." },
      { nome: "ótica", dica: "Catálogo visual e localização importam." },
      { nome: "loja de móveis", dica: "Catálogo online aumenta visitas na loja." },
    ],
  },
  {
    grupo: "Alimentação",
    itens: [
      { nome: "restaurante", dica: "Menu online é o pedido mais comum." },
      { nome: "pizzaria", dica: "Pedido direto pelo WhatsApp converte bem." },
      { nome: "buffet e eventos", dica: "Ticket alto e decisão baseada em fotos." },
      { nome: "confeitaria", dica: "Encomendas por catálogo visual." },
      { nome: "hamburgueria", dica: "Concorrência forte, site diferencia." },
    ],
  },
  {
    grupo: "Casa e reforma",
    itens: [
      { nome: "marmoraria", dica: "Orçamento sob medida, ticket alto." },
      { nome: "vidraçaria", dica: "Busca local por urgência." },
      { nome: "empresa de reformas", dica: "Portfólio de obras vende sozinho." },
      { nome: "piscinas", dica: "Ticket alto, decisão por imagem." },
      { nome: "dedetizadora", dica: "Serviço urgente pesquisado no Google." },
    ],
  },
  {
    grupo: "Automotivo",
    itens: [
      { nome: "oficina mecânica", dica: "Muitos sem site e com boas avaliações." },
      { nome: "auto elétrica", dica: "Busca por proximidade e urgência." },
      { nome: "funilaria e pintura", dica: "Antes/depois convence o cliente." },
      { nome: "estética automotiva", dica: "Público que valoriza apresentação." },
      { nome: "borracharia", dica: "Volume alto de busca local." },
    ],
  },
];

export const NICHOS_DESTAQUE = [
  "clínica odontológica",
  "clínica de estética",
  "advocacia",
  "arquitetura",
  "academia",
  "pet shop",
  "buffet e eventos",
  "oficina mecânica",
  "barbearia",
  "materiais de construção",
  "contabilidade",
  "fisioterapia",
  "restaurante",
  "floricultura",
  "imobiliária",
];

export const TODOS_NICHOS: Nicho[] = [
  ...NICHOS.flatMap((g) => g.itens),
  { nome: "barbearia", dica: "Agenda cheia e público jovem." },
  { nome: "imobiliária", dica: "Catálogo de imóveis exige site." },
];

export function dicaDoNicho(nome: string): string | undefined {
  return TODOS_NICHOS.find((n) => n.nome === nome)?.dica;
}

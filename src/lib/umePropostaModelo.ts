// Modelo editável da proposta UME: campos {xxx} preenchidos com os dados da consulta.
export interface DadosProposta {
  nome: string;
  cpf: string;
  diasAtraso: number | null;
  fase: string;
  totalSemJuros: number | null;
  totalComJuros: number | null;
  totalProposta: number | null;
  avista: number | null;
  parcelas: { parcelas: number; valorParcela: number }[];
  tabela: string;
}

export const VARIAVEIS_PROPOSTA: { chave: string; descricao: string }[] = [
  { chave: 'primeiro_nome', descricao: 'Primeiro nome' },
  { chave: 'nome', descricao: 'Nome completo' },
  { chave: 'cpf', descricao: 'CPF' },
  { chave: 'dias_atraso', descricao: 'Dias de atraso' },
  { chave: 'fase', descricao: 'Fase' },
  { chave: 'total_sem_juros', descricao: 'Total sem juros' },
  { chave: 'total_com_juros', descricao: 'Total com juros' },
  { chave: 'total_proposta', descricao: 'Total da tabela escolhida' },
  { chave: 'avista', descricao: 'Valor à vista' },
  { chave: 'parcelas_lista', descricao: 'Lista de parcelas' },
  { chave: 'maior_parcelamento', descricao: 'Maior parcelamento' },
  { chave: 'menor_parcela', descricao: 'Menor parcela' },
  { chave: 'tabela', descricao: 'Nome da tabela' },
];

export const PARCELA_MINIMA = 100;

const fmt = (v: number | null | undefined) =>
  v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 });

/** Parcelas oferecidas: 2x ou mais e nunca abaixo de R$ 100. */
export function parcelasOferecidas(d: DadosProposta) {
  return d.parcelas.filter((p) => p.parcelas >= 2 && p.valorParcela >= PARCELA_MINIMA);
}

export function valoresProposta(d: DadosProposta): Record<string, string> {
  const opcoes = parcelasOferecidas(d);
  const maior = opcoes.reduce<typeof opcoes[number] | null>((m, p) => (!m || p.parcelas > m.parcelas ? p : m), null);
  return {
    primeiro_nome: (d.nome || '').trim().split(/\s+/)[0] || '',
    nome: d.nome || '',
    cpf: d.cpf || '',
    dias_atraso: d.diasAtraso == null ? '—' : String(d.diasAtraso),
    fase: d.fase || '',
    total_sem_juros: fmt(d.totalSemJuros),
    total_com_juros: fmt(d.totalComJuros),
    total_proposta: fmt(d.totalProposta),
    avista: fmt(d.avista),
    parcelas_lista: opcoes.map((p) => `• ${p.parcelas}x de ${fmt(p.valorParcela)}`).join('\n'),
    maior_parcelamento: maior ? `${maior.parcelas}x de ${fmt(maior.valorParcela)}` : '',
    menor_parcela: maior ? fmt(maior.valorParcela) : '',
    tabela: d.tabela,
  };
}

export function preencherModelo(texto: string, d: DadosProposta): string {
  const v = valoresProposta(d);
  return texto.replace(/\{\s*([a-z_]+)\s*\}/g, (m, k) => (k in v ? v[k] : m));
}

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Detecção local (reserva da IA): troca valores atuais do cliente pelos campos. */
export function detectarCamposLocal(texto: string, d: DadosProposta): string {
  const v = valoresProposta(d);
  let out = texto;
  // lista de parcelas: linhas "Nx de R$ ..." consecutivas viram {parcelas_lista}
  out = out.replace(/(?:^[^\n]*\d{1,2}\s*x\s*de\s*R\$\s?[\d.,]+[^\n]*(?:\n|$)){2,}/gim, (m) => `{parcelas_lista}${m.endsWith('\n') ? '\n' : ''}`);
  const pares: [string, string][] = [
    [v.maior_parcelamento, 'maior_parcelamento'],
    [v.total_com_juros, 'total_com_juros'],
    [v.total_sem_juros, 'total_sem_juros'],
    [v.avista, 'avista'],
    [v.total_proposta, 'total_proposta'],
    [v.cpf, 'cpf'],
    [v.nome, 'nome'],
    [v.primeiro_nome, 'primeiro_nome'],
  ];
  for (const [valor, chave] of pares) {
    if (!valor || valor === '—' || valor.length < 2) continue;
    const alvo = valor.replace(/\u00a0/g, ' ');
    const re = new RegExp(escapar(alvo).replace(/ /g, '[\\s\\u00a0]?'), 'g');
    out = out.replace(re, `{${chave}}`);
  }
  // nome escrito em caixa diferente
  if (v.primeiro_nome) out = out.replace(new RegExp(`\\b${escapar(v.primeiro_nome)}\\b`, 'gi'), '{primeiro_nome}');
  return out;
}

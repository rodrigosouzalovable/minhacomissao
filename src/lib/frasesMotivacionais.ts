// Pool fixo de frases motivacionais (selecionadas pelo dia do ano)
export const FRASES_MOTIVACIONAIS: { texto: string; autor?: string }[] = [
  // Garra / disciplina (15)
  { texto: 'Disciplina é fazer o combinado mesmo quando ninguém está olhando.' },
  { texto: 'O esforço de hoje é o resultado do próximo mês.' },
  { texto: 'Você não precisa estar inspirado — precisa estar comprometido.' },
  { texto: 'Quem liga um a mais bate a meta. Simples assim.' },
  { texto: 'O telefone que você não pegou é o acordo que outro fechou.' },
  { texto: 'Constância vale mais que talento. Vai todo dia.' },
  { texto: 'Resultado é consequência. Foque no processo.' },
  { texto: 'A próxima ligação pode ser a virada do seu mês.' },
  { texto: 'Você só perde quando para de tentar.' },
  { texto: 'Profissional de verdade entrega no dia ruim também.' },
  { texto: 'Cada "não" te aproxima do próximo "sim".' },
  { texto: 'Quem mais tenta é quem mais ganha. Estatística pura.' },
  { texto: 'Trabalha duro em silêncio. O resultado faz o barulho.' },
  { texto: 'Sua melhor versão começa quando você decide.' },
  { texto: 'Não espere segunda. Comece agora.' },

  // Foco em meta (15)
  { texto: 'Meta clara, ação certeira. Sabe onde quer chegar?' },
  { texto: 'Divide a meta por dia. Aí ela vira combinado.' },
  { texto: 'Um pouco todo dia bate qualquer maratona de última hora.' },
  { texto: 'Quem mira no teto acerta a parede. Mira no céu.' },
  { texto: 'Foco é dizer não pro que não te aproxima da meta.' },
  { texto: 'Hoje é mais um dia útil. Aproveita cada hora.' },
  { texto: 'Olha o placar agora — e decide o que fazer nas próximas 2h.' },
  { texto: 'Bater meta é matemática + ritmo. Ajusta o ritmo.' },
  { texto: 'Acordo grande é acordo grande. Acordo pequeno também conta.' },
  { texto: 'Não despreze valor pequeno. Soma sempre soma.' },
  { texto: 'Cada cliente fechado é um passo para o seu prêmio.' },
  { texto: 'Bate a meta semanal e o mês se resolve sozinho.' },
  { texto: 'Você está mais perto do que ontem. Continua.' },
  { texto: 'Final de mês é feito em começo de mês. Acelera agora.' },
  { texto: 'Quem planeja o dia rende 3x mais que quem reage.' },

  // Virada de jogo (10)
  { texto: 'Tá atrás? Ótimo. Viradas viram histórias.' },
  { texto: 'O melhor dia para começar a virar foi ontem. O segundo melhor é hoje.' },
  { texto: 'Quem volta de baixo bate mais forte. Vai.' },
  { texto: 'Mês ruim não existe. Existe mês onde você desistiu cedo.' },
  { texto: 'A virada começa com 1 acordo. Foca em 1.' },
  { texto: 'Não dá pra mudar a manhã, mas dá pra dominar a tarde.' },
  { texto: 'Sua história favorita é cheia de viradas. Faz a sua.' },
  { texto: 'Hoje é o dia. Sempre é hoje.' },
  { texto: 'Mete o pé no acelerador. Atrás você não fica.' },
  { texto: 'O improvável vira certo quando você se recusa a parar.' },

  // Gratidão / equipe (10)
  { texto: 'Cada acordo seu ajuda uma família a respirar. Não é pouca coisa.' },
  { texto: 'A equipe inteira torce por você. Devolve em resultado.' },
  { texto: 'Você é parte do motor. Sem você, nada gira.' },
  { texto: 'Cliente bem atendido volta. Trata bem hoje.' },
  { texto: 'O que você constrói aqui sustenta sua vida lá fora.' },
  { texto: 'Gratidão pelo seu trabalho. Agora bora pra cima.' },
  { texto: 'Time forte é time que se cobra com respeito. Cobre-se.' },
  { texto: 'Bom humor abre porta. Sorri antes de discar.' },
  { texto: 'Você inspira quem está ao seu lado. Lidera pelo exemplo.' },
  { texto: 'Trabalhar com propósito muda o resultado. Lembra do seu.' },
];

export function fraseDoDia(date = new Date()): { texto: string; autor: string } {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  const dayOfYear = Math.floor(diff / 86400000);
  const idx = dayOfYear % FRASES_MOTIVACIONAIS.length;
  const f = FRASES_MOTIVACIONAIS[idx];
  return { texto: f.texto, autor: f.autor || 'Equipe' };
}

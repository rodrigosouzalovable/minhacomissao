

## Adicionar scroll ao Ranking

### O que sera feito

Ajustar o componente `RankingMensal.tsx` para garantir que a lista de funcionarios tenha uma altura maxima fixa com scroll vertical, permitindo rolar para ver todos os participantes.

### Alteracao

**Arquivo:** `src/components/RankingMensal.tsx`

- Ajustar o `ScrollArea` para ter uma altura maxima mais explicita (ex: `max-h-[350px]`) aplicada diretamente na area da lista
- Garantir que o `CardContent` e o `ScrollArea` respeitem a altura maxima e ativem o scroll vertical quando houver mais funcionarios do que cabem na tela

A mudanca e simples: apenas ajustar as classes CSS do `ScrollArea` para forcar a altura maxima e permitir overflow com scroll.


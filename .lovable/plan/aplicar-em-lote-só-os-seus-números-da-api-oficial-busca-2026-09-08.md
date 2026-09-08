# Aplicar em lote: só os seus números da API oficial + busca

## Situação hoje

Na aba de templates Meta, o campo "Aplicar em lote" lista **todos** os números que o seu login enxerga. Conferi no banco: existem 42 números da API oficial e 81 espelhos dos números do WhatsApp (UAZAPI), e 6 dos oficiais estão vinculados a parceiros (agropet e 5 AMARAL). Como o seu login é administrador, a lista mostra tudo isso junto — daí a confusão.

Também conferi as regras de acesso: um usuário com a tag "Parceiro Meta" já só consegue enxergar os números vinculados a ele ou cadastrados por ele. Ele **não** vê os seus. Esse lado está correto e não precisa de mudança.

## O que vou fazer

1. A lista de "Aplicar em lote" passa a mostrar somente números da API oficial Meta — os espelhos dos números do WhatsApp (UAZAPI) saem da tela.
2. Para o seu login de administrador, os números vinculados a parceiros também saem da lista: ficam apenas os que você conectou.
3. Cada parceiro continua vendo apenas os números dele nessa mesma tela.
4. Novo campo de busca acima da lista, filtrando por nome ou por número (digitando com ou sem pontuação).
5. O "Todas as instâncias ativas" e o contador do topo passam a considerar apenas a lista já filtrada, para não selecionar nada escondido.

## Detalhes técnicos

- `src/pages/MetaTemplates.tsx`:
  - carregamento de instâncias com `.eq('provider', 'meta')`;
  - carregar `meta_instance_parceiros` (ids vinculados) e, quando o usuário não é parceiro, excluir esses ids da lista; quando é parceiro, manter o que a RLS já devolve;
  - `useUserRole`/`useUserPermissions` para distinguir admin de parceiro;
  - novo estado `buscaInst` + `instFiltradas` (nome ou `display_phone` normalizado por dígitos), usado no checkbox "todas", no contador e no `map` da lista;
  - selecionar/limpar respeita o filtro atual.
- Sem mudança de banco, de regras de acesso ou de Edge Functions. Nenhum novo cron, polling ou Realtime — sem impacto de custo.

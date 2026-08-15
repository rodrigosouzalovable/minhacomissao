Ajustar a aba "BMs" para funcionar como seletor flutuante e exibir os WhatsApps vinculados na aba "Instâncias".

## O que será feito

1. **Reaproveitar o estado de seleção de BMs** (`bmSel`) como filtro global entre as abas "BMs" e "Instâncias".
2. **Aba BMs**: manter apenas o botão "Selecionar BMs" com o popover flutuante e, abaixo, mostrar um resumo compacto das BMs selecionadas (badges). Remover a exibição dos cards de WhatsApps dessa aba.
3. **Aba Instâncias**: aplicar o filtro por BM selecionada, exibindo somente os WhatsApps vinculados às BMs escolhidas.
4. **Adicionar indicador de filtro** na aba "Instâncias": mostrar chips das BMs selecionadas e um botão "Limpar filtro" para voltar a exibir todas as instâncias.
5. **Preservar a contagem** na aba "BMs" (`BMs (N)`) e ajustar a contagem da aba "Instâncias" para refletir o filtro ativo (ex: "Instâncias filtradas (X de Y)").

## Alterações técnicas

- Editar `src/pages/ConfigurarMeta.tsx`:
  - Substituir o conteúdo de `TabsContent value="bms"` para mostrar apenas o popover de seleção + resumo das BMs selecionadas.
  - Na aba "Instâncias", filtrar o array `instancias` antes de renderizar (respeitando `parceiroMeta` se hoje já aplica algum filtro).
  - Adicionar um header de filtro acima da lista de instâncias com badges das BMs selecionadas e botão de limpar.
  - Garantir que a transição entre as abas mantenha o estado `bmSel` (ele já está no componente, então basta reutilizá-lo).

## Não será alterado

- Banco de dados ou RLS.
- Edge functions.
- Lógica de vinculação de BM nas instâncias (Select dentro do card).
- Componentes de templates, faturas ou webhooks.

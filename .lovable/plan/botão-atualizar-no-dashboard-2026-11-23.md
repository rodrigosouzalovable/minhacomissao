# Botão "Atualizar" no Dashboard

## O que muda
- Ao lado do título "Dashboard", um botão **Atualizar** com ícone de setas.
- Ao clicar, busca de novo todos os valores da página (recebimentos, comissões, metas, cards) sem recarregar a página.
- Enquanto atualiza, o ícone gira e o botão fica desabilitado; ao terminar, aparece "Dados atualizados" com o horário.

## Custo
- Só busca quando você clica. Nenhuma atualização automática nova, sem aumento de custo.

## Detalhes técnicos
- `src/pages/Dashboard.tsx`: usar `refetch`/`isFetching` do `useQuery(['dashboard', ...])`; também invalidar outras queries do dashboard (componentes filhos) com `queryClient.invalidateQueries({ queryKey: ['dashboard'] })` e chaves usadas pelos cards.
- Botão shadcn `variant="outline"` com ícone `RefreshCw` (`animate-spin` durante busca) e toast de confirmação.

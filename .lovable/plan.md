## Objetivo
Quando não houver nenhuma opção viável de parcelamento (mínimo 2x com parcela ≥ R$ 100,00), a mensagem deve mostrar apenas a opção À VISTA, sem a seção de parcelamento.

## Regras
- Parcelamento só é exibido se existir ao menos uma quantidade N ∈ {4, 8, 12, 15} em que `valorTotal / N ≥ 100`.
- Hoje o fallback em `buildOpcoesParcelado` cria uma opção com `Math.floor(valorTotal/100)` parcelas, o que gera situações como "1x de R$ 141,05" (caso da Alexania, dívida R$ 235,09). Esse fallback será removido.
- Se nenhuma opção atender à regra (≥ 2x e parcela ≥ R$ 100), `{opcoes_parcelado}` retorna string vazia e o bloco "✅ *PARCELADO* ..." é omitido da mensagem.
- Se houver pelo menos uma opção válida, comportamento atual é mantido.

## Alterações

### `src/lib/parseCobmaisPlanilha.ts`
- Em `buildOpcoesParcelado`: remover o fallback `Math.floor(valorTotal/100)`. Filtrar `[4,8,12,15]` mantendo apenas N com `valorTotal/N ≥ 100` e `N ≥ 2`. Se a lista ficar vazia, retornar string vazia.

### `src/pages/ModeloMensagem.tsx`
- No `TEMPLATE_PADRAO`, separar a parte "PARCELADO" em um placeholder único `{bloco_parcelado}` (ou montar condicionalmente em `renderMensagem`):
  - Se `opcoes_parcelado` vazio → não inclui o subtítulo "💰 Condições especiais para hoje" com bloco parcelado; mantém somente o bloco À VISTA.
  - Se `opcoes_parcelado` não vazio → mensagem atual.
- Ajustar `renderMensagem` para remover linhas em branco extras quando o bloco parcelado é omitido.

## Fora de escopo
- Mudar percentuais padrão de desconto.
- Persistência, importação ou colunas da tabela.

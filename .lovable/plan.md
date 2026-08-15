# Ajuste visual do seletor de BMs

## Problema
O seletor de Business Managers (BM) na aba BMs foi criado, mas não exibe todas as BMs e a caixa está pequena, dificultando a visualização das informações.

## Solução
Ajustar o popover de seleção de BMs em `src/pages/ConfigurarMeta.tsx` para:

1. Aumentar a largura e altura da caixa de seleção.
2. Manter a barra de rolagem lateral visível para permitir visualizar todos os itens.

## Alterações técnicas

- Em `src/pages/ConfigurarMeta.tsx`, na área do `<PopoverContent>` da aba BMs:
  - Aumentar `PopoverContent` de `w-[320px]` para `w-[420px]`.
  - Aumentar `ScrollArea` de `max-h-[300px]` para `max-h-[480px]`.
  - Ajustar padding interno dos itens para melhor legibilidade.

## Validação
- Verificar se o popover exibe a barra de rolagem lateral ao conter mais BMs que a altura permitida.
- Confirmar que todos os campos (nome, Business ID) aparecem sem truncar.

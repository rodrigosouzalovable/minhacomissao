# Ajuste de botões de chamada no Inbox Meta Oficial

## Objetivo
Padronizar a aparência do botão de chamada no cabeçalho da conversa do Inbox Meta Oficial, removendo o destaque azul e o botão de histórico de chamadas.

## Alterações planejadas

### 1. `src/pages/InboxMeta.tsx`

- Remover a importação `PhoneIncoming` (linha 15) e o componente `HistoricoChamadasDialog` (linha 42), pois o botão de registro de chamadas será eliminado.
- Remover o estado `histChamadasOpen` e sua abertura/fechamento (linhas 212 e 2413-2414).
- No grupo de ações da conversa ativa, ajustar o botão de telefone:
  - Sempre usar `variant="outline"` (igual aos demais ícones do cabeçalho), removendo a lógica que alterna para `default` quando autorizado.
  - Manter os estados `disabled`, `ocupado` e `vozOn` — quando desabilitado, o `disabled` do `Button` já aplica `opacity-50`, garantindo aspecto inativo.
- Remover o segundo botão de registro de chamadas (`PhoneIncoming`) que aparece ao lado do botão de ligar.

## Resultado esperado
O cabeçalho da conversa exibe apenas o botão de telefone para iniciar uma chamada, com a mesma aparência dos ícones vizinhos (outline). Quando a chamada não está disponível, o botão fica esmaecido (inativo). O botão de histórico de chamadas desaparece.

## Riscos
Nenhum. Apenas mudança visual de apresentação e remoção de um botão secundário; a lógica de chamada via `MetaCallContext` e as Edge Functions permanecem inalteradas.
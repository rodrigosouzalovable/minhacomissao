---
name: Rodízio circular do Inbox Meta
description: Fila de atendentes avança sequencialmente por caixa, sem compensar carga histórica ou diária; IAGO ocupa somente a própria vez
type: feature
---
- A distribuição automática segue `meta_atendimento_fila.ordem` em ciclo por caixa de mensagens.
- Nunca escolher por menor carga histórica ou do dia; atendente recém-ativado não recebe conversas para "compensar".
- Só participam responsáveis da caixa com perfil, fila e permissão `atende_inbox_meta` ativos.
- Prioridades por acordo, consulta ou atendente que iniciou a conversa não avançam o ponteiro do rodízio.
- A atribuição é atômica no banco para mensagens concorrentes não escolherem a mesma posição.
- O IAGO participa como qualquer outro atendente e recebe somente a vez dele.
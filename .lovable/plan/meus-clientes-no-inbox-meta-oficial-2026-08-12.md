# "Meus Clientes" no Inbox Meta Oficial

Novo modo de visualização abaixo dos botões Todas / Não lidas, que mostra apenas as conversas com a etiqueta do próprio usuário logado, com filtros de período e de marcadores (qualificações).

## 1. Botão "Meus Clientes"

- Fica em uma linha nova, logo abaixo de "Todas / Não lidas".
- Ao ativar, a lista deixa de ser a caixa atual e passa a mostrar **todas as conversas com a etiqueta do usuário logado**, em todo o histórico — sem limite de caixa de mensagens e incluindo conversas já arquivadas.
  - Ex.: no login da Anna Flavia, aparecem só os contatos com a etiqueta "Atendente: Anna Flavia".
- Se o usuário não tiver etiqueta de atendente, mostra aviso "Nenhuma etiqueta de atendente vinculada ao seu login".
- Ao desativar, tudo volta ao comportamento atual (caixa/abas/filtros normais).
- Admin também usa o botão: vê os clientes da própria etiqueta (para ver de outros, segue usando o filtro de etiquetas já existente).

## 2. Filtro por data (início e fim)

- Aparece só quando "Meus Clientes" está ativo: dois campos de data + botão de limpar (mesmo padrão do seletor de datas já usado no sistema).
- Filtra pela data da última mensagem da conversa, considerando o dia inteiro no fuso de Brasília (início 00:00, fim 23:59).
- Pode preencher só data inicial (a partir de) ou só final (até).

## 3. Filtro por marcadores (qualificações)

- Campo de seleção múltipla com as qualificações ativas (cada uma com sua cor).
- Selecionando um ou mais marcadores, a lista mostra apenas os clientes com aquelas qualificações.
- Contador do que está selecionado e opção "Limpar".
- Sem seleção = todos os marcadores.

## 4. Comportamento da lista

- Cabeçalho da lista indica o modo: "Meus Clientes (N)".
- Cada conversa continua abrindo normalmente, com etiquetas, qualificação e menu de contexto atuais.
- Busca por nome/telefone continua funcionando dentro do modo "Meus Clientes".
- Paginação em lotes (padrão atual de "carregar mais") para não pesar.

## Detalhes técnicos

- `src/pages/InboxMeta.tsx`:
  - novos estados `modoMeusClientes`, `mcDataIni`, `mcDataFim`, `mcQualificacoes: Set<string>`.
  - resolução da etiqueta própria: procura em `meta_whatsapp_etiquetas` o registro `Atendente: <nome do profile>` (normalização igual à já usada em `etiquetasMenu`, com o mapa de apelidos existente).
  - busca dedicada quando o modo está ativo: `meta_whatsapp_contato_etiquetas` filtrado por `etiqueta_id` do usuário (paginado em blocos de IDs) → `meta_whatsapp_contatos` por `id in (...)` com `ultima_mensagem_em` entre as datas, ordenado desc, sem filtro de `folder_id`/`arquivado`; depois carrega etiquetas e qualificações dos contatos retornados como já é feito.
  - filtro de marcadores aplicado sobre `qualifPorContato` (memo no cliente); quando há marcadores selecionados, as qualificações dos contatos do lote já vêm carregadas.
- Componentes reutilizados: `DateRangePicker` para o período e `Popover` + `Checkbox` para os marcadores; cores via tokens do design system.
- Sem novas tabelas, sem cron, sem novo canal Realtime — custo praticamente inalterado (só consultas sob demanda ao clicar no botão).

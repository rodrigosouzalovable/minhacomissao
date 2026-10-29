# Caixa PADRÃO sempre visível no Inbox Meta + botão Atualizar

## O que muda
- A caixa **PADRÃO** passa a ser carregada primeiro e fica sempre como a primeira da lista para quem tem acesso a ela.
- Ao abrir a aba, a tela não esconde mais a PADRÃO quando a internet ou o servidor demoram para responder. Ela só some para quem realmente não tem acesso.
- Um botão **Atualizar** (ícone de setas) fica ao lado das caixas. Ao clicar, ele recarrega as caixas e a permissão da PADRÃO, gira enquanto carrega e volta para a PADRÃO se você tiver acesso a ela.
- Nada muda nas permissões: quem não tem acesso continua sem ver a PADRÃO.

## Causa provável (a confirmar ao implementar)
Hoje, se a consulta de acesso à PADRÃO falha ou acontece antes do seu perfil de administrador terminar de carregar, a tela conclui "sem acesso" e não verifica de novo. Assim, a PADRÃO só volta se a página for recarregada.

## Detalhes técnicos (`src/pages/InboxMeta.tsx`)
- `fetchFolders`: aguardar o carregamento do papel do usuário (`isAdmin`) antes de decidir. Se a consulta a `meta_inbox_default_members` der erro, manter o estado anterior e tentar mais uma vez após 2 s, em vez de gravar `podeVerPadrao=false`.
- Consultar as caixas e a permissão da PADRÃO ao mesmo tempo e só marcar `padraoVerificado` quando as duas terminarem bem.
- Novo botão `RefreshCw` no começo da linha das caixas: chama `fetchFolders()`, zera a escolha manual da caixa e seleciona a PADRÃO se ela for permitida. Fica desativado enquanto carrega.
- Sem novas consultas automáticas repetidas, portanto sem custo extra.

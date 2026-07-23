## Mover botão "Janela 24h" para Inbox Meta Oficial

### O que fazer

1. **Remover** o botão "🟢 Janela 24h" e o dialog importado de `src/pages/EnvioMeta.tsx` (bloco de Destinatários).

2. **Adicionar** o botão "🟢 Janela 24h" na barra de filtros/ações da aba **Inbox Meta Oficial** (`src/pages/InboxMeta.tsx`), próximo aos filtros de etiquetas.

3. **Adaptar** `src/components/meta/Janela24hDialog.tsx` ao contexto de Inbox:
   - Manter busca de contatos com interação nas últimas 24h (bolinha verde >1h restante, amarela <1h).
   - Substituir a ação "Importar para destinatários" por **"Abrir conversa"**: ao clicar em um contato, fecha o dialog e abre aquela conversa no painel do Inbox (mesmo comportamento do clique em uma conversa da lista).
   - Manter busca por nome/telefone, filtro por instância e contagem regressiva em tempo real.

4. **Comportamento visual**: quando o filtro estiver ativo (dialog aberto ou modo aplicado), a lista continua acessível — o dialog funciona como uma "lupa" de janelas 24h que permite pular direto para a conversa desejada.

### Detalhes técnicos

- Reaproveitar a query já existente em `Janela24hDialog` sobre `meta_whatsapp_contatos` (última interação nas 24h).
- Em `InboxMeta.tsx`, expor um handler `onSelectConversa(telefone, instanceId)` que o dialog chamará para selecionar a conversa correspondente na lista já carregada (ou fazer fetch pontual caso não esteja na página atual).
- Não alterar RLS nem edge functions.
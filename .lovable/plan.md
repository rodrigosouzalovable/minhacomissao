# Corrigir lentidão ao digitar no diálogo "Nova conversa"

## Problema

Os campos do diálogo `Nova conversa` (telefone, mensagem, instância) usam estados (`novoTelefone`, `novaMensagem`, `novaInstanciaId`) declarados no topo do componente `WhatsAppInbox.tsx` (1176 linhas). A cada tecla digitada, **o componente inteiro re-renderiza**, incluindo:

- A lista lateral de conversas (com filtros, ordenação, badges)
- A janela de chat ativa com todas as mensagens
- Subscrições realtime e cálculos derivados

Isso causa o atraso visível: o caractere demora a aparecer no campo enquanto o React reconcilia centenas de nós.

## Solução

Extrair o diálogo "Nova conversa" para um componente isolado **`NovaConversaDialog`** com estado local próprio. Assim, digitar nos campos não dispara mais o re-render do `WhatsAppInbox`.

### Mudanças

1. **Novo arquivo**: `src/components/inbox/NovaConversaDialog.tsx`
   - Componente que recebe `open`, `onOpenChange`, `instancias`, e um callback `onConversaCriada(telefone, instanciaId)`.
   - Mantém internamente `telefone`, `mensagem`, `instanciaId`, `enviando`, `comboOpen`.
   - Faz a chamada para `send-whatsapp` (mesma lógica de `handleNovaConversa` atual).
   - Reseta os campos ao fechar.

2. **`src/pages/WhatsAppInbox.tsx`**:
   - Remover os estados `novoTelefone`, `novaMensagem`, `novaInstanciaId`, `enviandoNova`, `instanciaComboOpen`.
   - Remover o JSX inline do diálogo (linhas ~1067-1136) e a função `handleNovaConversa`.
   - Renderizar `<NovaConversaDialog open={novaConversaOpen} onOpenChange={setNovaConversaOpen} instancias={instancias} onConversaCriada={...} />` no lugar.
   - No callback `onConversaCriada`, recarregar contatos e selecionar o novo contato (reaproveitar lógica existente).

### Resultado esperado

Digitar no campo "Mensagem" (ou "Telefone") fica instantâneo, pois apenas o `NovaConversaDialog` re-renderiza — o restante da página de Inbox permanece estático.

Nenhuma alteração de banco de dados, de Edge Function ou de comportamento — apenas refatoração de performance no frontend.
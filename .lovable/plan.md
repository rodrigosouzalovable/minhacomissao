

# Botão do avião com duas opções: Marcar como enviado ou Enviar mensagem

## O que muda

No `src/components/PaymentReminders.tsx`, o botão do ícone de avião (Send) será substituído por um dropdown com duas opções:

1. **Enviar mensagem** — envia a mensagem WhatsApp individualmente para aquele cliente usando a instância selecionada e os templates configurados, salvando o progresso no banco.
2. **Marcar como enviado** — comportamento atual, apenas marca sem enviar.

## Implementação

### `src/components/PaymentReminders.tsx`
- Importar `DropdownMenu`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuTrigger` dos componentes UI.
- Substituir o `<Button>` do avião por um `<DropdownMenu>` com trigger no mesmo ícone.
- Adicionar item "Enviar mensagem" que:
  - Valida se há instância selecionada
  - Gera a mensagem usando `gerarMensagem` (mesma lógica do envio em lote)
  - Chama `send-whatsapp` via edge function
  - Salva status no `lembrete_envio_progresso`
  - Atualiza o `statusMap` via `markAsEnviado`
- Adicionar item "Marcar como enviado" com a lógica atual.

### `src/contexts/WhatsAppSendingContext.tsx`
- Expor uma função `sendSingleMessage` que recebe o item, instância, templates e operadorNome, executa o envio individual e persiste o resultado.


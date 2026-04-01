

## Plano: Desativar respostas automáticas do chatbot

O chatbot atual processa todas as mensagens recebidas e responde automaticamente (incluindo notificações ao admin). A mudança fará com que as mensagens sejam apenas salvas no Inbox, sem nenhuma resposta automática.

### Mudança única: `whatsapp-chatbot/index.ts`

Após o bloco de salvamento no Inbox (linha ~683), adicionar um `return` imediato para mensagens de clientes (não-admin, não-fromMe). Isso fará com que:

1. A mensagem continue sendo salva nas tabelas `whatsapp_mensagens` e `whatsapp_contatos` (bloco existente, linhas 615-683)
2. **Imediatamente após salvar**, a função retorna sem processar debounce, regras, templates ou enviar qualquer resposta
3. Mensagens `fromMe` (saída) continuam sendo rastreadas normalmente
4. Mensagens do admin continuam funcionando (ensino, instruções, etc.)

### O que muda
- Cliente envia "Oi" → mensagem salva no Inbox → **nenhuma resposta enviada**
- Admin não recebe mais notificações automáticas tipo "o cliente respondeu algo que eu não soube informar"
- Toda a lógica do chatbot (debounce, regras, templates, IA) fica inativa para mensagens de clientes

### O que permanece
- Salvamento de mensagens no Inbox (entrada e saída)
- Funcionalidades do admin via WhatsApp (teach-chatbot, instruções)
- Rastreamento de mensagens `fromMe`
- Envio manual pelo Inbox continua funcionando via `send-whatsapp`

### Detalhe técnico
Inserir após o bloco `[INBOX] Mensagem salva` (~linha 683) e antes do bloco `fromMe` (~linha 686):

```text
// Se não é fromMe e não é admin, apenas salvar no inbox e parar
if (!isFromMe && !isAdminNumber(telefone)) {
  return Response com success + inbox_only
}
```

Isso efetivamente "desliga" o chatbot sem remover o código, permitindo reativá-lo facilmente no futuro.


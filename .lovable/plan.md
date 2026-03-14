

# Adicionar seletor de WhatsApp e botão "Enviar" no Dialog expandido de Lembretes

## O que será feito

No Dialog expandido (que abre ao clicar no ícone de expandir no sino), adicionar no topo:
1. Um **Select** com todas as instâncias WhatsApp conectadas do usuário
2. Um botão **"Enviar"** que inicia o envio sequencial dos lembretes pendentes

Isso transforma o dialog expandido em uma central de envio de lembretes, sem precisar ir à página de Acionamento.

## Mudanças Técnicas

### `src/components/PaymentReminders.tsx`

1. **Buscar instâncias WhatsApp**: Query na tabela `user_whatsapp_instances` filtrada por `user_id` e `ativo = true`
2. **Estado local**: `selectedInstanceId`, `sending`, `cancelRef`
3. **UI no Dialog** (acima das tabs):
   - Select com as instâncias (mostrando `nome` ou token parcial)
   - Botão "Enviar" (desabilitado se nenhuma instância selecionada ou nenhum lembrete pendente)
   - Barra de progresso durante envio
4. **Lógica de envio**: Reutilizar o mesmo fluxo do `LembretesSection` — invocar `check-payment-reminders` com `user_id`, `instance_token` e `server_url`, depois processar a fila sequencialmente via `process-whatsapp-queue`
5. **Status por item**: Adicionar badges de status (Enviado/Pendente/Erro) nos itens do dialog, cruzando com `whatsapp_fila`

### Arquivo editado
- `src/components/PaymentReminders.tsx`


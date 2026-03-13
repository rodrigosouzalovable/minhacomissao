

# Plano: Mostrar todas as pendencias do sino na seção de Lembretes WhatsApp

## Problema
O sino mostra 33 pendencias (parcelas vencidas, vencendo hoje, vencendo em 3 dias) vindas do hook `usePaymentReminders`, mas a seção de WhatsApp Lembretes só mostra itens da tabela `whatsapp_fila` (mensagens que ja foram agendadas/enviadas). O usuario quer ver TODAS as pendencias ali, com indicacao de se a mensagem foi enviada ou nao.

## Solucao

### Alterar `LembretesSection.tsx`

1. Importar e usar o hook `usePaymentReminders` dentro do componente
2. Buscar os itens da `whatsapp_fila` do dia (como ja faz) para cruzar dados
3. Montar uma lista unificada: para cada pendencia do sino, verificar se existe um registro correspondente na `whatsapp_fila` (cruzando por telefone normalizado) e mostrar o status de envio (Enviado, Pendente, Erro, ou "Nao enviado" se nao esta na fila)
4. Exibir a lista completa em seções: Parcelas Vencidas, Vence Hoje, Vence em 3 dias -- com badge de status de envio ao lado de cada item
5. Manter os controles existentes (iniciar envios, reenviar erros) e a barra de progresso

### Estrutura da lista unificada
- Cada item mostra: nome do cliente, telefone, valor, tipo (D+X / Hoje / 3 dias)
- Badge de status do WhatsApp: "Enviado" (verde), "Pendente" (amarelo), "Erro" (vermelho), "Nao enviado" (cinza) -- baseado no cruzamento com whatsapp_fila

### Arquivo alterado
- `src/components/LembretesSection.tsx`


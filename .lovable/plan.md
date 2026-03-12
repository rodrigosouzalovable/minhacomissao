

# Plano: Adicionar envio de lembretes para parcelas vencidas

## Situação atual
A função `check-payment-reminders` busca apenas parcelas com `data_prevista` igual a hoje ou daqui a 3 dias. Parcelas vencidas (data_prevista < hoje) são ignoradas.

O hook `usePaymentReminders` já busca parcelas vencidas no frontend (tipo `'vencido'`), mas a edge function não gera mensagens para elas.

## Alterações

### 1. Edge Function `check-payment-reminders/index.ts`
- Adicionar uma segunda query para buscar parcelas pendentes com `data_prevista < hoje` (vencidas)
- Para cada parcela vencida, usar o tipo_lembrete `'vencido'`
- Mensagem específica para vencidas:
  > "Olá [cliente_nome], aqui é [operador], do departamento de acordos das Lojas Novo Mundo. Você possui uma parcela no valor de [valor] que venceu no dia [data]. Caso já tenha pago, pode nos enviar o comprovante por gentileza? Caso ainda não tenha pago, consegue realizar o pagamento hoje?"
- Aplicar as mesmas validações: acordo ativo, telefone presente, instância `apenas_lembretes`, verificação de duplicidade, horário comercial
- Limitar vencidas a no máximo 30 dias de atraso para não enviar mensagens muito antigas
- Cada parcela vencida recebe apenas 1 lembrete (deduplicação por `tipo_lembrete = 'vencido'`)

### 2. Disponível para todos os usuários
- A query de vencidas buscará parcelas de TODOS os usuários (não filtrada por user_id), assim como já funciona para as parcelas de hoje/3 dias
- Cada usuário terá suas credenciais WhatsApp resolvidas individualmente (instância `apenas_lembretes` ou profile)

### Sem alterações no banco
- A tabela `whatsapp_fila` já suporta o novo tipo_lembrete ('vencido') pois é campo texto livre


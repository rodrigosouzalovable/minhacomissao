

# Correção: Envio de lembretes via número "Apenas Lembretes"

## Diagnóstico

Encontrei os seguintes problemas:

1. **3 mensagens na fila com erro "WhatsApp disconnected"** - foram agendadas com o token antigo (`e4438332...` do número 62981810202) em vez do token correto (`3a22250d...` do número 62982198675 marcado como "Apenas Lembretes")
2. **6 parcelas vencendo hoje** que nunca foram inseridas na fila (SILVANA, TIAGO, NYLCE, SILVIA, REGINA, DILSIANE)
3. A função `check-payment-reminders` usa credenciais do `profiles` (agora corretas), mas as mensagens de hoje foram criadas antes da correção

## Correções

### 1. Migração SQL (execução imediata)
- Atualizar as 3 mensagens com erro para usar o token correto (`3a22250d...`) e resetar status para `pendente`
- Inserir as 6 parcelas que vencem hoje na fila `whatsapp_fila` com o token correto, agendadas para envio imediato (com intervalos de 5-7 min entre cada)

### 2. Atualizar `check-payment-reminders`
- Além de buscar credenciais do `profiles`, também buscar a instância marcada como `apenas_lembretes = true` na tabela `user_whatsapp_instances` como fonte prioritária de credenciais
- Isso garante que futuras execuções automáticas usem sempre a instância correta


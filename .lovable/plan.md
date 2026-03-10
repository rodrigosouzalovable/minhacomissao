

# Plano: Restringir instância 62981810202 a apenas lembretes + atualizar mensagens

## Problema
A instância do número 62981810202 está sendo usada pelo chatbot para enviar mensagens promocionais ("FEIRÃO LIMPA NOME"). O usuário quer que esse número envie APENAS lembretes de vencimento.

## Alterações

### 1. Migração: adicionar coluna `apenas_lembretes` na tabela `user_whatsapp_instances`
```sql
ALTER TABLE user_whatsapp_instances ADD COLUMN apenas_lembretes boolean NOT NULL DEFAULT false;
```

### 2. Edge function `whatsapp-chatbot/index.ts` (~linha 1075)
Ao buscar a instância, incluir `apenas_lembretes` no select. Se `apenas_lembretes === true`, ignorar a mensagem (não processar pelo chatbot):
```typescript
.select('user_id, ativo, apenas_lembretes')
// ...
if (instanceRecord?.apenas_lembretes) {
  console.log(`[CHATBOT] Instance is reminder-only, ignoring.`);
  return Response({ success: true, ignored: true, reason: 'reminder_only' });
}
```

### 3. Edge function `check-payment-reminders/index.ts` (linhas 169-172)
Atualizar mensagens para o formato exato solicitado:
- **Dia do vencimento:** `"Olá {nome} tudo bem? Meu nome é {operador}, sou do departamento de acordos das Lojas Novo Mundo e estou passando para lembrar que o vencimento da sua parcela no de valor {valor} vence HOJE. Gostaria que enviasse o boleto para pagamento?"`
- **3 dias antes:** `"...vence é dia {data}. Gostaria que enviasse o boleto para pagamento?"`

### 4. UI em `src/pages/Acionamento.tsx`
Adicionar um toggle/switch "Apenas Lembretes" ao lado de cada instância na lista, permitindo marcar uma instância como exclusiva para lembretes (desativa o chatbot nela).


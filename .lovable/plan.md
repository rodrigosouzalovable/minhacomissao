

# Plano: Lista detalhada de destinatários nos "Envios do dia"

## Resumo
Expandir o card "Envios do dia" no LembretesSection para mostrar a lista completa de clientes que receberão/receberam lembretes no dia, com nome, telefone e status de envio. Disponivel para todos os usuarios.

## Problema atual
O card mostra apenas contadores (ex: "15 de 26 mensagens enviadas"). O usuário não consegue ver **quem** vai receber mensagem, nem o status individual.

## Alterações

### 1. Migration: Adicionar coluna `cliente_nome` na tabela `whatsapp_fila`
A tabela `whatsapp_fila` não armazena o nome do cliente. Para evitar joins complexos no frontend, salvar o nome diretamente.

```sql
ALTER TABLE whatsapp_fila ADD COLUMN cliente_nome text;
```

### 2. Edge Function: `check-payment-reminders/index.ts`
No insert na `whatsapp_fila` (linha ~230), adicionar `cliente_nome: acordo.cliente_nome` ao objeto inserido.

### 3. Frontend: `src/components/LembretesSection.tsx`
- Alterar `fetchStats` para trazer também `cliente_nome` e `tipo_lembrete` no select da `whatsapp_fila`
- Armazenar a lista completa de itens da fila em novo state `filaItems`
- Abaixo do progress bar, renderizar uma lista scrollable com:
  - Nome do cliente (truncado)
  - Telefone formatado
  - Badge de status: "Enviado" (verde), "Pendente" (amarelo), "Erro" (vermelho)
  - Tipo de lembrete (ex: "Vence hoje", "D+1", "3 dias")
- Lista com `max-h-60 overflow-y-auto` para não explodir o popover/card
- Exibir para todos os usuários (sem filtro de role)

### 4. Disponibilidade
O LembretesSection já é renderizado dentro da página Acionamento que é acessível conforme permissões do usuário. Cada usuário verá os envios filtrados pela instância que ele selecionou como "WhatsApp Principal para Lembretes" - sem alteração de acesso necessária.


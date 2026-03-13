

# Plano: Adicionar flag "IA Responde" nas instâncias WhatsApp

## Resumo
Adicionar uma nova checkbox "IA Responde" abaixo de "Robô" em cada instância WhatsApp. Quando ativada, o chatbot IA responderá automaticamente mensagens recebidas naquele número usando as regras ensinadas. Se a IA tiver dúvida, notifica o admin no número 62991672674.

## Alterações

### 1. Migration: Adicionar coluna `ia_responde` na tabela `user_whatsapp_instances`
```sql
ALTER TABLE user_whatsapp_instances ADD COLUMN ia_responde boolean NOT NULL DEFAULT false;
```

### 2. Frontend: `src/pages/Acionamento.tsx`
- Adicionar `ia_responde` ao tipo do estado `instances` e a todas as queries `select()`
- Criar `handleToggleIaResponde` (similar a `handleToggleRobo`): quando ativada, desativa `apenas_lembretes`; mutuamente exclusiva com `apenas_lembretes`
- Adicionar checkbox "IA Responde" abaixo de "Robô" na renderização das instâncias

### 3. Backend: `supabase/functions/whatsapp-chatbot/index.ts`
- Na seção onde verifica `instanceRecord?.apenas_lembretes` (linha ~1075), adicionar `ia_responde` ao `select()`
- Alterar a lógica de filtro:
  - Se `apenas_lembretes` = true → ignora (já existe)
  - Se `ia_responde` = false E não é instância admin → ignora (novo filtro)
  - Se `ia_responde` = true → permite processamento pelo chatbot IA independentemente de ser admin
- Remover a restrição atual de "owner must be admin" quando `ia_responde` está ativo, permitindo que qualquer instância marcada com "IA Responde" receba respostas da IA
- A IA já notifica o admin no 62991672674 quando não sabe responder (função `notificarAdmin` já existe)

### Exclusividade mútua
- `apenas_lembretes` e `ia_responde` são mutuamente exclusivos (ativar um desativa o outro)
- `robo` e `ia_responde` podem coexistir (robô é para envio em massa, IA é para respostas)


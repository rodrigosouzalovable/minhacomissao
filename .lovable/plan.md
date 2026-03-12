

# Plano: Adicionar flag "Robô" nas instâncias WhatsApp

## Resumo
Adicionar uma coluna `robo` na tabela `user_whatsapp_instances` e um checkbox "Robô" na UI de cada instância. Instâncias marcadas como "Apenas Lembretes" ficam excluídas da fila de acionamento. Instâncias com "Robô" marcado participam do envio em massa normalmente.

## Alterações

### 1. Migração: adicionar coluna `robo`
```sql
ALTER TABLE user_whatsapp_instances ADD COLUMN robo boolean NOT NULL DEFAULT false;
```

### 2. `src/pages/Acionamento.tsx`

**Filtrar `activeInstances`** para excluir instâncias `apenas_lembretes` da fila de acionamento:
```typescript
const activeInstances = useMemo(() => 
  instances.filter(i => i.ativo && connectionStatus[i.id] === 'connected' && !i.apenas_lembretes), 
  [instances, connectionStatus]
);
```

**Adicionar handler `handleToggleRobo`** similar ao `handleToggleApenasLembretes`.

**UI: adicionar checkbox "Robô"** ao lado do "Apenas Lembretes" em cada card de instância (linhas ~1455-1467). Ambos visíveis quando a instância está ativa. Quando "Apenas Lembretes" é marcado, desmarcar "Robô" automaticamente (e vice-versa, são mutuamente exclusivos).

### 3. `supabase/functions/whatsapp-chatbot/index.ts`
Nenhuma alteração necessária -- o chatbot já ignora instâncias `apenas_lembretes`. O campo `robo` é apenas para controle da fila de acionamento no frontend.

### Lógica de negócio
- **Apenas Lembretes** marcado: só envia lembretes de vencimento, não entra na fila do robô, chatbot ignorado
- **Robô** marcado: entra na fila de acionamento em massa normalmente
- Nenhum marcado: instância ativa mas não participa do envio automático em massa
- Ambos não podem estar marcados simultaneamente


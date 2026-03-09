

# Plano: Corrigir Round-Robin e Duplicação de Mensagens no Acionamento

## Problemas Identificados

### 1. Filtro de instâncias não considera status de conexão
**Arquivo**: `src/pages/Acionamento.tsx` (linha 308)
```typescript
// ATUAL - inclui instâncias desconectadas na rotação:
const activeInstances = useMemo(() => instances.filter(i => i.ativo), [instances]);

// CORREÇÃO - incluir apenas ativas E conectadas:
const activeInstances = useMemo(() => 
  instances.filter(i => i.ativo && connectionStatus[i.id] === 'connected'), 
  [instances, connectionStatus]
);
```
Isso garante que apenas os 3 números conectados (62982183706, 62981036664, 62982184132) entrem na rotação.

### 2. Telefones duplicados na planilha
Se a planilha tiver o mesmo telefone em múltiplas linhas (débitos diferentes), o robô envia para o mesmo número múltiplas vezes. Preciso adicionar deduplicação por telefone no momento da importação/envio.

### 3. Falta de log de qual instância está enviando
O `send-whatsapp` não registra qual instance_token está usando, dificultando a depuração.

## Alterações

### Arquivo 1: `src/pages/Acionamento.tsx`
- Alterar `activeInstances` para filtrar por `connectionStatus === 'connected'` além de `ativo`
- Adicionar deduplicação de telefones na lista de clientes pendentes (manter apenas a primeira ocorrência de cada telefone)

### Arquivo 2: `src/hooks/useAutoSend.tsx`
- Adicionar `console.log` com o nome/número da instância usada para cada envio
- Deduplicar `pendentesSnapshot` por telefone antes de iniciar o envio

### Arquivo 3: `supabase/functions/send-whatsapp/index.ts`
- Adicionar log do instance_token (últimos 8 chars) para rastreabilidade

## Resultado Esperado
- Cliente 1 → 62982183706
- Cliente 2 → 62981036664  
- Cliente 3 → 62982184132
- Cliente 4 → 62982183706 (volta ao primeiro)
- Sem envio duplicado para o mesmo telefone


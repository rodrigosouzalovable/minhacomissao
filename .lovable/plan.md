

# Fix: Clientes enviados não transferem para aba "ENVIADOS"

## Problema raiz

O `handleSend` captura `sendTimestamps` e `activeHistoricoId` do closure no momento da renderização. Durante o loop automático, essas variáveis ficam desatualizadas (stale closure):

1. **`sendTimestamps` stale**: Cada chamada de `handleSend` no loop usa o mesmo objeto `sendTimestamps` inicial, sobrescrevendo os timestamps anteriores. Apenas o último sobrevive no state.

2. **`activeHistoricoId` stale**: Dentro do `setSendStatus`, o `activeHistoricoId` pode estar desatualizado, impedindo que o status seja salvo no localStorage corretamente.

3. **`saveSendTimestamps` stale**: A função `saveSendTimestamps` também captura `activeHistoricoId` do closure, podendo falhar ao persistir.

## Correções em `src/pages/Acionamento.tsx`

### 1. Adicionar ref para `activeHistoricoId`
- Criar `activeHistoricoIdRef = useRef<string | null>(null)` que é atualizado sempre que `activeHistoricoId` muda
- Usar essa ref dentro de `handleSend` para garantir acesso ao valor atual

### 2. Usar functional updater para `sendTimestamps`
- Trocar `const nextTs = { ...sendTimestamps, [index]: ... }` por `setSendTimestamps(prev => { ... })` com functional updater
- Persistir no localStorage dentro do updater usando a ref do historicoId

### 3. Usar ref para `sendTimestamps` no localStorage
- Dentro do functional updater do `setSendTimestamps`, salvar diretamente no localStorage usando `activeHistoricoIdRef.current`

### 4. Detalhes técnicos
- Novo ref: `const activeHistoricoIdRef = useRef<string | null>(null)`
- `useEffect` sincronizando: `activeHistoricoIdRef.current = activeHistoricoId`
- Em `handleSend`, trocar:
  ```typescript
  // De:
  const nextTs = { ...sendTimestamps, [index]: new Date().toISOString() };
  saveSendTimestamps(nextTs);
  
  // Para:
  setSendTimestamps(prev => {
    const next = { ...prev, [index]: new Date().toISOString() };
    const hId = activeHistoricoIdRef.current;
    if (hId) localStorage.setItem(`${SEND_TIMESTAMPS_KEY}_${hId}`, JSON.stringify(next));
    return next;
  });
  ```
- No `setSendStatus`, trocar `activeHistoricoId` por `activeHistoricoIdRef.current`

Isso garante que cada envio atualiza o state corretamente sem stale closures, fazendo o `pendentes` useMemo recalcular e transferir o cliente para a lista de enviados em tempo real.


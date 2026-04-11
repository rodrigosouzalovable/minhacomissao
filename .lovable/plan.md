

## Corrigir ordem de envio dos lembretes

### Problema
Atualmente a fila de envio é montada na ordem `[...lembretesVencidos, ...lembretesHoje, ...lembretesTresDias]`, ou seja, parcelas vencidas são processadas primeiro. O usuário quer que comece por **Vence Hoje**, depois **Parcelas Vencidas**, e que itens já com tag "Enviado" sejam pulados.

### Alteração: `src/components/PaymentReminders.tsx`

**Linha 95** — Reordenar `allPendingReminders`:
```typescript
// De:
const allPendingReminders = [...lembretesVencidos, ...lembretesHoje, ...lembretesTresDias];

// Para:
const allPendingReminders = [...lembretesHoje, ...lembretesVencidos, ...lembretesTresDias];
```

**Linha 205-209** — O filtro `handleStartEnvios` já pula itens com status diferente de `nao_enviado` (inclui "enviado"), então itens com tag ENVIADO já são ignorados. Nenhuma mudança necessária aqui.

### Resultado
1. O envio começa pelos clientes de **Vence Hoje** (primeiro da lista)
2. Após terminar, passa para **Parcelas Vencidas** (primeiro da lista)
3. Por último, **Vence em 3 dias**
4. Clientes já marcados como ENVIADO são automaticamente pulados


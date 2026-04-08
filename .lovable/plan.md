

# Desmarcar instâncias desconectadas do dialog de Lembretes

## Problema
Quando uma instância WhatsApp desconecta (campo `ativo` vira `false`), ela deixa de aparecer na lista do dialog, mas seu ID permanece salvo no `localStorage` (`lembretes-selected-instances`). Isso causa inconsistência — a instância fica "selecionada" mas invisível.

## Solução
No `useEffect` que carrega as instâncias (linha ~114 de `PaymentReminders.tsx`), após receber a lista de instâncias ativas, filtrar o `selectedInstanceIds` para manter apenas IDs que existem na lista retornada. Atualizar tanto o state quanto o `localStorage`.

## Mudança

**Arquivo:** `src/components/PaymentReminders.tsx`

Na linha ~114-117, após `setInstances(instRes.data)`, adicionar lógica para limpar IDs selecionados que não estão mais na lista de instâncias ativas:

```typescript
if (instRes.data) {
  setInstances(instRes.data);
  const activeIds = new Set(instRes.data.map((i: any) => i.id));
  setSelectedInstanceIds(prev => {
    const filtered = prev.filter(id => activeIds.has(id));
    localStorage.setItem('lembretes-selected-instances', JSON.stringify(filtered));
    if (instRes.data.length === 1) return [instRes.data[0].id];
    return filtered;
  });
}
```

Uma única mudança de ~6 linhas em um arquivo.


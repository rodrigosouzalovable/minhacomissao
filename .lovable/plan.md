

## Plano: Corrigir Filtro de Data na Página "Acordos da Equipe"

### Problema Identificado

O filtro de data não está funcionando devido a um problema de comparação de datas com fusos horários diferentes:

1. **`data_paga` do banco de dados**: Vem como string no formato `"2026-01-30"` (apenas data, sem hora)
2. **Quando convertido com `new Date("2026-01-30")`**: JavaScript interpreta como UTC meia-noite → `2026-01-30T00:00:00Z`
3. **No fuso horário de Brasília (UTC-3)**: Isso se torna `2026-01-29T21:00:00` (dia anterior!)
4. **`startDate` e `endDate` do DateRangePicker**: São criados no fuso horário local do usuário

Resultado: As comparações falham porque as datas estão em fusos horários diferentes.

---

### Solução

Comparar as datas usando apenas a parte da data (YYYY-MM-DD) como string, em vez de objetos Date. Isso evita problemas de fuso horário.

---

### Alterações em `src/pages/EquipeAcordos.tsx`

**Localização:** Linhas 90-109

**Código Atual (com problema):**
```typescript
const pagamentosFiltradosPorPeriodo = pagamentosEquipe.filter(pag => {
  if (!pag.data_paga) return false;
  
  const dataPagamento = new Date(pag.data_paga);
  
  if (startDate) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    if (dataPagamento < start) return false;
  }
  
  if (endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    if (dataPagamento > end) return false;
  }
  
  return true;
});
```

**Código Corrigido:**
```typescript
const pagamentosFiltradosPorPeriodo = pagamentosEquipe.filter(pag => {
  if (!pag.data_paga) return false;
  
  // Usar apenas a parte da data (YYYY-MM-DD) para evitar problemas de fuso horário
  const dataPagamentoStr = pag.data_paga.split('T')[0]; // Garante formato YYYY-MM-DD
  
  if (startDate) {
    // Formatar startDate para YYYY-MM-DD no fuso local
    const startStr = startDate.toISOString().split('T')[0];
    // Ajustar para fuso local
    const startLocal = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
    if (dataPagamentoStr < startLocal) return false;
  }
  
  if (endDate) {
    // Formatar endDate para YYYY-MM-DD no fuso local
    const endLocal = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
    if (dataPagamentoStr > endLocal) return false;
  }
  
  return true;
});
```

---

### Explicação Técnica

| Problema | Solução |
|----------|---------|
| `new Date("2026-01-30")` interpreta como UTC | Comparar strings no formato `YYYY-MM-DD` |
| `startDate.toISOString()` usa UTC | Usar `getFullYear()`, `getMonth()`, `getDate()` (fuso local) |
| Comparação de objetos Date com fusos diferentes | Comparação de strings lexicográficas funciona corretamente para datas `YYYY-MM-DD` |

---

### Benefícios

1. **Elimina problemas de fuso horário** - comparações puramente textuais
2. **Funciona em qualquer região** - não depende do timezone do navegador
3. **Mantém compatibilidade** - não altera a interface do componente

---

### Resumo

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/EquipeAcordos.tsx` | Corrigir lógica de comparação de datas (linhas 90-109) |


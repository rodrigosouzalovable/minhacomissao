
## Plano: Ordenar Cards por Data Mais Recente Primeiro

### Objetivo
Alterar a ordenação dos cards nas abas "Meus Acordos" (Negociados) e "Vencidas" para que apareçam primeiro os acordos com datas de vencimento mais recentes/atuais.

---

### Alterações Necessárias

#### 1. Aba "Vencidas" - Inverter Ordenação

**Localização:** Linhas 444-450

**Situação Atual:**
```typescript
// Ordenados pela data mais antiga primeiro (mais urgente)
const acordosVencidos = filteredAcordos
  .filter(acordo => acordosComParcelasVencidas.has(acordo.id))
  .sort((a, b) => {
    const dataA = dataVencidaPorAcordo.get(a.id) || '';
    const dataB = dataVencidaPorAcordo.get(b.id) || '';
    return dataA.localeCompare(dataB); // A -> Z (mais antiga primeiro)
  });
```

**Nova Implementação:**
```typescript
// Ordenados pela data mais recente primeiro
const acordosVencidos = filteredAcordos
  .filter(acordo => acordosComParcelasVencidas.has(acordo.id))
  .sort((a, b) => {
    const dataA = dataVencidaPorAcordo.get(a.id) || '';
    const dataB = dataVencidaPorAcordo.get(b.id) || '';
    return dataB.localeCompare(dataA); // Z -> A (mais recente primeiro)
  });
```

---

#### 2. Aba "Meus Acordos" (Negociados) - Adicionar Ordenação por Data

**Localização:** Linhas 434-440

**Situação Atual:**
Os acordos negociados são ordenados apenas por status do boleto (aguardando boleto primeiro), sem considerar data de vencimento.

**Nova Implementação:**
Ordenar por:
1. Boleto enviado (não enviados primeiro - laranja)
2. Data do primeiro pagamento (mais recente primeiro)

```typescript
const acordosNegociados = filteredAcordos
  .filter(acordo => !acordosComPagamentosPagos.has(acordo.id) && !acordosComParcelasVencidas.has(acordo.id))
  .sort((a, b) => {
    // Primeiro critério: acordos sem boleto enviado vêm primeiro
    if (!a.boleto_enviado && b.boleto_enviado) return -1;
    if (a.boleto_enviado && !b.boleto_enviado) return 1;
    
    // Segundo critério: ordenar por data_primeiro_pagamento (mais recente primeiro)
    const dataA = a.data_primeiro_pagamento || '';
    const dataB = b.data_primeiro_pagamento || '';
    return dataB.localeCompare(dataA); // Z -> A (mais recente primeiro)
  });
```

---

### Resumo das Alterações

| Aba | Antes | Depois |
|-----|-------|--------|
| Meus Acordos | Apenas por boleto enviado | Boleto enviado + data mais recente primeiro |
| Vencidas | Data mais antiga primeiro | Data mais recente primeiro |

---

### Seção Técnica

**Lógica de ordenação:**
- `dataA.localeCompare(dataB)` = ordem crescente (A → Z, antiga → recente)
- `dataB.localeCompare(dataA)` = ordem decrescente (Z → A, recente → antiga)

**Campo utilizado:**
- Negociados: `acordo.data_primeiro_pagamento` (já disponível no objeto Acordo)
- Vencidas: `dataVencidaPorAcordo.get(acordo.id)` (Map já existente)

**Arquivos alterados:**
- `src/pages/Acordos.tsx` (linhas 434-450)

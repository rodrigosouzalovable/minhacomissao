

## Plano: Corrigir Cálculo de Total Parcelas Pagas

### Problema Identificado

O card "Total Parcelas Pagas" mostra **R$ 0,00** quando nenhuma data está selecionada. A lógica atual usa `pagamentosFiltradosPorPeriodo` para o cálculo, mas quando não há filtro de data, a lista está retornando vazia por um problema de lógica.

O problema está na **ordem de renderização vs. dados carregados**, ou mais especificamente: quando `startDate` e `endDate` são `undefined`, a lista deveria incluir todos os pagamentos pagos, mas algo está causando um resultado vazio.

### Análise Técnica

Após investigação detalhada:

1. **Banco de dados**: Existem 491 pagamentos pagos totalizando R$ 118.194,26
2. **Todos os pagamentos pagos** possuem `data_paga` preenchido (não há nulos)
3. **A lógica de filtro** parece correta, mas pode haver um problema de timing ou inicialização

### Solução Proposta

Modificar a lógica para que:
1. Quando **nenhuma data está selecionada** (`!startDate && !endDate`), usar `pagamentosEquipe` diretamente (todos os pagamentos pagos)
2. Quando há **data selecionada**, aplicar o filtro de período

Isso garantirá que o card sempre mostre um valor correto, seja o total geral ou o filtrado por período.

---

### Alterações em `src/pages/EquipeAcordos.tsx`

**Localização:** Linhas 90-111

**Código Atual:**
```typescript
const pagamentosFiltradosPorPeriodo = pagamentosEquipe.filter(pag => {
  if (!pag.data_paga) return false;
  
  const dataPagamentoStr = pag.data_paga.split('T')[0];
  
  if (startDate) {
    const startLocal = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
    if (dataPagamentoStr < startLocal) return false;
  }
  
  if (endDate) {
    const endLocal = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
    if (dataPagamentoStr > endLocal) return false;
  }
  
  return true;
});
```

**Código Corrigido:**
```typescript
// Filtrar pagamentos por data de pagamento (data_paga)
// Se não há filtro de data, incluir TODOS os pagamentos pagos (não precisa de data_paga)
const pagamentosFiltradosPorPeriodo = (startDate || endDate)
  ? pagamentosEquipe.filter(pag => {
      if (!pag.data_paga) return false;
      
      // Extrair apenas a parte da data (YYYY-MM-DD) para evitar problemas de fuso horário
      const dataPagamentoStr = pag.data_paga.split('T')[0];
      
      if (startDate) {
        // Formatar startDate para YYYY-MM-DD no fuso local
        const startLocal = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
        if (dataPagamentoStr < startLocal) return false;
      }
      
      if (endDate) {
        // Formatar endDate para YYYY-MM-DD no fuso local
        const endLocal = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
        if (dataPagamentoStr > endLocal) return false;
      }
      
      return true;
    })
  : pagamentosEquipe; // Quando não há filtro de data, usar todos os pagamentos
```

---

### Por que essa solução funciona

| Cenário | Antes (problema) | Depois (corrigido) |
|---------|------------------|-------------------|
| Sem filtro de data | Filtra mesmo sem necessidade, pode excluir por edge cases | Usa `pagamentosEquipe` diretamente |
| Com filtro de data | Aplica filtro com comparação de strings | Mesmo comportamento, sem mudanças |

### Benefícios

1. **Comportamento mais previsível** - sem filtro de data = todos os pagamentos
2. **Performance** - evita iteração desnecessária quando não há filtro
3. **Compatibilidade** - mantém o filtro de fuso horário corrigido quando há datas

---

### Resumo

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/EquipeAcordos.tsx` | Modificar lógica para usar todos os pagamentos quando não há filtro de data (linhas 90-111) |


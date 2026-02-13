
## Plano: Habilitar data de hoje no seletor de data de pagamento

### Problema
Na página de negociação de débitos (`ConsultaResultado.tsx`), o calendário para selecionar a data do primeiro pagamento está desabilitando a data de hoje.

**Causa**: A linha 309 usa `disabled={(date) => date < new Date()}` que compara data COM hora. Isso significa que se for 14/02/2026 às 10:30 AM, a mesma data 14/02/2026 antes das 10:30 AM estará desabilitada.

### Solução
Modificar a função `disabled` no componente `Calendar` para comparar apenas a data (sem considerar a hora), permitindo que o cliente selecione a data de hoje e qualquer data posterior.

### Alteração Específica
**Arquivo**: `src/pages/ConsultaResultado.tsx`  
**Linha**: 309

**De:**
```typescript
disabled={(date) => date < new Date()}
```

**Para:**
```typescript
disabled={(date) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
}}
```

### Resultado Esperado
- Cliente conseguirá selecionar a data de hoje como primeira data de pagamento
- Datas no futuro continuarão selecionáveis
- Datas no passado (anteriores a hoje) permanecerão desabilitadas

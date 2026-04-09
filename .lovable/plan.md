

## Problema

A tabela `lembretes_lidos` armazena permanentemente os IDs dos lembretes marcados como "visto". Uma vez marcado, o lembrete nunca mais aparece — mesmo que a parcela continue pendente dias depois.

## Solução

Adicionar uma coluna `criado_em_date` (ou usar a existente `criado_em`) para filtrar apenas lembretes marcados como lidos **no dia atual**. No dia seguinte, se a parcela ainda estiver pendente, o lembrete reaparece automaticamente.

### Mudanças

**1. Hook `usePaymentReminders.tsx`** — Filtrar lembretes lidos apenas do dia atual

Na query de `lembretes-lidos`, adicionar filtro `.gte('criado_em', hojeInicio)` para buscar apenas registros criados hoje. Assim, marcações de dias anteriores são ignoradas e o lembrete reaparece.

```typescript
// Antes: busca TODOS os lembretes lidos (permanente)
const { data } = await supabase
  .from('lembretes_lidos')
  .select('pagamento_id')
  .eq('user_id', user.id);

// Depois: busca apenas os lidos HOJE
const hojeInicio = format(new Date(), 'yyyy-MM-dd') + 'T00:00:00';
const { data } = await supabase
  .from('lembretes_lidos')
  .select('pagamento_id')
  .eq('user_id', user.id)
  .gte('criado_em', hojeInicio);
```

**2. Limpar registros antigos** — Migration SQL

Deletar todos os registros de `lembretes_lidos` com `criado_em` anterior a hoje, fazendo com que todos os clientes com parcelas pendentes reapareçam imediatamente nos lembretes.

```sql
DELETE FROM lembretes_lidos WHERE criado_em < CURRENT_DATE;
```

### Resultado

- "Marcar como visto" esconde o lembrete **apenas pelo resto do dia**
- No dia seguinte, se a parcela ainda estiver pendente, o cliente reaparece
- Os 133 registros antigos serão limpos, fazendo todos os pendentes reaparecerem agora


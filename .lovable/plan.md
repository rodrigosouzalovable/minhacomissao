

# Correção: Clientes não movem para aba "ENVIADOS" durante envio automático

## Problema identificado

Ao analisar o código, encontrei a causa raiz:

O filtro da aba "ENVIADOS" só inclui clientes com `sendStatus === 'success'` (linha 552). Quando o envio falha (status = `'error'`), o cliente permanece na aba "A ENVIAR". Como os envios via UAZAPI ainda estão retornando erros (405), os clientes nunca saem da aba "A ENVIAR".

Além disso, mesmo quando o envio é bem-sucedido, se o status é `'error'` de uma tentativa anterior, o cliente fica "preso" na aba pendentes.

**Filtro atual:**
```typescript
// pendentes: exclui apenas 'success'
pendentes = clientes.filter(c => sendStatus[c.originalIndex] !== 'success' && !manualChecked.has(c.originalIndex));

// enviados: inclui apenas 'success'
enviados = clientes.filter(c => sendStatus[c.originalIndex] === 'success' || manualChecked.has(c.originalIndex));
```

## Solução

Alterar os filtros para que **qualquer cliente que teve uma tentativa de envio** (status `'success'` ou `'error'`) seja movido para a aba "ENVIADOS". Apenas clientes com status `'idle'` ou `'sending'` ficam em "A ENVIAR".

**Filtro corrigido:**
```typescript
// pendentes: exclui 'success' E 'error' (já foi tentado)
pendentes = clientes.filter(c => sendStatus[c.originalIndex] !== 'success' && sendStatus[c.originalIndex] !== 'error' && !manualChecked.has(c.originalIndex));

// enviados: inclui 'success' E 'error' (qualquer tentativa feita)
enviados = clientes.filter(c => sendStatus[c.originalIndex] === 'success' || sendStatus[c.originalIndex] === 'error' || manualChecked.has(c.originalIndex));
```

Na aba "ENVIADOS", clientes com erro serão exibidos com um indicador visual diferente (ícone vermelho X) para distingui-los dos enviados com sucesso (ícone verde).

### Resumo
- **1 arquivo**: `src/pages/Acionamento.tsx` — corrigir filtros `pendentes` e `enviados` para mover clientes após qualquer tentativa de envio


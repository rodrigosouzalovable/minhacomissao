

# Plano: Restringir envio em massa apenas a instâncias marcadas como "Robô"

## Problema
A variável `activeInstances` (linha 387 de `Acionamento.tsx`) filtra apenas por `ativo`, `connected` e `!apenas_lembretes`. Isso significa que qualquer instância ativa e conectada (mesmo sem a flag "Robô") é incluída no round-robin de envio em massa da planilha importada.

## Correção

### Arquivo: `src/pages/Acionamento.tsx`

**Linha 387** — Adicionar filtro `&& i.robo` na definição de `activeInstances`:

```typescript
const activeInstances = useMemo(() => 
  instances.filter(i => i.ativo && connectionStatus[i.id] === 'connected' && !i.apenas_lembretes && i.robo), 
  [instances, connectionStatus]
);
```

Isso garante que apenas instâncias marcadas como "Robô" participam do envio em massa de acionamentos. Instâncias sem nenhuma flag ou com "Apenas Lembretes" ficam excluídas.

### Impacto
- Envio em massa (planilha importada): usa apenas instâncias com flag "Robô"
- Lembretes de pagamento: usa apenas instâncias com flag "Apenas Lembretes" (já funciona assim)
- Instâncias sem flag: não enviam nada automaticamente


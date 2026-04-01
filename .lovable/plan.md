

## Exibir nome da instância em todas as conversas

### Problema
O nome da instância (ex: "62981033444 MEMU 99") só aparece quando há mais de uma instância (`instancias.length > 1`). O usuário quer que apareça sempre.

### Alteração

**Arquivo**: `src/pages/WhatsAppInbox.tsx` (linha ~292)

Remover a condição `instancias.length > 1` para que o nome da instância seja exibido em todos os cards de conversa, independente da quantidade de instâncias conectadas.

De:
```tsx
{instancias.length > 1 && getInstanciaNome(contato.instancia_id) && (
```

Para:
```tsx
{getInstanciaNome(contato.instancia_id) && (
```

Mesma alteração no header do chat (linha ~333) se existir condição similar.


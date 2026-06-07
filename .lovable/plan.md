## Resumo
Ajustar o intervalo aleatório entre envios de mensagens de lembrete de boleto na edge function `notificar-boletos-pendentes`, de **2–6 segundos** para **30–90 segundos**.

## Alteração técnica
Arquivo: `supabase/functions/notificar-boletos-pendentes/index.ts`

Linha 181:
```typescript
// Antes
await sleep(rnd(2000, 6000));

// Depois
await sleep(rnd(30000, 90000));
```

Nenhuma outra parte do código utiliza esse padrão de delay; a mudança é isolada a essa única linha.
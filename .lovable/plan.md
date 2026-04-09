

## Problema Identificado

O cliente com vencimento em 06/04/2026, hoje sendo 09/04/2026, está **3 dias** em atraso. O sistema calcula `vencido_d3` como chave de template, mas **não existe template configurado para D+3**. Seus templates configurados com botões são: D+1, D+2, D+10, D+11, D+20, D+30.

O fallback atual pula direto para `vencido_generico`, que **não tem botões configurados** — daí o erro "Nenhum botão configurado".

## Correção

Modificar a lógica de busca de template em `PaymentReminders.tsx` (e também em `WhatsAppSendingContext.tsx` para envios em lote) para implementar um **fallback em cascata**:

1. Buscar template exato (`vencido_d3`)
2. Se não encontrar, buscar o **template configurado mais próximo com dias menores** (ex: `vencido_d2`)
3. Se não encontrar nenhum, usar `vencido_generico`

### Mudança no código (linha ~436 de PaymentReminders.tsx)

**Antes:**
```typescript
const tpl = templates.find(t => t.tipo_lembrete === tipoKey)
  || (tipoKey.startsWith('vencido_d') 
    ? templates.find(t => t.tipo_lembrete === 'vencido_generico') 
    : undefined);
```

**Depois:**
```typescript
const tpl = templates.find(t => t.tipo_lembrete === tipoKey)
  || (() => {
    if (!tipoKey.startsWith('vencido_d')) return undefined;
    const dias = parseInt(tipoKey.replace('vencido_d', ''));
    // Buscar o template vencido mais próximo (dias menores)
    const vencidoTemplates = templates
      .filter(t => t.tipo_lembrete.startsWith('vencido_d') && t.tipo_lembrete !== 'vencido_generico')
      .map(t => ({ ...t, dias: parseInt(t.tipo_lembrete.replace('vencido_d', '')) }))
      .filter(t => t.dias <= dias)
      .sort((a, b) => b.dias - a.dias);
    return vencidoTemplates[0] || templates.find(t => t.tipo_lembrete === 'vencido_generico');
  })();
```

Esta mesma lógica será aplicada em **3 locais**:
1. **PaymentReminders.tsx** — menu individual de "Áudio + Botões" (~linha 436)
2. **PaymentReminders.tsx** — menu individual de "Enviar áudio" (se usar a mesma busca)
3. **WhatsAppSendingContext.tsx** — envio em lote

### Arquivos a modificar
- `src/components/PaymentReminders.tsx`
- `src/contexts/WhatsAppSendingContext.tsx`


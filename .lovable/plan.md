

# Interpretar "Sim consigo, quero em 6x" como confirmação final

## Problema
Na etapa `aguardando_pagamento_hoje`, a mensagem "Sim consigo, quero em 6x" contém "6x", então o regex de parcelas (linha 1019) captura primeiro e recalcula o valor, perguntando novamente "Você consegue fazer o pagamento hoje?" — quando deveria finalizar o acordo em 6x.

## Solução
No bloco `matchParcelasHoje` (linhas 1020-1042), antes de recalcular e perguntar novamente, verificar se a mensagem **também contém confirmação** (ex: "sim", "consigo", "quero", "pode ser", "ok"). Se sim, tratar como acordo finalizado com aquele número de parcelas.

### Lógica
```typescript
if (matchParcelasHoje) {
  const parcelasPedidas = parseInt(matchParcelasHoje[1]);
  const vpCalc = dados.valor_parcelado || dados.valor_final || 0;
  
  // Verificar se a mensagem também contém confirmação
  const tambemConfirmou = /(sim|consigo|quero|pode ser|ok|fechado|fecha|vamos|bora)/i.test(textoLower);
  
  if (parcelasPedidas === 1) {
    // ... calcula valor à vista ...
    if (tambemConfirmou) {
      // Finalizar acordo
      resposta = `Ok! Iremos te enviar o boleto à vista...`;
      await salvarEResponder('acordo_finalizado', ...);
      await notificarAcordoFechado(...);
    } else {
      // Só recalcular
      resposta = `À vista fica *${formatCurrency(vaCalc)}*. Você consegue fazer o pagamento hoje?`;
      await salvarEResponder('aguardando_pagamento_hoje');
    }
  } else if (parcelasPedidas >= 2 && ...) {
    if (tambemConfirmou) {
      resposta = `Ok! Iremos te enviar o boleto em ${parcelasPedidas}x de *${formatCurrency(valorParcCalc)}*.`;
      await salvarEResponder('acordo_finalizado', ...);
      await notificarAcordoFechado(...);
    } else {
      resposta = `Em ${parcelasPedidas}x fica *${formatCurrency(valorParcCalc)}*. Você consegue fazer o pagamento hoje?`;
      await salvarEResponder('aguardando_pagamento_hoje');
    }
  }
}
```

## Arquivo alterado
- `supabase/functions/whatsapp-chatbot/index.ts` — bloco `matchParcelasHoje` dentro de `aguardando_pagamento_hoje` (linhas 1020-1042)


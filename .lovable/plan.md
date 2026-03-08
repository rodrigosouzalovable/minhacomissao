

# Detectar pedidos de parcelas na etapa `aguardando_pagamento_hoje`

## Problema
Após perguntar "Como fica em 12x?" (respondido corretamente), o bot avança para `aguardando_pagamento_hoje`. Quando o cliente pergunta "Como fica em 6x?", essa etapa não tem detecção de parcelas — a IA classifica como "sim" e responde "Ok! Iremos te enviar o boleto para pagamento hoje."

## Solução
Adicionar a mesma lógica de detecção de parcelas via regex **antes** da classificação de intenção na etapa `aguardando_pagamento_hoje` (linhas 1017-1057).

Se o cliente pedir parcelas específicas (ex: "6x", "em 6", "6 vezes"), calcular o valor e responder com o valor exato, permanecendo na mesma etapa `aguardando_pagamento_hoje`.

### Lógica a inserir (antes da linha 1018)
```typescript
// Detectar pedido de parcelas antes de classificar sim/não
const matchParcelasHoje = texto.match(/(\d+)\s*(?:x|vezes|parcelas?)/i) || texto.match(/em\s+(\d+)\b/i);
if (matchParcelasHoje) {
  const parcelasPedidas = parseInt(matchParcelasHoje[1]);
  // Recalcular com valor_parcelado dos dados
  const vpCalc = dados.valor_parcelado || dados.valor_final || 0;
  
  if (parcelasPedidas === 1) {
    const vaCalc = dados.valor_avista || vpCalc * 0.5 / 0.7;
    resposta = `À vista fica *${formatCurrency(vaCalc)}*. Você consegue fazer o pagamento hoje?`;
    dados = { ...dados, tipo_pagamento: 'avista', parcelas: 1, valor_final: vaCalc };
    await salvarEResponder('aguardando_pagamento_hoje');
    break;
  } else if (parcelasPedidas >= 2 && parcelasPedidas <= 24 && vpCalc / parcelasPedidas >= 100) {
    const valorParcCalc = vpCalc / parcelasPedidas;
    resposta = `Em ${parcelasPedidas}x fica *${formatCurrency(valorParcCalc)}* cada parcela. Você consegue fazer o pagamento hoje?`;
    dados = { ...dados, tipo_pagamento: 'parcelado', parcelas: parcelasPedidas, valor_final: vpCalc };
    await salvarEResponder('aguardando_pagamento_hoje');
    break;
  } else {
    const maxP = Math.floor(vpCalc / 100);
    resposta = `O parcelamento pode ser de 2x a ${Math.min(maxP, 24)}x (parcela mínima de R$ 100). Como prefere?`;
    await salvarEResponder('aguardando_pagamento_hoje');
    break;
  }
}
```

## Arquivo alterado
- `supabase/functions/whatsapp-chatbot/index.ts` — etapa `aguardando_pagamento_hoje`


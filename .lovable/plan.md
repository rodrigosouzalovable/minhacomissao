

# Fazer a IA calcular parcelas quando o cliente perguntar

## Problema
Na etapa `oferta_valores`, quando o cliente pergunta "Como fica em 12x?", a IA classifica como "parcelado" e pula direto para "Você consegue fazer o pagamento hoje?" sem responder o valor solicitado. O `valor_parcelado` (30% de desconto) já está salvo nos `dados`, mas a IA não extrai o número de parcelas da mensagem e não calcula.

## Solução

Alterar a etapa `oferta_valores` (linhas ~835-884) para:

1. **Extrair número de parcelas da mensagem** — antes de classificar a intenção, usar regex para detectar padrões como "12x", "em 12", "12 vezes", "12 parcelas"
2. **Se detectou parcelas específicas** — calcular `valor_parcelado / parcelas_pedidas`, validar se está acima de R$100 e dentro de 2-24x, e responder com o valor exato antes de perguntar sobre pagamento
3. **Se não detectou parcelas** — manter o fluxo atual (classificar avista/parcelado via IA)

### Lógica detalhada

```
// No início de oferta_valores:
const matchParcelas = texto.match(/(\d+)\s*(?:x|vezes|parcelas?)/i) || texto.match(/em\s*(\d+)/i);

if (matchParcelas) {
  const parcelasPedidas = parseInt(matchParcelas[1]);
  const valorParcela = vpOfertas / parcelasPedidas;
  
  if (parcelasPedidas === 1) {
    // Quer à vista
    resposta = `À vista fica ${formatCurrency(vaOfertas)}. Você consegue fazer o pagamento hoje?`;
    dados = { ...dados, tipo_pagamento: 'avista', parcelas: 1, valor_final: vaOfertas };
    salvarEResponder('aguardando_pagamento_hoje');
  } else if (parcelasPedidas >= 2 && parcelasPedidas <= 24 && valorParcela >= 100) {
    resposta = `Em ${parcelasPedidas}x fica ${formatCurrency(valorParcela)} cada parcela. Você consegue fazer o pagamento hoje?`;
    dados = { ...dados, tipo_pagamento: 'parcelado', parcelas: parcelasPedidas, valor_final: vpOfertas };
    salvarEResponder('aguardando_pagamento_hoje');
  } else {
    // Fora do permitido — informar limites
    resposta = `O parcelamento pode ser de 2x a ${maxParcelas}x (parcela mínima de R$ 100). Como prefere?`;
    salvarEResponder('oferta_valores');
  }
} else {
  // Fluxo atual: classificar via IA (avista/parcelado/nenhuma)
}
```

### Também na etapa `proposta_enviada` (linhas ~785-832)
Aplicar a mesma lógica de detecção de parcelas, pois o cliente pode já responder "sim, como fica em 12x?" diretamente na proposta inicial.

## Arquivo alterado
- `supabase/functions/whatsapp-chatbot/index.ts`


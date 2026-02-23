
# Alterar desconto do parcelamento para 30% (2x a 24x)

## Resumo
Unificar as faixas de parcelamento em uma unica opcao: **2x a 24x com 30% de desconto**, mantendo o valor minimo de R$ 90,00 por parcela e o desconto de 50% para pagamento a vista.

## O que muda

**Antes:** 3 faixas de parcelamento separadas
- 2-6x com 40% de desconto
- 7-12x com 30% de desconto
- 13-24x sem desconto

**Depois:** 1 unica faixa de parcelamento
- 2-24x com 30% de desconto

## Alteracoes tecnicas

### 1. `src/components/negociacao/DiscountTierSelector.tsx`
- Remover as faixas `curto`, `medio` e `sem` do array `tiers`
- Criar uma unica faixa `parcelado` com label "2 a 24x", desconto 30%, parcelas "2-24x"
- Atualizar o tipo `DescontoFaixa` para `'avista' | 'parcelado'`
- Simplificar o layout: em vez de 3 cards em grid, exibir apenas 1 card de parcelamento
- Atualizar as funcoes `getDesconto`, `getMinParcelas` e `getMaxParcelasFaixa` para a nova faixa unica
- Manter o valor minimo de parcela em R$ 90,00

### 2. `src/pages/ConsultaResultado.tsx`
- Atualizar referencias ao tipo `DescontoFaixa` (substituir `'curto'`, `'medio'`, `'sem'` por `'parcelado'`)
- Ajustar condicoes que verificam `descontoFaixa === 'sem'` (agora todas as faixas parceladas tem desconto)
- Verificar mensagem do WhatsApp para refletir a nova estrutura

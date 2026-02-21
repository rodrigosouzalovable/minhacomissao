

## Limitar parcelas para valor minimo de R$ 90,00

### O que muda

O sistema passara a calcular o numero maximo de parcelas considerando que nenhuma parcela pode ser menor que R$ 90,00. Isso sera aplicado dinamicamente: se o valor com desconto (menos a entrada) dividido pelo numero de parcelas resultar em menos de R$ 90, essas opcoes nao aparecerao no seletor.

### Detalhes tecnicos

**Arquivo:** `src/pages/ConsultaResultado.tsx`

1. **Adicionar constante** `VALOR_MINIMO_PARCELA = 90` no topo do arquivo

2. **Ajustar `getMaxParcelas`** para considerar o valor minimo:
   - Calcular o maximo pela faixa de desconto (regra atual)
   - Calcular o maximo pelo valor minimo: `Math.floor(restante / 90)`
   - Retornar o menor dos dois, garantindo no minimo 1

3. **Ajustar validacao `isNegociacaoValida`** para rejeitar parcelas abaixo de R$ 90:
   - Trocar a checagem atual de `valorParcela < 1` por `valorParcela < 90`

4. **No seletor de parcelas (Select)**, o range ja sera limitado pelo `getMaxParcelas` ajustado, entao as opcoes indisponiveis simplesmente nao aparecerao

**Arquivo:** `src/components/negociacao/DiscountTierSelector.tsx`

5. **Ocultar faixas de desconto impossiveis**: se o valor com desconto da faixa for menor que R$ 90 (ou seja, nem 1 parcela atinge o minimo), desabilitar visualmente o card dessa faixa -- embora na pratica isso so ocorra com debitos muito pequenos


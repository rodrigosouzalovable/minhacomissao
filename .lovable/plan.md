

## Melhorias no portal de negociacao

### 1. Desabilitar faixas de desconto com parcela minima abaixo de R$ 90

No componente `DiscountTierSelector`, atualizar a logica de `disabled` para considerar o valor da parcela minima da faixa (valor com desconto dividido pelo numero maximo de parcelas da faixa). Se esse valor for menor que R$ 90, o card sera desabilitado visualmente (opacidade reduzida, cursor bloqueado).

**Arquivo:** `src/components/negociacao/DiscountTierSelector.tsx`
- Importar `getMaxParcelasFaixa` internamente
- Mudar logica: `disabled = (valorComDesconto / getMaxParcelasFaixa(tier.faixa)) < VALOR_MINIMO_PARCELA && tier.faixa !== 'avista'`
- Para "a vista": desabilitar apenas se `valorComDesconto < VALOR_MINIMO_PARCELA`

### 2. Botao "TENHO UMA CONTRA PROPOSTA"

Adicionar um botao visivel no formulario de negociacao que linka direto para o WhatsApp com uma mensagem padrao de contra proposta.

**Arquivo:** `src/pages/ConsultaResultado.tsx`
- Adicionar botao abaixo do formulario de negociacao (antes ou apos o botao "Confirmar proposta")
- Texto: "TENHO UMA CONTRA PROPOSTA"
- Link para WhatsApp com mensagem: "Ola! Meu nome e [nome], CPF [cpf], e gostaria de fazer uma contra proposta para os contratos [contratos]."
- Estilo diferenciado (outline ou cor diferente para nao competir com o botao principal)

### 3. Alterar numero do WhatsApp

**Arquivo:** `src/pages/ConsultaResultado.tsx`
- Alterar `PHONE` de `'5562981749600'` para `'5562982183144'`
- Alterar `PHONE_DISPLAY` de `'(62) 98174-9600'` para `'(62) 98218-3144'`

### Detalhes tecnicos

**DiscountTierSelector.tsx** - Nova logica de disabled:
```typescript
const maxParcelas = getMaxParcelasFaixa(tier.faixa);
const valorParcela = valorComDesconto / maxParcelas;
const disabled = valorParcela < VALOR_MINIMO_PARCELA;
```

**ConsultaResultado.tsx** - Botao contra proposta (apos o botao "Confirmar proposta"):
```typescript
<a href={`https://wa.me/5562982183144?text=${encodeURIComponent(
  `Olá! Meu nome é ${nomeCliente}, CPF ${cpfCliente}, e gostaria de fazer uma contra proposta para os contratos ${contratosStr}.`
)}`} target="_blank">
  <Button variant="outline" className="w-full">
    TENHO UMA CONTRA PROPOSTA
  </Button>
</a>
```

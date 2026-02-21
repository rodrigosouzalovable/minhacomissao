

## Estrategia de desconto inteligente para o portal de negociacao

### Conceito da estrategia

A ideia e apresentar o desconto como uma **oferta especial limitada**, usando gatilhos de persuasao:

1. **Ancoragem visual**: Mostrar o valor original riscado ao lado do valor com desconto, para o cliente perceber a economia
2. **Escala de desconto regressiva**: Quanto menos parcelas, maior o desconto -- incentivando o pagamento a vista ou em poucas parcelas
3. **Destaque da economia**: Exibir em destaque "Voce economiza R$ X,XX" para tornar o beneficio tangivel

### Regras de desconto

| Condicao | Desconto |
|----------|----------|
| A vista (1 parcela, sem entrada) | 50% |
| 2 a 6 parcelas | 40% |
| 7 a 12 parcelas | 30% |
| 13 a 24 parcelas | Sem desconto |

Essa escala progressiva incentiva o cliente a fechar em menos parcelas para ganhar mais desconto.

### Como funciona na interface

**Etapa 1 - Antes de negociar:**
- O card de valor total continua igual, com botao "Negociar todos os debitos"

**Etapa 2 - Formulario de proposta (apos clicar):**
- Novo campo: seletor de tipo de pagamento com cards visuais atrativos mostrando cada faixa de desconto
- Ao selecionar a faixa, o formulario atualiza automaticamente:
  - Mostra o valor original riscado
  - Mostra o valor com desconto em destaque (verde)
  - Mostra "Voce economiza R$ X,XX" em destaque
  - O seletor de parcelas se ajusta ao range permitido pela faixa
- O resumo da negociacao inclui o desconto aplicado

**Etapa 3 - Mensagem WhatsApp:**
- Inclui o percentual de desconto e o valor com desconto na mensagem

### Detalhes tecnicos

**Arquivo:** `src/pages/ConsultaResultado.tsx`

1. **Atualizar `NegociacaoState`** para incluir `descontoFaixa` (tipo: `'avista' | 'curto' | 'medio' | 'sem'`)

2. **Adicionar funcao `getDesconto(faixa)`** que retorna o percentual (50, 40, 30 ou 0)

3. **Adicionar cards de selecao de faixa** no inicio do formulario, antes dos campos de entrada/parcelas, usando cards estilizados com:
   - Icone de porcentagem ou tag
   - "A vista - 50% OFF" (destaque, badge "Melhor oferta")
   - "2 a 6x - 40% OFF"
   - "7 a 12x - 30% OFF"
   - "13 a 24x - Sem desconto"

4. **Ajustar `getValorParcela`** para aplicar o desconto sobre o `valorTotal` antes de calcular

5. **Ajustar `getMaxParcelas`** e adicionar `getMinParcelas` para limitar o range conforme a faixa

6. **No resumo**, mostrar:
   - ~~R$ 262,32~~ (riscado)
   - **R$ 131,16** (com desconto, em verde)
   - "Economia de R$ 131,16 (50%)"

7. **Na mensagem WhatsApp**, incluir o desconto: "...com desconto de 50%, totalizando R$ 131,16..."


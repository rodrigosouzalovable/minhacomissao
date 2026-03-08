

# Reestruturar tabela "A ENVIAR" com colunas de valores calculados

## Problema
O chatbot continua pedindo CPF porque a pre-hydration não está funcionando de forma confiável. A abordagem de tentar sincronizar dados entre frontend e chatbot via `chatbot_conversas` é frágil.

## Nova abordagem
Simplificar: mostrar os valores calculados diretamente na tabela do Acionamento para que o operador veja os descontos, e garantir que a pre-hydration salve os valores numéricos corretos no momento do envio.

## Mudanças no `src/pages/Acionamento.tsx`

### 1. Novas colunas na tabela "A ENVIAR"
Substituir a coluna **Atraso** pelas colunas:
- **Saldo** — valor original (coluna E da planilha)
- **À Vista** — saldo × 0.5 (50% de desconto)
- **Parcelado** — saldo × 0.7, mostrando todas as opções de parcelas onde cada parcela >= R$ 100,00 (ex: "2x R$ 875,00 ... 17x R$ 102,94")

A tabela ficará: `Nome | Telefone | Saldo | À Vista | Parcelado | Ações`

### 2. Função auxiliar para gerar texto de parcelamento
Criar uma função `calcParceladoDisplay(saldo)` que retorna um texto compacto com a faixa de parcelas disponíveis (ex: "2x de R$ 875,00 até 17x de R$ 102,94") para exibir na célula da tabela.

### 3. Mesma mudança na aba "ENVIADOS"
Aplicar as mesmas colunas na tabela de enviados.

### 4. Corrigir pre-hydration no `src/hooks/useAutoSend.tsx`
Garantir que os valores numéricos (`valor_avista`, `valor_parcelado`, `valor_total`, `max_parcelas`) sejam salvos corretamente como números no `chatbot_conversas` — verificar se o `saldo` do `ClienteData` está chegando como número válido.

### 5. Corrigir threshold de parcela mínima
Alterar de R$ 120 para R$ 100 no `calcParcelado` (linha 80 do Acionamento) e no `useAutoSend.tsx`.

## Arquivos alterados
- `src/pages/Acionamento.tsx` — nova estrutura de colunas e funções de cálculo
- `src/hooks/useAutoSend.tsx` — ajuste do threshold para R$ 100


# Corrigir o valor à vista na calculadora UME

## Resultado esperado

Na aba **Sem Juros + 10%** da calculadora dentro da conversa:

- **À vista** será exatamente o **Total sem juros** retornado pela UME.
- Somente as opções parceladas de **2x, 4x, 8x, 10x, 12x e 18x** usarão a base **Total sem juros + 10%**.
- A parcela mínima de R$ 100 continuará sendo respeitada.
- O selo **Total com +10%** continuará mostrando a base usada exclusivamente no parcelamento.
- **Copiar proposta** e **Enviar na conversa** usarão a mesma regra: débito/à vista pelo total sem juros e parcelas sobre o total acrescido de 10%.
- As abas **Tabela Padrão** e **Desconto Especial** não serão alteradas.

## Detalhes técnicos

- Em `src/components/inbox/meta/ConsultaUmeDialog.tsx`, separar o item de 1x dos demais: 1x recebe `valorSemJuros`; 2x ou mais recebem `(valorSemJuros × 1,10) ÷ quantidade`.
- Ajustar o texto gerado para não apresentar o total com 10% como valor do débito à vista.
- Validar com o exemplo exibido: total sem juros de **R$ 3.973,00**, à vista de **R$ 3.973,00**, e parcelamento calculado sobre **R$ 4.370,30**.
- Esta alteração fica restrita à calculadora manual da conversa; não altera automaticamente a negociação do IAGO.

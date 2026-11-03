# Nova comissão dos funcionários e tabela só para admin

## O que muda
1. **Nova tabela de comissão do funcionário**, para pagamentos a partir de 01/11/2026:
   - 1 a 90 dias de atraso: 2%
   - 91 a 360 dias: 4%
   - 361 dias ou mais: 7%
   Os pagamentos de outubro continuam com a tabela atual. Os pagamentos anteriores a outubro continuam com a tabela histórica.
2. **Lançamento de novo acordo:** os funcionários continuam vendo quanto vão receber de comissão, mas deixam de ver a tabela de comissionamento. Para o seu login de admin, a tela continua exatamente como está hoje.

## Detalhes técnicos
- `src/lib/comissao.ts`: manter a tabela atual (vigente desde 01/10) como faixa intermediária. Adicionar `tabelaComissoesFuncionarioNov2026` e a data `2026-11-01`. `calcularPercentualComissaoFuncionario` vai escolher a tabela pela data do pagamento.
- `NovoAcordo.tsx`, `NovoAcordoAdmin.tsx` e `EditarAcordo.tsx`: o bloco da tabela de comissão só aparece quando `isAdmin`. O cálculo da comissão continua visível.
- Conferir se alguma função do banco recalcula a comissão do funcionário por faixa e aplicar a mesma regra lá, se existir.
- Adicionar testes para os limites 90/91, 360/361 e para pagamentos de outubro e novembro.

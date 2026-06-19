## Problema

Na tela `/admin/usuarios/:userId/comissoes` (`src/pages/UsuarioComissoes.tsx`) o card "Comissão Parcelas Pagas" exibe `comissao_parcela` do banco — que é a **comissão do escritório**, não a comissão devida ao funcionário. Por isso aparece R$ 4.251,44 no admin e R$ 931,92 no login da Fernanda (a página da funcionária `Comissoes.tsx` recalcula pelo tier via `calcularComissaoFuncionarioParcela`).

Resultado: o admin não consegue saber, na mesma tela, quanto pagar à funcionária.

## Solução

Em `src/pages/UsuarioComissoes.tsx` passar a exibir **3 cards** no mesmo período filtrado por `data_paga`:

1. **Total Parcelas Pagas** — soma de `valor_parcela` (já existe).
2. **Comissão Funcionário (a pagar)** — soma de `calcularComissaoFuncionarioParcela(p, acordo)` sobre as parcelas pagas no período. Esse será o valor a pagar à pessoa (no exemplo: R$ 931,92).
3. **Comissão Escritório** — soma de `comissao_parcela` do banco (valor atual de R$ 4.251,44), com rótulo claro de que é o que entra para a empresa.

Layout: `grid-cols-1 md:grid-cols-3`, mesmas cores/ícones já usados, valores em verde.

Também ajustar a tabela detalhada de parcelas para exibir as duas colunas (Comissão Funcionário e Comissão Escritório) lado a lado, igual já é feito no export — hoje a coluna mostrada na UI é só a do escritório.

## Arquivos

- `src/pages/UsuarioComissoes.tsx` — adicionar import de `calcularComissaoFuncionarioParcela`, novo cálculo `comissaoFuncionarioNoPeriodo`, terceiro card e nova coluna na tabela.

Sem mudanças de backend, schema ou queries.

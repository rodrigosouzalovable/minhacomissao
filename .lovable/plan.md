## Objetivo

Atualizar a tabela de comissão do FUNCIONÁRIO conforme nova faixa informada. Visível nas páginas Comissões e no lançamento de acordo.

## Nova tabela (funcionário)

| Atraso (dias) | % |
|---|---|
| 1–60 | 2% |
| 61–90 | 3% |
| 91–180 | 4% |
| 181–360 | 6% |
| 361–720 | 8% |
| 721+ | 10% |

## Mudanças em `src/lib/comissao.ts`

Substituir `tabelaComissoesFuncionario` pelas novas faixas acima. `calcularPercentualComissaoFuncionario` e `calcularComissaoFuncionarioParcela` continuam funcionando sem alteração (consomem a tabela).

## Verificação

- Página **Comissões** (`src/pages/Comissoes.tsx` / `UsuarioComissoes.tsx`): refletirá automaticamente as novas faixas.
- Tela de **Novo Acordo** (`NovoAcordo.tsx`): preview da comissão do funcionário também será atualizado.
- Comissão da empresa (Honorário) e tabelas Montreal/Aporte permanecem inalteradas.

## Fora de escopo

- Comissão da empresa (Honorário).
- Demais tabelas (Montreal, juros Aporte).

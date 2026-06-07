## Objetivo

Usar a tabela de Honorário/Comissão da imagem para TODA empresa (UME Aporte e UME Inadimplente), substituindo o atual 35% fixo do Inadimplente. Comissão do funcionário (2-7%) permanece inalterada.

## Tabela a aplicar (Honorário por faixa de atraso)

| Atraso (dias) | % |
|---|---|
| 1–30 | 7% |
| 31–60 | 8% |
| 61–90 | 15% |
| 91–180 | 20% |
| 181–360 | 27% |
| 361–720 | 36% |
| 721–1800 | 50% |
| 1801+ | 50% |

(Já equivale à `tabelaComissoesMundoDaModa` / `tabelaComissoesEmpresa` existentes.)

## Mudanças em `src/lib/comissao.ts`

1. `tabelaComissoes` (UME Inadimplente): trocar a faixa única `{0–999999, 35%}` pela mesma tabela faixada acima.
2. `calcularComissaoParcelaPorEmpresa`: passar a usar `calcularPercentualComissaoMundoDaModa` para qualquer empresa (remove ramo do 35% fixo), garantindo unificação.
3. Manter intactas:
   - `tabelaComissoesFuncionario` e cálculos do funcionário.
   - `tabelaComissoesEmpresa` (já igual).
   - Tabelas Montreal e juros Aporte.

## Verificação

- Conferir páginas que mostram comissão da empresa para Inadimplente (Dashboard, Comissões, Financeiro, Acordos) — passarão a refletir a nova faixa automaticamente, pois consomem essas funções.
- Atualizar memória `Commission Logic` para registrar a unificação.

## Fora de escopo

- Colunas "Desconto Principal/Juros/Multa" da imagem (não aplicar agora).
- Comissão do funcionário.

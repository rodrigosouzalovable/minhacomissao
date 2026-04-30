## Contexto

Hoje o sistema tem duas empresas em "Novo Acordo": **UME | NOVO MUNDO** (valor `ume_novo_mundo`) e **MUNDO DA MODA** (valor `mundo_da_moda`). Você quer:

1. Renomear os rótulos das empresas (apenas UI, mantendo valores no banco intactos).
2. Regras de comissão diferentes para cada uma (aplicadas tanto na criação do acordo quanto no Excel exportado em "Acordos da Equipe").
3. Recalculo no Excel exportado, restrito ao admin.

## O que será feito

### 1. Renomear rótulos das empresas (somente UI)

| Valor no banco (mantido) | Rótulo antigo | Novo rótulo |
|---|---|---|
| `ume_novo_mundo` | UME \| NOVO MUNDO | **UME \| INADIMPLENTES** |
| `mundo_da_moda` | MUNDO DA MODA | **UME \| APORTE** |

Atualizar todas as telas onde esses rótulos aparecem (NovoAcordo, NovoAcordoAdmin, EditarAcordo, AcordoDetalhe, listagens, filtros, EquipeAcordos, Clientes, ImportarDevedores, EditPermissionsDialog, etc.). Acordos antigos seguem funcionando normalmente, apenas serão exibidos com o novo rótulo.

### 2. Novas regras de comissão

Centralizar em `src/lib/comissao.ts` uma função única `calcularComissaoPorEmpresa(empresa, valorParcela, diasAtraso)` que retorna `{ percentual, valor }`:

- **`ume_novo_mundo` (exibido como UME | INADIMPLENTES)**: percentual fixo de **35%** sobre o valor de cada parcela paga. Ignora a faixa de atraso e a tabela atual.
- **`mundo_da_moda` (exibido como UME | APORTE)**: usa a **nova tabela de Honorário/Comissão** da imagem em anexo, por faixa de atraso:

| Faixa (dias) | % |
|---|---|
| 1–30 | 7% |
| 31–60 | 8% |
| 61–90 | 15% |
| 91–120 | 20% |
| 121–150 | 20% |
| 151–180 | 20% |
| 181–210 | 27% |
| 211–240 | 27% |
| 241–270 | 27% |
| 271–300 | 27% |
| 301–330 | 27% |
| 331–360 | 27% |
| 361–420 | 36% |
| 421–480 | 36% |
| 481–540 | 36% |
| 541–600 | 36% |
| 601–660 | 36% |
| 661–720 | 36% |
| 721–1800 | 50% |
| 1801+ | 50% |

E aplicada em **todas** as parcelas (não apenas na primeira como hoje no Mundo da Moda). Apenas a coluna "Honorário/Comissão" será usada — descontos (Principal/Juros/Multa) ficam para outro pedido.

Os fluxos de criação de acordo (`NovoAcordo`, `NovoAcordoAdmin`) e exibição (`AcordoDetalhe`, `EditarAcordo`) passam a usar a função unificada.

### 3. Recálculo no Excel "Acordos da Equipe" (somente admin)

Em `src/pages/EquipeAcordos.tsx`, no `handleExportar`:

- **Se o usuário for admin**: para cada parcela paga no período exportado, recalcular `comissao_funcionario` aplicando a regra correta com base no `acordo.empresa`:
  - `ume_novo_mundo` → 35% × valor da parcela
  - `mundo_da_moda` → percentual da nova tabela Aporte (por `dias_atraso`) × valor da parcela
  - Outras empresas (caso existam) permanecem com o valor atual
- O valor recalculado **substitui** o `pag.comissao_parcela` no Excel (a coluna "Comissão Funcionário" já existente).
- Adicionar coluna extra **"Empresa"** ao lado para que fique claro qual regra foi aplicada (rótulo amigável).
- **Se NÃO for admin**: comportamento atual permanece (mantém comissão original).

A página `EquipeAcordos` já é exclusiva para admins/gestores, mas o recálculo será gateado por `useUserRole().isAdmin` para garantir que apenas admins recebam os valores recalculados — gestores comuns continuam vendo o valor original.

## Arquivos afetados

- `src/lib/comissao.ts` — nova função unificada `calcularComissaoPorEmpresa` + nova tabela `tabelaComissaoAporte`.
- `src/lib/credorConfig.ts` (ou onde os rótulos das empresas são definidos) — atualizar labels.
- `src/pages/NovoAcordo.tsx`, `src/pages/NovoAcordoAdmin.tsx` — usar a função unificada e novos rótulos no seletor de empresa.
- `src/pages/EditarAcordo.tsx`, `src/pages/AcordoDetalhe.tsx` — exibir novos rótulos e recalcular comissão exibida.
- `src/pages/EquipeAcordos.tsx` — recálculo no Excel restrito ao admin + coluna Empresa.
- `src/pages/Clientes.tsx`, `src/pages/DevedorDetalhe.tsx`, `src/pages/ImportarDevedores.tsx`, `src/pages/AdminEquipes.tsx`, `src/components/EditPermissionsDialog.tsx` — atualizar rótulos exibidos.

## Pontos a confirmar

- A cobrança/exibição de comissão para acordos **antigos** já criados no MUNDO DA MODA (que usavam apenas 1ª parcela) será **recalculada** ao reabrir/exportar — ou seja, o histórico passa a refletir as novas regras. Confirme se está OK; caso queira preservar o cálculo antigo dos acordos legados, me avise para gravar uma flag.

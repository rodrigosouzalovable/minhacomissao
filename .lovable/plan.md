## Objetivo

Na ficha do cliente (`AcordoDevedorSection`), permitir:
1. Editar **data de pagamento** (além da data de vencimento e valor) ao editar uma parcela existente.
2. Adicionar/editar uma **observação por parcela** via pop-up.

## Mudanças

### 1. Banco — `parcelas_devedor`
Migration para adicionar coluna:
- `observacao text NULL`

### 2. `src/components/devedor/AcordoDevedorSection.tsx`

**Edição inline da parcela (linhas 64-67, 383-436, ~605-670):**
- Adicionar estado `editParcelaDataPagamento`.
- No modo edição (lápis), exibir 2 inputs de data lado a lado: Vencimento e Pagamento (este último opcional).
- `handleSaveEditParcela`: gravar também `data_pagamento` (string ou `null` se vazio) e ajustar `pago = !!data_pagamento` automaticamente — assim editar a data de pagamento já marca a parcela como paga, e limpar reverte para pendente.

**Observação por parcela:**
- Novo botão ícone (`MessageSquare` do lucide) em cada linha da tabela, ao lado de Editar/Marcar Pago. Quando a parcela já tem observação, o ícone fica destacado (cor primária / preenchido).
- Ao clicar, abre um `Dialog` com `Textarea` mostrando a observação atual (carregada do banco). Botões: Cancelar / Salvar.
- Salvar faz `update parcelas_devedor set observacao = ... where id = ?` e atualiza estado local.
- Estado novo: `obsDialogParcelaId`, `obsDialogTexto`, `savingObs`.
- Tipo `ParcelaDevedor` ganha `observacao: string | null`.
- `fetchAcordos` passa a selecionar `observacao` (hoje usa `*` provavelmente — confirmar e ajustar se precisar).

### Fora do escopo
- Não mexer no fluxo do dialog "Novo Acordo" (texto/PDF/IA).
- Não alterar regras de comissão, RLS, permissões nem outras telas.
- Sem alterações em backend/edge functions.

## Detalhes técnicos

- A migração só adiciona coluna nullable — não exige novas policies/grants (tabela já tem RLS para `authenticated`).
- O comportamento "data de pagamento marca como pago" mantém compatibilidade com o botão `Marcar Pago / Desmarcar` existente (que continua funcionando como hoje).
- Pop-up de observação reutiliza o componente `Dialog` já importado.

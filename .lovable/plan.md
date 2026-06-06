## Contexto

A aba **Meus Acordos** (`src/pages/Acordos.tsx`) já tem os três controles na tela:

- Seletor de operador ao lado do título "Meus Acordos" (igual ao print).
- Filtro **"Filtrar por vencimento"** (calendário).
- Filtro **"Filtrar por criação"** (calendário).

O problema atual: o seletor de operador (`selectedUserId`) só está sendo usado para o badge **"X acordo(s) hoje"**. Ele **não filtra** a lista de acordos exibida nas abas (Negociados, Pagos, Próximas, Realizados, Vencidos). Por isso, ao escolher "Anna Flavia Leite de Morais" no dropdown, a lista continua mostrando os acordos de todos os funcionários.

Os filtros de vencimento e criação já funcionam corretamente em todas as abas — nenhum ajuste necessário neles.

## O que será feito

Apenas uma alteração frontend em `src/pages/Acordos.tsx`:

1. Aplicar `selectedUserId` como filtro adicional em todas as listas derivadas de acordos exibidas nas abas:
   - Negociados, Pagos, Próximas ao vencimento, Acordos realizados, Vencidos.
   - Quando `selectedUserId === 'todos'` → comportamento atual (admin vê tudo, operador vê os seus).
   - Quando um operador é selecionado → mostrar apenas `acordo.user_id === selectedUserId`.
2. Garantir que a exportação Excel (`handleExportarExcel`) respeite o operador selecionado.
3. Manter persistência do filtro em sessionStorage (já existe).

## Fora de escopo

- Não alterar lógica de comissão, RLS, permissões ou edge functions.
- Não mexer no layout do cabeçalho — o seletor já está posicionado como no print enviado.
- Não alterar os filtros de data (já funcionam).

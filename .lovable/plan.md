# Trocar o operador do acordo na edição (só admin)

## O que muda

Na tela "Editar Acordo", dentro do bloco "Dados do Cliente", aparece um novo campo **Operador vinculado** com a lista de operadores ativos — igual à escolha de operador que existe ao lançar um acordo pelo painel admin.

Regras:

- O campo só aparece para o login com papel admin. Para funcionários e usuários com acordos compartilhados, a tela continua exatamente como está hoje.
- O campo já vem selecionado com o operador atual do acordo.
- Ao salvar, o acordo passa a pertencer ao operador escolhido; a comissão do acordo passa a contar para ele nos rankings e comissões (o cálculo em si não muda, apenas o dono).
- Se o operador não for alterado, nada muda no comportamento atual de salvamento.

## Detalhes técnicos

- `src/pages/EditarAcordo.tsx`:
  - Carregar a lista via RPC existente `listar_usuarios_ativos()` (mesma usada em `Acordos.tsx`), habilitada só quando `isAdmin`.
  - Novo estado `operadorId`, inicializado com `acordo.user_id` no carregamento.
  - Renderizar um `Select` (shadcn) rotulado "Operador vinculado", visível apenas se `isAdmin`.
  - Incluir `user_id: operadorId` no `updatePayload` somente quando `isAdmin` e o valor mudou.
- Nenhuma migração ou mudança de permissão: as policies de admin sobre `acordos` já permitem atualizar qualquer registro (mesma base usada pela transferência de acordos existente).
- As parcelas (`pagamentos`) seguem vinculadas ao acordo por `acordo_id`, portanto acompanham a troca de operador sem ajuste extra.

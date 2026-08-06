# Exclusão do próprio acordo sem parcela paga

Hoje o atendente só consegue excluir um acordo que ele mesmo lançou se tiver a permissão extra "pode excluir acordos" marcada no cadastro de usuários. A regra nova: quem lançou o acordo pode excluí-lo livremente, desde que nenhuma parcela esteja marcada como paga.

## O que muda

- Qualquer usuário pode excluir o acordo em que ele é o operador vinculado, sem depender da permissão especial.
- Se existir pelo menos uma parcela paga, a exclusão continua bloqueada (mensagem orientando a excluir apenas parcelas pendentes). Admin segue com as regras atuais.
- O botão "Excluir" passa a aparecer no detalhe do acordo e nos cartões da lista sempre que o acordo for do próprio usuário e não tiver parcela paga.

## Detalhes técnicos

- Migração: atualizar a função `delete_acordo_atomico` para autorizar quando `v_owner = v_uid` (dono) ou admin, mantendo a checagem de parcelas pagas. A permissão `pode_excluir_acordos` deixa de ser exigida para o dono.
- `src/pages/AcordoDetalhe.tsx`: trocar a condição `podeExcluirAcordos && isOwner && parcelasPagas === 0` por `isOwner && parcelasPagas === 0`; ajustar também o aviso exibido quando há parcelas pagas.
- `src/pages/Acordos.tsx`: nos 5 usos de `canDelete`, remover `podeExcluirAcordos` e manter `acordo.user_id === user?.id && !ultimaParcelaPagaPorAcordo.has(acordo.id)`.
- Exclusão de parcela individual (`pagamento.status !== 'pago'`) fica como está hoje, mas passa a valer para o dono sem a permissão extra.
- As policies de DELETE em `acordos`/`pagamentos` já permitem o dono, não precisam mudar.

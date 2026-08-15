# Liberar o painel "Campanhas" para parceiros

Hoje o botão flutuante de Campanhas (canto inferior direito) só aparece para administradores. Usuários com o modo parceiro ativado passarão a vê-lo também, acompanhando apenas os disparos criados pelo próprio login.

## O que muda

- O botão flutuante e o painel de campanhas aparecem para admins e para usuários com "Parceiro com números próprios" ativado.
- Nenhum outro usuário passa a ver o painel.
- O parceiro continua vendo somente as campanhas dele: a listagem já é filtrada pelo usuário logado, incluindo detalhes, progresso, pausar/retomar, cancelar e excluir.

## Detalhes técnicos

- `src/components/meta/CampanhasFlutuante.tsx`: trocar a checagem `if (roleLoading || !isAdmin) return null` por `isAdmin || parceiroMeta`, usando `useUserPermissions()` (campo `parceiroMeta`) junto do `useUserRole()`, respeitando os estados de loading dos dois hooks.
- Sem mudanças de banco: `EnvioMetaSendingContext` já consulta `envio_meta_job` com `.eq("user_id", uid)` e o Realtime usa o mesmo filtro, então o isolamento entre parceiro e conta principal se mantém.

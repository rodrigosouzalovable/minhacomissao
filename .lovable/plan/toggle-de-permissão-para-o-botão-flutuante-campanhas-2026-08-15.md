# Toggle de permissão para o botão flutuante "Campanhas"

Hoje o botão flutuante "Campanhas" (canto inferior direito) só aparece para administradores e para usuários com "Parceiro com números próprios" ativado. Vamos criar um toggle próprio em "Editar Permissões" para liberar esse botão a qualquer usuário.

## O que muda

- Novo toggle em Editar Permissões: **"Ver painel de Campanhas"**, junto dos outros toggles de Meta.
- Quando ativado, o usuário passa a ver o botão flutuante e o painel de campanhas.
- Ele continua vendo apenas as campanhas criadas pelo próprio login (isolamento já existente).
- Admins e parceiros continuam vendo o botão como hoje, sem depender do novo toggle.

## Detalhes técnicos

- Banco: adicionar coluna `ve_campanhas boolean not null default false` em `user_permissions`.
- `src/hooks/useUserPermissions.tsx`: expor `veCampanhas`.
- `src/components/EditPermissionsDialog.tsx`: novo state + Switch, carregar no `useEffect` e enviar `ve_campanhas` no payload de save/insert.
- `src/components/meta/CampanhasFlutuante.tsx`: condição passa a ser `isAdmin || parceiroMeta || veCampanhas`.

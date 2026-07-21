## Ajuste no diálogo "Editar Permissões"

Atualmente, a aba **Usuários** aparece travada (checkbox desabilitado, marcada como "obrigatória") para **todos** os usuários no diálogo de permissões. Isso impede que você desmarque essa aba de outros funcionários mesmo quando quiser.

### Mudança

Em `src/components/EditPermissionsDialog.tsx`, tornar o bloqueio **condicional**: a aba `/admin/usuarios` só fica travada quando o `userId` sendo editado é o mesmo do admin logado (`currentUser.id`). Para qualquer outro usuário, todos os checkboxes (incluindo "Usuários") ficam livres para ativar/desativar normalmente.

### Detalhes técnicos

- Calcular `isSelf = currentUser?.id === userId`.
- Substituir `const locked = tab.path === '/admin/usuarios'` por `const locked = isSelf && tab.path === '/admin/usuarios'`.
- Ajustar `toggleTab` para só bloquear quando `isSelf && path === '/admin/usuarios'`.
- Ajustar o `saveMutation` para só forçar a inclusão de `/admin/usuarios` em `abas_permitidas` quando `isSelf` (protege apenas seu próprio login).
- O rótulo "(obrigatória)" e o estilo cinza só aparecem no seu próprio card.

Nenhuma mudança de banco ou RLS — é apenas UI/lógica do diálogo.
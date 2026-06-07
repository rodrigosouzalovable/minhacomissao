## Causa raiz

A página `/estrategias` é liberada via `PermissionRoute` (qualquer usuário com `estrategias` em `user_permissions.abas_permitidas`), mas a policy do bucket `estrategia-uploads` exige `is_admin_user(auth.uid())` — que checa `user_roles.role = 'admin'`.

Consultando o banco:
- Só existe **1 admin** em `user_roles` (Rodrigo). Qualquer outro usuário com acesso à aba recebe 403/RLS no upload.
- O seu login atual tem permissão da aba mas não está em `user_roles` como admin → por isso o toast "Sem permissão".

## Correção

1. **Migration** — recriar as policies `INSERT` e `UPDATE` em `storage.objects` para o bucket `estrategia-uploads` permitindo:
   - `is_admin_user(auth.uid())` **OU**
   - usuário autenticado cujo `user_permissions.abas_permitidas` contenha `'estrategias'`.
   - Bucket continua **privado** (sem mexer em SELECT público).

2. **Edge function `estrategia-importar`** — manter a checagem server-side, mas aceitar também usuários com a permissão da aba (hoje exige admin). Assim o processamento não trava após o upload.

3. **Sem mudanças visuais** — só backend/policy.

## Validação

- Re-executar upload com o usuário atual; conferir que sobe e a função processa.
- Conferir via `pg_policies` que as duas policies novas estão ativas com a condição OR.

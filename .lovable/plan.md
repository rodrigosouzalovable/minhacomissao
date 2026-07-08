## Diagnóstico

O sino está vazio porque a edge function `notify-cpf-consulta` só grava a notificação quando existe pelo menos um usuário com `recebe_consulta_cpf = true` em `user_permissions`. Como nenhum funcionário tem esse toggle ativado ainda, o pool retorna vazio e nada é inserido em `consulta_cpf_notificacoes` — por isso o WhatsApp do admin recebe (fallback funciona), mas o sino não mostra nada.

## Correção

Editar `supabase/functions/notify-cpf-consulta/index.ts`:

1. Manter a lógica de rodízio quando existir pool com `recebe_consulta_cpf = true`.
2. **Se o pool estiver vazio**, buscar todos os admins em `user_roles` (`role = 'admin'`) e aplicar o mesmo rodízio entre eles (menos recentemente atribuído primeiro). Inserir a notificação normalmente atribuída ao admin escolhido.
3. Se não houver nem admins (caso extremo), inserir a notificação com `assigned_user_id = null` — o admin ainda vê pelo policy "Admins can view all cpf notifs".
4. Manter o WhatsApp de admin como fallback (sem alteração nesse trecho).

Nenhuma mudança em schema, RLS ou UI. Só a edge function.

## Escopo excluído

- Não alterar `EditPermissionsDialog`, componente do sino, portal público ou outras notificações.

# Corrigir acesso à aba Comissões para funcionários

## Problema
A rota `/comissoes` está protegida por `AdminRoute`, que só permite admins. Por isso, mesmo liberando a aba "Minhas Comissões" nas permissões do funcionário, ao clicar ele é redirecionado para `/dashboard`.

## Correção
Em `src/App.tsx`, trocar o wrapper da rota `/comissoes`:

- De: `<AdminRoute><Comissoes /></AdminRoute>`
- Para: `<PermissionRoute><Comissoes /></PermissionRoute>`

Assim, admins continuam tendo acesso (PermissionRoute libera admins automaticamente) e funcionários com a aba `/comissoes` marcada em `user_permissions.abas_permitidas` também conseguirão entrar.

## Observação
A página `Comissoes.tsx` já é a tela do próprio usuário (mostra as comissões do `user.id` logado), então não há risco de vazamento de dados — funcionário só vê as próprias comissões.

As rotas administrativas reais (`/admin/usuarios/:userId/comissoes` e `/admin/usuarios/:userId/novo-acordo`) continuam em `AdminRoute`.

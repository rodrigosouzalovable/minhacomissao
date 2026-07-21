## Objetivo

Fazer com que o login `avatusbarbearia@gmail.com` (e qualquer usuário que não tenha o Dashboard liberado nas permissões) caia direto em `/admin/inbox-meta` ao entrar, em vez de ver a tela do Dashboard.

## Diagnóstico

Hoje o fluxo pós-login sempre manda para `/dashboard`:

- `src/pages/Auth.tsx` faz `navigate('/dashboard')` após o `signIn`.
- `src/App.tsx` no `PublicRoute` faz `<Navigate to="/dashboard" replace />` quando o usuário já está logado e acessa `/auth` ou `/`.
- A rota `/dashboard` renderiza `Dashboard.tsx` sem checar permissões — por isso mesmo o usuário `avatusbarbearia` (que só tem Inbox / API / Envio / Cobranças Meta liberados) enxerga o Dashboard.

O usuário `avatusbarbearia` tem em `user_permissions.abas_permitidas` apenas as abas do módulo Meta e não tem `/dashboard` liberado.

## Mudanças (somente frontend/routing)

1. **Novo helper `useInitialRoute`** (`src/hooks/useInitialRoute.tsx`):
   - Retorna `{ path, loading }`.
   - Se o usuário é admin ou gestor → `/dashboard`.
   - Se `abasPermitidas` inclui `/dashboard` → `/dashboard`.
   - Senão, prioriza nesta ordem se estiverem em `abasPermitidas`: `/admin/inbox-meta`, `/admin/envio-meta`, `/admin/configurar-meta`, `/admin/cobrancas-meta`, e por fim a primeira aba permitida.
   - Fallback final: `/dashboard`.

2. **`src/pages/Auth.tsx`**:
   - Após `signIn`, em vez de `navigate('/dashboard')`, aguardar o helper e navegar para `path` calculado (com pequeno loading state já existente).

3. **`src/App.tsx`**:
   - Substituir os redirects fixos para `/dashboard` no `PublicRoute` por navegação dinâmica usando `useInitialRoute`.
   - Adicionar guarda em `/dashboard`: se o usuário não é admin/gestor **e** `abasPermitidas` não inclui `/dashboard`, redireciona para o `path` do helper. Isso protege quem digitar `/dashboard` diretamente.
   - Não alterar as demais rotas (`PermissionRoute`, `AdminRoute`, etc.).

## Escopo

- Nenhuma mudança de dados, RLS ou lógica de negócio.
- Comportamento para admins e para usuários que já têm Dashboard liberado permanece idêntico.
- Efeito prático: ao entrar com `avatusbarbearia@gmail.com`, o sistema abre direto em `/admin/inbox-meta`.

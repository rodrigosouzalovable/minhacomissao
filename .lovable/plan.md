## Problemas identificados

1. **`/admin/configurar-meta` (API Oficial Meta) sem sidebar** — A página `src/pages/ConfigurarMeta.tsx` não está envolvida pelo `AppLayout`, por isso renderiza sem a barra lateral. Todas as demais páginas internas usam `<AppLayout>…</AppLayout>` como wrapper.

2. **`/admin/envio-meta` (Envio Meta massa) volta para Dashboard** — A rota está protegida por `AdminRoute`, que redireciona para `/dashboard` quando o usuário não é admin. Como o item já aparece no menu para admin, o redirect indica que o `useUserRole` está retornando `isAdmin=false` em algum momento (ou o usuário logado não é admin mas vê o link mesmo assim — o filtro `adminOnly` do menu pode estar divergindo do `isAdmin` da rota).

## Correções

### 1. Envolver `ConfigurarMeta` com `AppLayout`
Em `src/pages/ConfigurarMeta.tsx`:
- Importar `AppLayout`.
- Envolver o JSX retornado por `<AppLayout> … </AppLayout>` (mesmo padrão de `EnvioMeta.tsx`).

### 2. Permitir acesso real à `/admin/envio-meta`
Em `src/App.tsx`, trocar a proteção das duas rotas Meta de `AdminRoute` para `PermissionRoute`, igual às outras telas administrativas (Auditoria, Financeiro, Acionamento etc.). Assim:
- Admin continua entrando sem restrição.
- Gestores/usuários com a aba liberada em `user_permissions` também conseguem entrar.
- Resolve o "vai para dashboard" para o seu usuário atual (que aparentemente não está marcado como admin nessa sessão, mas tem a aba liberada).

```tsx
<Route path="/admin/configurar-meta" element={<PermissionRoute><ConfigurarMeta /></PermissionRoute>} />
<Route path="/admin/envio-meta" element={<PermissionRoute><EnvioMeta /></PermissionRoute>} />
```

Nenhuma outra alteração de lógica. Sidebar e navegação voltam a funcionar nas duas telas.
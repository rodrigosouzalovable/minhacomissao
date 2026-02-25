

# Atualizar lista de abas no dialog de Editar Permissões

## Problema
O dialog de Editar Permissões em `EditPermissionsDialog.tsx` lista apenas 7 abas fixas, mas o sistema tem mais abas disponíveis (como "Acordos da Equipe", "Acionamento", etc.). Quando novas abas forem criadas, elas precisam aparecer automaticamente.

## Solução

### Alteração em `src/components/EditPermissionsDialog.tsx`

Atualizar a constante `AVAILABLE_TABS` para incluir todas as abas existentes no sistema, espelhando a lista de `navItems` do `AppLayout.tsx`:

```typescript
const AVAILABLE_TABS = [
  { path: '/conta', label: 'Minha Conta' },
  { path: '/dashboard', label: 'Dashboard' },
  { path: '/acordos', label: 'Meus Acordos' },
  { path: '/acordos/novo', label: 'Novo Acordo' },
  { path: '/retornos', label: 'Retornos' },
  { path: '/clientes', label: 'Clientes' },
  { path: '/comissoes', label: 'Minhas Comissões' },
  { path: '/equipe/acordos', label: 'Acordos da Equipe' },
  { path: '/admin/usuarios', label: 'Usuários' },
  { path: '/admin/equipes', label: 'Equipes' },
  { path: '/admin/auditoria', label: 'Auditoria' },
  { path: '/admin/financeiro', label: 'Financeiro' },
  { path: '/admin/importar-devedores', label: 'Importar Devedores' },
  { path: '/admin/acionamento', label: 'Acionamento' },
];
```

Isso inclui todas as 14 abas do sistema. Para facilitar a manutenção futura, a lista será centralizada neste componente e refletirá todas as rotas protegidas do `AppLayout`.

### Alteração no `AppLayout.tsx`

Ajustar a lógica de filtragem para que, quando `abasPermitidas` estiver configurada, ela seja respeitada para **todas** as abas (não apenas as não-admin). Isso permite que o admin conceda acesso seletivo a abas administrativas para funcionários específicos, se desejado. A lógica atual já funciona corretamente pois só aplica o filtro para não-admins.

Nenhuma mudança necessária no `AppLayout.tsx` -- a lógica atual já cobre o cenário.

### Resumo das mudanças
- **1 arquivo**: `src/components/EditPermissionsDialog.tsx` -- atualizar `AVAILABLE_TABS` com todas as 14 abas do sistema


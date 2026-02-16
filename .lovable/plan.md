
## Plano: Permitir associar admins como funcionários na gestão de equipes

### Problema
Na página "Gestão de Equipes", o dropdown "Funcionário" filtra apenas usuários com role `funcionario`. Isso impede que o admin (rodrigo.rs2013@gmail.com) seja associado a um gestor.

### Solução
Alterar o filtro na linha 97 de `src/pages/AdminEquipes.tsx` para incluir também usuários com role `admin` no dropdown de funcionários.

### Alteração

**Arquivo**: `src/pages/AdminEquipes.tsx` (linha 97)

```tsx
// De:
const funcionarios = usersData?.filter((u) => u.role === 'funcionario') ?? [];

// Para:
const funcionarios = usersData?.filter((u) => u.role === 'funcionario' || u.role === 'admin') ?? [];
```

Isso fará com que admins apareçam no dropdown "Funcionário" e possam ser associados a gestores, mantendo o restante do fluxo inalterado.

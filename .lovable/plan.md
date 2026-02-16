
## Plano: Permitir admin no dropdown de Gestores

### Problema
O dropdown "Gestor" filtra apenas usuários com role `gestor`, mas não existe nenhum gestor cadastrado. O admin precisa aparecer como opção de gestor para poder associar funcionários à sua equipe.

### Solução
Alterar o filtro de gestores na linha 96 de `src/pages/AdminEquipes.tsx` para incluir também usuários com role `admin`.

### Alteração

**Arquivo**: `src/pages/AdminEquipes.tsx` (linha 96)

```tsx
// De:
const gestores = usersData?.filter((u) => u.role === 'gestor') ?? [];

// Para:
const gestores = usersData?.filter((u) => u.role === 'gestor' || u.role === 'admin') ?? [];
```

Isso fará com que o admin apareça no dropdown "Gestor", permitindo associar funcionários diretamente.

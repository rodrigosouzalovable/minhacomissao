

## Remover PortalHome e redirecionar raiz para /novomundo

### Alteracoes

#### 1. `src/App.tsx`
- Trocar a rota `path="/"` de `<PortalHome />` para `<Navigate to="/novomundo" replace />`
- Remover import do `PortalHome`

#### 2. `src/pages/PortalHome.tsx`
- Pode ser removido (nao sera mais usado)

Sem impacto em banco, Edge Functions ou custo.


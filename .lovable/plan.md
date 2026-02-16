

## Corrigir paginacao e aumentar para 100 linhas por pagina

### Problema
O botao "Proxima" chama `handleSearch(page + 1)` mas nunca atualiza o state `page`, entao ele sempre fica em 0 e a proxima pagina nunca e carregada.

### Alteracoes

**Arquivo: `src/pages/Clientes.tsx`**

1. Alterar `PAGE_SIZE` de 20 para 100
2. Dentro de `handleSearch`, adicionar `setPage(pageNum)` para atualizar o state da pagina atual apos a busca

### Detalhe tecnico

```typescript
// Antes
const PAGE_SIZE = 20;

// Depois
const PAGE_SIZE = 100;
```

```typescript
// Dentro de handleSearch, antes do setSearched:
setPage(pageNum);
```

Isso resolve o bug onde a paginacao nao avancava e aumenta o numero de resultados por pagina para 100.


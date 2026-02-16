
## Corrigir botao "Proxima" na paginacao de Clientes

### Problema
A funcao `handleSearch` recebe o numero da pagina como parametro e faz a query corretamente, mas nunca atualiza o state `page` com `setPage(pageNum)`. Isso faz com que o state `page` fique sempre em 0, e os botoes de paginacao nao funcionem.

### Solucao
Adicionar `setPage(pageNum)` dentro da funcao `handleSearch`, logo apos iniciar o loading.

### Alteracao

**Arquivo: `src/pages/Clientes.tsx`** (linha 50)

Adicionar `setPage(pageNum);` apos `setLoading(true);`:

```typescript
setLoading(true);
setPage(pageNum);
```

Isso e a unica alteracao necessaria. O resto da logica (query com range, exibicao de pagina, botoes Anterior/Proxima) ja esta correta.
